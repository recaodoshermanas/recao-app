// Plan → Reuniones: acta automática de la reunión de dirección a partir del audio.
//  · empezar (dirección con área Plan): copia el audio del almacén «reuniones» a Google Cloud Storage
//    (gs://recao-audios-formacion/reuniones/…, se borra solo a los 30 días) y lanza la transcripción
//    larga de Google Speech-to-Text v2 (español, región eu).
//  · comprobar: mira si la transcripción ha terminado; si sí, guarda el texto y Claude redacta el acta
//    (resumen, decisiones, acuerdos con responsable y fecha, bloqueos). El panel la llama cada pocos segundos.
// La transcripción y el acta solo las ve quien tiene el área Plan (RLS de dir_reuniones).
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const BUCKET_SB = "reuniones";
const BUCKET_GCS = "recao-audios-formacion";
const UBICACION = "eu";
const MODELOS = ["chirp_3", "long"]; // si el primero no está disponible en la región, se usa el siguiente
// chirp_3 solo admite audios de hasta 60 minutos; «long» admite reuniones más largas
const MODELOS_LARGO = ["long"];
const esMuyLargo = (m: string) => /too long|60 minutes/i.test(m || "");
const CLAUDE = "claude-sonnet-5";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class Fallo extends Error { status: number; constructor(m: string, s = 400) { super(m); this.status = s; } }

const SOCIOS: Record<string, string> = { Adrian: "Adrián", Pablo: "Pablo", Javi: "Javi", Migue: "Miguel (Migue)" };

async function cfg(claves: string[]) {
  const { data } = await sb.from("app_config").select("clave,valor").in("clave", claves);
  return Object.fromEntries((data ?? []).map((r: any) => [r.clave, r.valor])) as Record<string, string>;
}
async function puedePlan(req: Request) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return false;
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return false;
  const { data: f } = await sb.from("usuarios").select("rol,activo,areas_direccion").eq("auth_id", u.user.id).maybeSingle();
  return !!f && f.activo === true && (f.rol === "admin" || (f.areas_direccion ?? []).includes("plan"));
}

// ---- Google: token de la cuenta de servicio ----
const b64url = (b: Uint8Array) => { let s = ""; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const txt = (s: string) => new TextEncoder().encode(s);
async function tokenGoogle(saJson: string) {
  const sa = JSON.parse(saJson);
  const ahora = Math.floor(Date.now() / 1000);
  const cab = b64url(txt(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const cuerpo = b64url(txt(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: ahora, exp: ahora + 3600 })));
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, txt(`${cab}.${cuerpo}`)));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cab}.${cuerpo}.${b64url(firma)}` }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Fallo(`Google no da acceso: ${d.error_description ?? d.error ?? r.status}`, 500);
  return { token: d.access_token as string, proyecto: sa.project_id as string };
}

const MIME: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp4: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", aac: "audio/aac" };

async function empezar(id: number, modelos: string[] = MODELOS) {
  const { data: r } = await sb.from("dir_reuniones").select("id,audio_path,acta_estado").eq("id", id).maybeSingle();
  if (!r) throw new Fallo("Reunión no encontrada", 404);
  if (!r.audio_path) throw new Fallo("Primero sube o graba el audio de la reunión");
  const c = await cfg(["gcp_sa_key"]);
  if (!c.gcp_sa_key) throw new Fallo("Falta la cuenta de servicio de Google", 500);
  const { token, proyecto } = await tokenGoogle(c.gcp_sa_key);

  // 1) audio → Google Cloud Storage
  const { data: blob, error } = await sb.storage.from(BUCKET_SB).download(r.audio_path);
  if (error || !blob) throw new Fallo("No encuentro el audio en el almacén", 500);
  const ext = (r.audio_path.split(".").pop() ?? "webm").toLowerCase();
  const objeto = `reuniones/${r.audio_path}`;
  const up = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${BUCKET_GCS}/o?uploadType=media&name=${encodeURIComponent(objeto)}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": MIME[ext] ?? "application/octet-stream" }, body: await blob.arrayBuffer(),
  });
  if (!up.ok) throw new Fallo(`No se ha podido pasar el audio a Google (${up.status}): ${(await up.text()).slice(0, 200)}`, 500);
  const uri = `gs://${BUCKET_GCS}/${objeto}`;

  // 2) transcripción larga (asíncrona)
  let ultimo = "";
  for (const modelo of modelos) {
    const resp = await fetch(`https://${UBICACION}-speech.googleapis.com/v2/projects/${proyecto}/locations/${UBICACION}/recognizers/_:batchRecognize`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        config: { autoDecodingConfig: {}, languageCodes: ["es-ES"], model: modelo, features: { enableAutomaticPunctuation: true } },
        files: [{ uri }],
        recognitionOutputConfig: { inlineResponseConfig: {} },
      }),
    });
    const d = await resp.json().catch(() => ({}));
    if (resp.ok && d.name) {
      await sb.from("dir_reuniones").update({ acta_estado: "transcribiendo", acta_operacion: d.name, acta_error: null }).eq("id", id);
      return { estado: "transcribiendo", modelo };
    }
    ultimo = d?.error?.message ?? String(resp.status);
  }
  await sb.from("dir_reuniones").update({ acta_estado: "error", acta_error: `Transcripción: ${ultimo}`.slice(0, 500) }).eq("id", id);
  throw new Fallo(`Google no ha aceptado el audio: ${ultimo}`, 500);
}

