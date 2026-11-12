// gestion-usuarios · v8 (accesos): al crear o editar una persona se elige si entra en la app de tienda
// y a qué áreas del panel de dirección (todas = rol admin; algunas = areas_direccion).
// Nuevo tipo «oficina» (rol colaborador): persona sin puesto en tienda, solo panel.
// Sobre la v7 (#49). Cambios marcados con "ACCESOS".
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// TEL: normaliza a formato internacional. Móvil español de 9 cifras → +34XXXXXXXXX.
// Devuelve undefined si no viene, null si viene vacío y "invalido" si no se entiende.
function normTel(v: unknown): string | null | undefined | "invalido" {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  if (!s) return null;
  let d = s.replace(/[^\d+]/g, "");
  if (d.startsWith("00")) d = "+" + d.slice(2);
  const dig = d.replace(/\D/g, "");
  if (!d.startsWith("+")) {
    if (dig.length === 9 && /^[6789]/.test(dig)) return "+34" + dig;
    if (dig.length === 11 && dig.startsWith("34")) return "+" + dig;
    return "invalido";
  }
  return dig.length >= 10 && dig.length <= 15 ? "+" + dig : "invalido";
}
const TEL_ERROR = "Teléfono no válido. Escribe el móvil con 9 cifras (ej. 612 345 678) o con prefijo si no es español (ej. +351 912 345 678).";
const EMAIL_YA = "Ese email ya tiene una cuenta en la app"; // #49

// ACCESOS: áreas del panel que ya se pueden dar por separado (su base de datos comprueba el área).
// Personas, Finanzas y Producto de momento solo con dirección completa.
const AREAS_SUELTAS = ["pulso", "marketing", "plan", "tecnologia"];
const SIN_AREAS = "Elige al menos un área del panel de dirección";

