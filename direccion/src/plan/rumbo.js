// Rumbo: las dos métricas del trimestre, el roadmap en tres columnas y las reuniones de dirección.
import { useEffect, useState } from "react";
import { sb, supabase } from "../../../src/lib/supabase.js";

export const COLUMNAS = [
  { id: "ahora", label: "Ahora", sub: "Máximo 2 por persona" },
  { id: "siguiente", label: "Siguiente", sub: "Lo próximo, cuando algo de «Ahora» acabe" },
  { id: "mas_adelante", label: "Más adelante", sub: "Ideas con sentido, sin fecha" },
];
export const MAX_AHORA = 2;
export const DIAS_GRIS = 14; // una tarjeta sin tocar en 14 días se apaga

// Métricas que puede mover un proyecto. Las dos primeras son las del trimestre; el resto, las de cada área.
export const METRICAS = [
  { id: "facturacion", label: "Facturación (€/día)", corta: "Facturación", principal: true },
  { id: "margen", label: "Margen bruto %", corta: "Margen", principal: true },
  { id: "tickets", label: "Tickets por día", corta: "Tickets" },
  { id: "recurrencia", label: "Recurrencia de clientes", corta: "Recurrencia" },
  { id: "coste_personal", label: "Coste de personal sobre venta", corta: "Coste personal" },
  { id: "resultado", label: "Resultado real (cierre de mes)", corta: "Resultado" },
];
export const METRICA = Object.fromEntries(METRICAS.map((m) => [m.id, m]));

// Socio de la persona que ha entrado (para firmar puntos de las reuniones)
export function socioDe(user) {
  const n = String(user?.nombre || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().split(" ")[0];
  return { adrian: "Adrian", pablo: "Pablo", javi: "Javi", javier: "Javi", miguel: "Migue", migue: "Migue" }[n] || null;
}

export const diasDesde = (ts) => (ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000) : 999);

// ---- métricas ----
let cache = null; let pidiendo = null;
export async function cargarMetricas(forzar = false) {
  if (cache && !forzar) return cache;
  if (!pidiendo) pidiendo = sb.rpc("plan_metricas").then((r) => { cache = r; return r; }).finally(() => { pidiendo = null; });
  return pidiendo;
}
export function useMetricas() {
  const [m, setM] = useState(cache);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    const ir = (f) => cargarMetricas(f).then((r) => vivo && (setM(r), setError(false))).catch(() => vivo && setError(true));
    ir(false);
    const t = setInterval(() => { if (!document.hidden) ir(true); }, 5 * 60000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  return { m, error, recargar: () => cargarMetricas(true).then(setM) };
}
export async function guardarConfig({ suelo, horizonte, objetivo }) {
  await sb.rpc("plan_config_guardar", { p_suelo: suelo === "" || suelo == null ? null : Number(suelo), p_horizonte: horizonte || null, p_objetivo: objetivo === "" || objetivo == null ? null : Number(objetivo) });
  return cargarMetricas(true);
}

// Lectura de las dos métricas en una foto simple (la que se guarda al cerrar una reunión)
export function fotoMetricas(m) {
  if (!m) return null;
  const suelo = Number(m.config?.plan_margen_suelo) || 37;
  return {
    fecha: m.hoy,
    por_dia: m.mes?.por_dia ?? null, por_dia_anterior: m.anterior?.por_dia ?? null,
    margen_pct: m.mes?.margen_pct ?? null, margen_pct_anterior: m.anterior?.margen_pct ?? null, suelo,
  };
}

// ---- reuniones ----
export const TIPOS_PUNTO = {
  bloqueo: { label: "Bloqueo", pide: "Necesito de alguien…", icono: "⛔" },
  decision: { label: "Decisión", pide: "Hay que decidir…", icono: "⚖️" },
  acuerdo: { label: "Acuerdo", pide: "Acordamos que…", icono: "✅" },
};
export const PASOS = [
  { id: "metricas", n: 1, label: "Métricas", min: 5, ayuda: "Se miran aquí. Nadie las cuenta." },
  { id: "personas", n: 2, label: "Estado por persona", min: 30, ayuda: "La pantalla enseña el estado de cada uno. Solo se comenta lo que está en rojo y lo que alguien necesita de los demás." },
  { id: "acuerdos", n: 3, label: "Acuerdos", min: 10, ayuda: "Cada uno con responsable y fecha. Al cerrar, pasan a Tareas." },
];

export const reuniones = {
  lista: () => sb.select("dir_reuniones", "select=id,fecha,tipo,estado,cerrada_en,empezada_en,acta_estado,audio_path&order=fecha.desc&limit=60"),
  una: async (id) => (await sb.select("dir_reuniones", `select=*&id=eq.${id}`))[0] || null,
  crear: async (datos) => { const r = await sb.insert("dir_reuniones", datos); return Array.isArray(r) ? r[0] : r; },
  guardar: (id, patch) => sb.update("dir_reuniones", `id=eq.${id}`, patch),
  borrar: async (id, audioPath) => {
    if (audioPath) { try { await supabase.storage.from("reuniones").remove([audioPath]); } catch (_) { /* el audio se queda; no impide borrar */ } }
    return sb.delete("dir_reuniones", `id=eq.${id}`);
  },
  puntos: (id) => sb.select("dir_reunion_puntos", `select=*&reunion_id=eq.${id}&order=creado_en.asc`),
  todosAbiertos: () => sb.select("dir_reunion_puntos", "select=id,tipo,reunion_id,estado&estado=eq.abierto&tipo=in.(bloqueo,decision)"),
  nuevoPunto: async (datos) => { const r = await sb.insert("dir_reunion_puntos", datos); return Array.isArray(r) ? r[0] : r; },
  guardarPunto: (id, patch) => sb.update("dir_reunion_puntos", `id=eq.${id}`, patch),
  borrarPunto: (id) => sb.delete("dir_reunion_puntos", `id=eq.${id}`),
  // Una reunión se abre cuando se quiera (fecha de hoy); si ya hay una abierta, se devuelve esa.
  // Los bloqueos que quedaron sin resolver en reuniones cerradas pasan a la nueva.
  nueva: () => sb.rpc("dir_reunion_nueva"),
  cerrar: (id, metricas) => sb.rpc("dir_reunion_cerrar", { p_id: id, p_metricas: metricas }),
};

// Audio de la reunión: se sube al almacén privado «reuniones» y la función reunion-acta lo transcribe y redacta el acta.
export async function subirAudio(reunionId, blob, nombre) {
  const ext = (String(nombre || "").match(/\.([a-z0-9]{2,5})$/i)?.[1] || (blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm")).toLowerCase();
  const path = `${reunionId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("reuniones").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
  if (error) throw new Error(error.message);
  await reuniones.guardar(reunionId, { audio_path: path, audio_nombre: nombre || `grabacion.${ext}`, acta_estado: "subido", acta_error: null, acta_operacion: null });
  return path;
}
export async function urlAudio(path) {
  const { data } = await supabase.storage.from("reuniones").createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}
export async function acta(accion, reunionId) {
  const { data, error } = await supabase.functions.invoke("reunion-acta", { body: { accion, id: reunionId } });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error; } catch (_) { /* sin cuerpo */ }
    throw new Error(msg);
  }
  return data;
}