async function redactar(id: number, transcripcion: string) {
  const c = await cfg(["anthropic_api_key"]);
  if (!c.anthropic_api_key) throw new Error("falta la clave de Claude");
  const { data: r } = await sb.from("dir_reuniones").select("fecha,tipo").eq("id", id).maybeSingle();
  const { data: proys } = await sb.from("proyectos").select("id,nombre,responsable,columna").neq("estado", "terminado");
  const { data: puntos } = await sb.from("dir_reunion_puntos").select("tipo,texto,autor,responsable").eq("reunion_id", id);
  const contexto = [
    `Fecha de la reunión: ${r?.fecha} (${r?.tipo}).`,
    `Socios (usa estos identificadores en "responsable"): ${Object.entries(SOCIOS).map(([k, v]) => `${k} = ${v}`).join(", ")}.`,
    `Proyectos del roadmap: ${(proys ?? []).map((p: any) => `[${p.id}] ${p.nombre}${p.responsable ? ` (${p.responsable})` : ""}`).join("; ") || "ninguno"}.`,
    puntos?.length ? `Puntos apuntados en el panel: ${puntos.map((p: any) => `${p.tipo}: ${p.texto}${p.responsable ? ` → ${p.responsable}` : ""}`).join(" | ")}.` : "",
  ].filter(Boolean).join("\n");
  const pide = `Eres quien levanta acta de la reunión semanal de dirección de Recao, una tienda de alimentación con cuatro socios. Abajo tienes el contexto y la transcripción automática (puede tener errores de reconocimiento y no distingue quién habla).

Devuelve SOLO este JSON, sin texto alrededor:
{"resumen": "<3 a 5 frases con lo importante>",
 "decisiones": [{"texto": "<qué se decidió>"}],
 "acuerdos": [{"texto": "<tarea concreta acordada>", "responsable": "<Adrian|Pablo|Javi|Migue o null>", "fecha": "<AAAA-MM-DD o null>", "proyecto_id": <id del proyecto relacionado o null>}],
 "bloqueos": [{"texto": "<qué está bloqueado y qué hace falta>", "quien": "<socio o null>"}],
 "temas": [{"titulo": "<tema>", "resumen": "<1-2 frases>"}]}

Reglas: solo lo que se dijo de verdad, nada inventado. Un acuerdo es algo que alguien se compromete a hacer; si no queda claro quién, responsable null. Las fechas relativas («el viernes», «la semana que viene») se calculan desde la fecha de la reunión. En español, frases cortas y claras.

CONTEXTO
${contexto}

TRANSCRIPCIÓN
${transcripcion.slice(0, 180000)}`;
  for (let i = 0; i < 3; i++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": c.anthropic_api_key },
      body: JSON.stringify({ model: CLAUDE, max_tokens: 4000, messages: [{ role: "user", content: pide }] }),
    });
    if (resp.status === 429 || resp.status >= 500) { await new Promise((s) => setTimeout(s, 2500 * (i + 1))); continue; }
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(`Claude: ${d?.error?.message ?? resp.status}`);
    const t = (d.content ?? []).filter((x: any) => x.type === "text").map((x: any) => x.text).join("");
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Claude no ha devuelto el acta");
    const o = JSON.parse(m[0]);
    const lista = (x: any) => (Array.isArray(x) ? x : []);
    return {
      resumen: String(o.resumen ?? ""),
      decisiones: lista(o.decisiones).map((x: any) => ({ texto: String(x?.texto ?? "") })).filter((x: any) => x.texto),
      acuerdos: lista(o.acuerdos).map((x: any) => ({ texto: String(x?.texto ?? ""), responsable: SOCIOS[x?.responsable] ? x.responsable : null, fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(x?.fecha)) ? x.fecha : null, proyecto_id: Number.isFinite(Number(x?.proyecto_id)) && x?.proyecto_id != null ? Number(x.proyecto_id) : null })).filter((x: any) => x.texto),
      bloqueos: lista(o.bloqueos).map((x: any) => ({ texto: String(x?.texto ?? ""), quien: x?.quien ?? null })).filter((x: any) => x.texto),
      temas: lista(o.temas).map((x: any) => ({ titulo: String(x?.titulo ?? ""), resumen: String(x?.resumen ?? "") })).filter((x: any) => x.titulo),
    };
  }
  throw new Error("Claude no responde");
}