async function sbRest(path: string, init: RequestInit = {}) {
  return await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// BIENVENIDA: aviso al crear la cuenta; sale por correo y por WhatsApp con el enlace que toca
// ACCESOS: si entra en el panel (todo o algunas áreas) se le manda al panel; si además tiene app, se le dicen los dos.
async function bienvenida(u: { id: string; rol?: string; email?: string; areas_direccion?: string[] | null; acceso_app?: boolean }) {
  const panel = u.rol === "admin" || (u.areas_direccion || []).length > 0;
  const app = u.acceso_app !== false && u.rol !== "colaborador";
  const enlaces = panel && app
    ? "el panel de dirección (https://direccion.elrecao.com) y la app de Recao (https://app.elrecao.com)"
    : panel ? "el panel de dirección: https://direccion.elrecao.com" : "la app de Recao: https://app.elrecao.com";
  await sbRest("notificaciones", {
    method: "POST",
    body: JSON.stringify({
      usuario_id: u.id, tipo: "bienvenida",
      titulo: panel ? "Bienvenido al panel de dirección de Recao" : "Bienvenida a la app de Recao",
      cuerpo: panel
        ? `Ya tienes cuenta en ${enlaces} · Entra con tu correo ${u.email || ""} y la contraseña que te han dado. En Ajustes → Mis avisos eliges qué te llega por correo y por WhatsApp.`
        : `Ya tienes cuenta en ${enlaces} · Entra con tu correo ${u.email || ""} y la contraseña que te han dado en la tienda. Ahí verás tus turnos, los turnos para cubrir y tus solicitudes.`,
    }),
  }).catch(() => {});
}

async function authAdmin(path: string, init: RequestInit = {}) {
  return await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function requireAdmin(req: Request) {
  const authz = req.headers.get("Authorization") || "";
  const token = authz.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!ur.ok) return null;
  const authUser = await ur.json();
  if (!authUser?.id) return null;
  const r = await sbRest(`usuarios?select=id,rol,activo&auth_id=eq.${authUser.id}`);
  if (!r.ok) return null;
  const rows = await r.json();
  const u = rows?.[0];
  if (!u || u.rol !== "admin" || u.activo !== true) return null;
  return u;
}

// #49: el tipo de puesto manda sobre jornada, tipo_turno y eventual
// ACCESOS: «oficina» = sin puesto en tienda (rol colaborador)
function tipoPatch(tipo: unknown): Record<string, unknown> | null {
  if (tipo === "principal" || tipo === "apoyo") return { eventual: false, tipo_turno: tipo, jornada: tipo };
  if (tipo === "eventual") return { eventual: true, tipo_turno: null, jornada: null };
  if (tipo === "oficina") return { eventual: false, tipo_turno: null, jornada: null };
  return null;
}

// ACCESOS: valida la lista de áreas pedida
function leerAreas(v: unknown): string[] | "invalido" {
  if (!Array.isArray(v)) return "invalido";
  const a = [...new Set(v.map((x) => String(x)))];
  if (a.some((x) => !AREAS_SUELTAS.includes(x))) return "invalido";
  return a;
}

// #49: errores de Auth entendibles
function errorAuth(status: number, texto: string) {
  if (/email_exists|already (been )?registered|already exists/i.test(texto)) return EMAIL_YA;
  return `Auth: ${status} ${texto}`;
}

async function emailLibre(email: string, exceptoId?: string) {
  const r = await sbRest(`usuarios?select=id&email=ilike.${encodeURIComponent(email)}`);
  const rows = r.ok ? await r.json() : [];
  return !rows.some((x: { id: string }) => x.id !== exceptoId);
}

// #49: los turnos futuros de trabajo salen a la bolsa y se quitan de su horario.
// La base publica las ofertas (publicar_turnos_futuros_en_bolsa) y aquí se libera el horario.
async function lanzarTurnosABolsa(id: string): Promise<{ ok: boolean; n?: number; error?: string }> {
  const rr = await sbRest("rpc/publicar_turnos_futuros_en_bolsa", { method: "POST", body: JSON.stringify({ p_uid: id }) });
  if (!rr.ok) return { ok: false, error: `Bolsa: ${await rr.text()}` };
  const res = await rr.json();
  const turnos = encodeURIComponent('("Mañana","Tarde","Apoyo 1","Apoyo 2","Apoyo 3")');
  const dr = await sbRest(`horarios?usuario_id=eq.${id}&fecha=gte.${res.desde}&turno=in.${turnos}`, { method: "DELETE" });
  if (!dr.ok) return { ok: false, error: `Horarios: ${await dr.text()}` };
  return { ok: true, n: res.publicados };
}

// Da login a una persona que ya existe en usuarios (eventual sin cuenta)
async function darAcceso(id: string, email: string, password: string, telefono: string | null | undefined) {
  const ar = await authAdmin("admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) });
  if (!ar.ok) return { error: errorAuth(ar.status, await ar.text()) };
  const authUser = await ar.json();
  const pr = await sbRest(`usuarios?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ email, auth_id: authUser.id, ...(telefono ? { telefono } : {}), updated_at: new Date().toISOString() }),
  });
  if (!pr.ok) {
    await authAdmin(`admin/users/${authUser.id}`, { method: "DELETE" });
    return { error: `Usuarios: ${pr.status} ${await pr.text()}` };
  }
  const conAcceso = (await pr.json())?.[0];
  if (conAcceso) await bienvenida(conAcceso);
  return { usuario: conAcceso };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const admin = await requireAdmin(req);
    if (!admin) return json({ ok: false, error: "No autorizado" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "listar") {
      const r = await sbRest("usuarios?select=id,email,nombre,rol,activo,auth_id,eventual,telefono,whatsapp_avisos,acceso_app,areas_direccion,created_at&order=nombre.asc");
      return json({ ok: true, usuarios: await r.json() });
    }

    if (action === "crear") {
      const email = String(body.email || "").trim().toLowerCase();
      const nombre = String(body.nombre || "").trim();
      const password = String(body.password || "");
      // #49: tipo = principal | apoyo | admin (si no viene, se usa rol como antes)
      // ACCESOS: tipo también puede ser «oficina»; direccion = no | algunas | todas; areas; acceso_app
      const esAdmin = body.tipo === "admin" || body.direccion === "todas" || (body.tipo === undefined && body.rol === "admin");
      const rol = esAdmin ? "admin" : body.tipo === "oficina" ? "colaborador" : "trabajadora";
      const tp = esAdmin ? null : tipoPatch(body.tipo);
      let areas: string[] | null = null;
      if (!esAdmin && body.direccion === "algunas") {
        const a = leerAreas(body.areas);
        if (a === "invalido") return json({ ok: false, error: "Área del panel no válida" }, 400);
        if (!a.length) return json({ ok: false, error: SIN_AREAS }, 400);
        areas = a;
      }
      if (rol === "colaborador" && !areas) return json({ ok: false, error: "Sin puesto en tienda solo puede entrar en el panel: " + SIN_AREAS.toLowerCase() }, 400);
      const acceso_app = rol === "colaborador" ? false : body.acceso_app !== false;
      if (!acceso_app && rol !== "admin" && !areas) return json({ ok: false, error: "Sin app ni panel de dirección no podría entrar en ningún sitio" }, 400);
      const telefono = normTel(body.telefono); // TEL
      if (!email || !nombre || password.length < 8)
        return json({ ok: false, error: "Email, nombre y contrasena (min. 8) obligatorios" }, 400);
      if (!telefono) return json({ ok: false, error: "Falta el teléfono móvil (para los avisos por WhatsApp)" }, 400);
      if (telefono === "invalido") return json({ ok: false, error: TEL_ERROR }, 400);
      if (!(await emailLibre(email))) return json({ ok: false, error: EMAIL_YA }, 400);
      const ar = await authAdmin("admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, email_confirm: true }),
      });
      if (!ar.ok) return json({ ok: false, error: errorAuth(ar.status, await ar.text()) }, 400);
      const authUser = await ar.json();
      const ir = await sbRest("usuarios", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ email, nombre, rol, activo: true, auth_id: authUser.id, telefono, acceso_app, areas_direccion: areas, ...(tp || {}) }),
      });
      if (!ir.ok) {
        await authAdmin(`admin/users/${authUser.id}`, { method: "DELETE" });
        return json({ ok: false, error: `Usuarios: ${ir.status} ${await ir.text()}` }, 400);
      }
      const nuevo = (await ir.json())?.[0];
      if (nuevo) await bienvenida(nuevo);
      return json({ ok: true, usuario: nuevo });
    }

    if (action === "crear_eventual") {
      const nombre = String(body.nombre || "").trim();
      if (!nombre) return json({ ok: false, error: "Nombre obligatorio" }, 400);
      const telefono = normTel(body.telefono); // TEL (opcional aquí)
      if (telefono === "invalido") return json({ ok: false, error: TEL_ERROR }, 400);
      // #49: «Darle acceso a la app ahora» → email, contraseña y móvil obligatorios
      const conAcceso = body.acceso === true;
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (conAcceso) {
        if (!email || password.length < 8)
          return json({ ok: false, error: "Email y contrasena (min. 8) obligatorios" }, 400);
        if (!telefono) return json({ ok: false, error: "Falta el teléfono móvil (para los avisos por WhatsApp)" }, 400);
        if (!(await emailLibre(email))) return json({ ok: false, error: EMAIL_YA }, 400);
      }
      const ir = await sbRest("usuarios", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ nombre, rol: "trabajadora", activo: true, eventual: true, ...(telefono ? { telefono } : {}) }),
      });
      if (!ir.ok) return json({ ok: false, error: `Usuarios: ${ir.status} ${await ir.text()}` }, 400);
      let nueva = (await ir.json())?.[0];
      if (conAcceso && nueva) {
        const r = await darAcceso(nueva.id, email, password, telefono);
        if (r.error) {
          // sin cuenta no se deja a medias: se quita la ficha recién creada
          await sbRest(`usuarios?id=eq.${nueva.id}`, { method: "DELETE" });
          return json({ ok: false, error: r.error }, 400);
        }
        nueva = r.usuario;
      }
      return json({ ok: true, usuario: nueva });
    }

    // BOLSA: dar login a una eventual que ya existe
    if (action === "dar_acceso_eventual") {
      const id = body.id;
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const telefono = normTel(body.telefono); // TEL
      if (!id || !email || password.length < 8)
        return json({ ok: false, error: "Email y contrasena (min. 8) obligatorios" }, 400);
      if (telefono === "invalido") return json({ ok: false, error: TEL_ERROR }, 400);
      const ur = await sbRest(`usuarios?select=id,eventual,auth_id&id=eq.${id}`);
      const u = (await ur.json())?.[0];
      if (!u || u.eventual !== true) return json({ ok: false, error: "Solo para personas eventuales" }, 400);
      if (u.auth_id) return json({ ok: false, error: "Esta persona ya tiene acceso" }, 400);
      if (!(await emailLibre(email, id))) return json({ ok: false, error: EMAIL_YA }, 400);
      const r = await darAcceso(id, email, password, telefono);
      if (r.error) return json({ ok: false, error: r.error }, 400);
      return json({ ok: true, usuario: r.usuario });
    }

    // BOLSA: quitar el login a una eventual (sigue existiendo para asignarle turnos a mano)
    if (action === "quitar_acceso_eventual") {
      const id = body.id;
      if (!id) return json({ ok: false, error: "Falta id" }, 400);
      const ur = await sbRest(`usuarios?select=eventual,auth_id&id=eq.${id}`);
      const u = (await ur.json())?.[0];
      if (!u || u.eventual !== true) return json({ ok: false, error: "Solo para personas eventuales" }, 400);
      if (u.auth_id) await authAdmin(`admin/users/${u.auth_id}`, { method: "DELETE" });
      const pr = await sbRest(`usuarios?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ auth_id: null, updated_at: new Date().toISOString() }),
      });
      if (!pr.ok) return json({ ok: false, error: await pr.text() }, 400);
      return json({ ok: true });
    }

    if (action === "eliminar_eventual") {
      const id = body.id;
      if (!id) return json({ ok: false, error: "Falta id" }, 400);
      if (id === admin.id) return json({ ok: false, error: "No puedes borrar tu propia cuenta" }, 400); // #49
      const ur = await sbRest(`usuarios?select=eventual,auth_id&id=eq.${id}`);
      const u = (await ur.json())?.[0];
      if (!u || u.eventual !== true) return json({ ok: false, error: "Solo se pueden eliminar eventuales" }, 400);
      // #49: sus turnos futuros salen a la bolsa antes de borrar
      const lz = await lanzarTurnosABolsa(id);
      if (!lz.ok) return json({ ok: false, error: lz.error }, 400);
      await sbRest(`horarios?usuario_id=eq.${id}`, { method: "DELETE" });
      await sbRest(`vacaciones_solicitudes?usuario_id=eq.${id}`, { method: "DELETE" });
      await sbRest(`vacaciones_saldo?usuario_id=eq.${id}`, { method: "DELETE" });
      const dr = await sbRest(`usuarios?id=eq.${id}`, { method: "DELETE" });
      if (!dr.ok) return json({ ok: false, error: await dr.text() }, 400);
      if (u.auth_id) await authAdmin(`admin/users/${u.auth_id}`, { method: "DELETE" }); // BOLSA
      return json({ ok: true, lanzados: lz.n || 0 });
    }

    if (action === "actualizar") {
      const id = body.id;
      if (!id) return json({ ok: false, error: "Falta id" }, 400);
      const tr = await sbRest(`usuarios?select=id,rol,eventual,auth_id,email,tipo_turno,acceso_app,areas_direccion&id=eq.${id}`);
      const destino = (await tr.json())?.[0];
      if (!destino) return json({ ok: false, error: "Persona no encontrada" }, 404);
      const esYo = id === admin.id;
      // #49: nadie puede desactivarse ni quitarse el acceso de dirección a sí mismo
      if (esYo && (body.activo === false || body.rol === "trabajadora" || body.rol === "colaborador" || (body.direccion !== undefined && body.direccion !== "todas")))
        return json({ ok: false, error: "No puedes desactivar tu cuenta ni quitarte el acceso de dirección" }, 400);

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.nombre === "string") {
        if (!body.nombre.trim()) return json({ ok: false, error: "El nombre no puede estar vacío" }, 400);
        patch.nombre = body.nombre.trim();
      }
      if (body.rol === "admin" || body.rol === "trabajadora") patch.rol = body.rol;
      if (typeof body.activo === "boolean") patch.activo = body.activo;
      const telefono = normTel(body.telefono); // TEL
      if (telefono === "invalido") return json({ ok: false, error: TEL_ERROR }, 400);
      if (telefono !== undefined) patch.telefono = telefono;
      if (typeof body.whatsapp_avisos === "boolean") patch.whatsapp_avisos = body.whatsapp_avisos;

      // ACCESOS: panel de dirección (no | algunas | todas) y app de tienda
      const tieneTienda = (tipo: unknown) => tipo === "principal" || tipo === "apoyo" || tipo === "eventual";
      if (body.direccion !== undefined) {
        if (body.direccion === "todas") { patch.rol = "admin"; patch.areas_direccion = null; }
        else if (body.direccion === "algunas" || body.direccion === "no") {
          if (body.direccion === "algunas") {
            const a = leerAreas(body.areas);
            if (a === "invalido") return json({ ok: false, error: "Área del panel no válida" }, 400);
            if (!a.length) return json({ ok: false, error: SIN_AREAS }, 400);
            patch.areas_direccion = a;
          } else patch.areas_direccion = null;
          // deja de ser dirección completa: vuelve a su puesto (si no tiene, sin puesto en tienda)
          if (destino.rol === "admin") patch.rol = tieneTienda(body.tipo) || destino.tipo_turno || destino.eventual ? "trabajadora" : "colaborador";
        } else return json({ ok: false, error: "Acceso al panel no válido" }, 400);
      }
      if (typeof body.acceso_app === "boolean") patch.acceso_app = body.acceso_app;

      // #49: tipo de puesto (solo trabajadoras) · ACCESOS: «oficina» = sin puesto en tienda
      if (body.tipo !== undefined) {
        const tp = tipoPatch(body.tipo);
        if (!tp) return json({ ok: false, error: "Tipo de puesto no válido" }, 400);
        const rolFinal = patch.rol ?? destino.rol;
        if (rolFinal === "admin") return json({ ok: false, error: "El tipo de puesto no aplica a dirección" }, 400);
        Object.assign(patch, tp);
        patch.rol = body.tipo === "oficina" ? "colaborador" : "trabajadora";
      }

      // ACCESOS: comprobaciones del resultado final
      const rolFinal = (patch.rol ?? destino.rol) as string;
      const areasFinal = (patch.areas_direccion !== undefined ? patch.areas_direccion : destino.areas_direccion) as string[] | null;
      if (rolFinal === "admin" && patch.areas_direccion === undefined && destino.areas_direccion) patch.areas_direccion = null;
      if (rolFinal === "colaborador") {
        patch.acceso_app = false;
        if (!(areasFinal || []).length) return json({ ok: false, error: "Sin puesto en tienda solo puede entrar en el panel: " + SIN_AREAS.toLowerCase() }, 400);
      }
      const appFinal = patch.acceso_app !== undefined ? patch.acceso_app : destino.acceso_app !== false;
      if (!appFinal && rolFinal !== "admin" && !(areasFinal || []).length)
        return json({ ok: false, error: "Sin app ni panel de dirección no podría entrar en ningún sitio" }, 400);

      // #49: email de entrada (cambia también el de Auth)
      let emailNuevo: string | null = null;
      if (typeof body.email === "string" && body.email.trim().toLowerCase() !== (destino.email || "").toLowerCase()) {
        emailNuevo = body.email.trim().toLowerCase();
        if (!/\S+@\S+\.\S+/.test(emailNuevo)) return json({ ok: false, error: "Email no válido" }, 400);
        if (!destino.auth_id) return json({ ok: false, error: "Esta persona no tiene acceso a la app: dale acceso primero" }, 400);
        if (!(await emailLibre(emailNuevo, id))) return json({ ok: false, error: EMAIL_YA }, 400);
        patch.email = emailNuevo;
      }

      // #49: al desactivar, los turnos futuros se mantienen o salen a la bolsa
      let lanzados = 0;
      if (body.activo === false && body.turnos === "bolsa") {
        const lz = await lanzarTurnosABolsa(id);
        if (!lz.ok) return json({ ok: false, error: lz.error }, 400);
        lanzados = lz.n || 0;
      }

      if (emailNuevo) {
        const er = await authAdmin(`admin/users/${destino.auth_id}`, { method: "PUT", body: JSON.stringify({ email: emailNuevo, email_confirm: true }) });
        if (!er.ok) return json({ ok: false, error: errorAuth(er.status, await er.text()) }, 400);
      }
      const r = await sbRest(`usuarios?id=eq.${id}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        if (emailNuevo) await authAdmin(`admin/users/${destino.auth_id}`, { method: "PUT", body: JSON.stringify({ email: destino.email, email_confirm: true }) });
        return json({ ok: false, error: await r.text() }, 400);
      }
      const updated = (await r.json())?.[0];
      if (typeof body.activo === "boolean" && updated?.auth_id) {
        await authAdmin(`admin/users/${updated.auth_id}`, {
          method: "PUT",
          body: JSON.stringify({ ban_duration: body.activo ? "none" : "876000h" }),
        });
      }
      return json({ ok: true, usuario: updated, lanzados });
    }

    if (action === "resetear_password") {
      const id = body.id;
      const password = String(body.password || "");
      if (!id || password.length < 8)
        return json({ ok: false, error: "id y contrasena (min. 8) obligatorios" }, 400);
      const ur = await sbRest(`usuarios?select=auth_id&id=eq.${id}`);
      const u = (await ur.json())?.[0];
      if (!u?.auth_id) return json({ ok: false, error: "Usuario sin cuenta de Auth" }, 400);
      const r = await authAdmin(`admin/users/${u.auth_id}`, {
        method: "PUT",
        body: JSON.stringify({ password }),
      });
      if (!r.ok) return json({ ok: false, error: await r.text() }, 400);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Accion no reconocida" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500);
  }
});