async function comprobar(id: number, forzar = false) {
  const { data: r } = await sb.from("dir_reuniones").select("id,acta_estado,acta_operacion,transcripcion,acta,acta_error").eq("id", id).maybeSingle();
  if (!r) throw new Fallo("Reunión no encontrada", 404);
  if (r.acta_estado === "lista" || r.acta_estado === "error" || r.acta_estado === "subido" || !r.acta_estado) return { estado: r.acta_estado, error: r.acta_error };
  // otra pasada ya está redactando (el panel pregunta cada pocos segundos); «redactar_otra_vez» la fuerza
  if (r.acta_estado === "redactando" && (!forzar || !r.transcripcion)) return { estado: "redactando" };
  let transcripcion = r.transcripcion as string | null;
  if (r.acta_estado === "transcribiendo") {
    const c = await cfg(["gcp_sa_key"]);
    const { token } = await tokenGoogle(c.gcp_sa_key);
    const op = await fetch(`https://${UBICACION}-speech.googleapis.com/v2/${r.acta_operacion}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await op.json().catch(() => ({}));
    if (!op.ok) throw new Fallo(`Google: ${d?.error?.message ?? op.status}`, 500);
    if (!d.done) return { estado: "transcribiendo", avance: d.metadata?.progressPercent ?? null };
    if (d.error) {
      await sb.from("dir_reuniones").update({ acta_estado: "error", acta_error: `Transcripción: ${d.error.message}`.slice(0, 500) }).eq("id", id);
      return { estado: "error", error: d.error.message };
    }
    const res = Object.values(d.response?.results ?? {})[0] as any;
    if (res?.error) {
      // reunión de más de una hora: se vuelve a lanzar sola con el modelo para audios largos
      if (esMuyLargo(res.error.message) && !String(d.metadata?.batchRecognizeRequest?.config?.model || "").startsWith("long")) {
        await empezar(id, MODELOS_LARGO);
        return { estado: "transcribiendo", relanzado: "long" };
      }
      await sb.from("dir_reuniones").update({ acta_estado: "error", acta_error: `Transcripción: ${res.error.message}`.slice(0, 500) }).eq("id", id);
      return { estado: "error", error: res.error.message };
    }
    const trozos = (res?.inlineResult?.transcript?.results ?? res?.transcript?.results ?? []) as any[];
    transcripcion = trozos.map((x) => x?.alternatives?.[0]?.transcript ?? "").filter(Boolean).join("\n").trim();
    if (!transcripcion) {
      await sb.from("dir_reuniones").update({ acta_estado: "error", acta_error: "La transcripción ha salido vacía: ¿se oye bien el audio?" }).eq("id", id);
      return { estado: "error", error: "transcripción vacía" };
    }
    // cerrojo: solo una pasada redacta
    const { data: yo } = await sb.from("dir_reuniones").update({ acta_estado: "redactando", transcripcion }).eq("id", id).eq("acta_estado", "transcribiendo").select("id");
    if (!yo?.length) return { estado: "redactando" };
  }
  try {
    const acta = await redactar(id, transcripcion!);
    await sb.from("dir_reuniones").update({ acta, acta_estado: "lista", acta_error: null }).eq("id", id);
    return { estado: "lista" };
  } catch (e) {
    await sb.from("dir_reuniones").update({ acta_estado: "error", acta_error: `Acta: ${(e as Error).message}`.slice(0, 500) }).eq("id", id);
    return { estado: "error", error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (!(await puedePlan(req))) return json({ error: "No autorizado" }, 401);
    const b = await req.json().catch(() => ({}));
    const id = Number(b.id);
    if (!id) throw new Fallo("Falta la reunión");
    if (b.accion === "empezar") {
      const { data: r0 } = await sb.from("dir_reuniones").select("acta_error").eq("id", id).maybeSingle();
      return json(await empezar(id, esMuyLargo(r0?.acta_error ?? "") ? MODELOS_LARGO : MODELOS));
    }
    if (b.accion === "comprobar") return json(await comprobar(id));
    if (b.accion === "redactar_otra_vez") {
      const { data: r } = await sb.from("dir_reuniones").select("transcripcion").eq("id", id).maybeSingle();
      if (!r?.transcripcion) throw new Fallo("No hay transcripción");
      await sb.from("dir_reuniones").update({ acta_estado: "redactando", acta_error: null }).eq("id", id);
      return json(await comprobar(id, true));
    }
    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, e instanceof Fallo ? e.status : 500);
  }
});
