// Plan: datos compartidos (proyectos y tareas) para todas las vistas del área.
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";

export const AREAS_PLAN = [
  { id: "direccion", label: "Dirección", color: "#1E272E" },
  { id: "personas", label: "Personas", color: "#7A5E9E" },
  { id: "finanzas", label: "Finanzas", color: "#317039" },
  { id: "producto", label: "Producto", color: "#D9822B" },
  { id: "operacion", label: "Tienda y operación", color: "#3D6E9E" },
  { id: "marketing", label: "Marketing", color: "#B2412A" },
  { id: "tecnologia", label: "Tecnología", color: "#2E8C8C" },
];
export const AREA = Object.fromEntries(AREAS_PLAN.map((a) => [a.id, a]));
// Los nombres se guardan como en la app (propietarios); se muestran completos
export const SOCIOS = [
  { id: "Adrian", label: "Adrián", lleva: "marketing y tecnología" },
  { id: "Pablo", label: "Pablo", lleva: "personas y operación" },
  { id: "Javi", label: "Javi", lleva: "producto" },
  { id: "Migue", label: "Miguel", lleva: "finanzas" },
];
export const SOCIO = Object.fromEntries(SOCIOS.map((s) => [s.id, s]));
export const nombreSocio = (id) => SOCIO[id]?.label || id;
export const ESTADOS_T = [
  { id: "pendiente", label: "Por hacer" },
  { id: "en_curso", label: "En curso" },
  { id: "bloqueada", label: "Bloqueada" },
  { id: "hecha", label: "Hecha" },
];
export const ESTADO_T = Object.fromEntries(ESTADOS_T.map((e) => [e.id, e]));
export const PRIORIDADES = [{ id: "alta", label: "Alta" }, { id: "media", label: "Media" }, { id: "baja", label: "Baja" }];
export const ESTADOS_P = [
  { id: "activo", label: "En marcha" }, { id: "idea", label: "Idea" }, { id: "pausado", label: "En pausa" }, { id: "terminado", label: "Terminado" },
];
export const ESTADO_P = Object.fromEntries(ESTADOS_P.map((e) => [e.id, e]));
const PRIO_N = { alta: 0, media: 1, baja: 2 };

export const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const atrasada = (t, hoy = hoyISO()) => t.estado !== "hecha" && t.fecha_fin && t.fecha_fin < hoy;
export const ordenTareas = (a, b) =>
  (a.estado === "hecha") - (b.estado === "hecha") ||
  (a.fecha_fin || "9999").localeCompare(b.fecha_fin || "9999") ||
  (PRIO_N[a.prioridad] ?? 1) - (PRIO_N[b.prioridad] ?? 1) ||
  (a.orden || 0) - (b.orden || 0) || String(a.titulo).localeCompare(String(b.titulo));

// ---- almacén compartido con suscripción ----
let estado = { tareas: null, proyectos: null, comentarios: {}, error: false };
const subs = new Set();
const emitir = () => subs.forEach((f) => f({ ...estado }));
const poner = (cambios) => { estado = { ...estado, ...cambios }; emitir(); };

export async function cargarPlan() {
  try {
    const [t, p, c] = await Promise.all([
      sb.select("tareas_admin", "select=*&order=creado_en.desc"),
      sb.select("proyectos", "select=*&order=creado_en.asc"),
      sb.select("tarea_comentarios", "select=tarea_id"),
    ]);
    const nCom = {}; c.forEach((x) => { nCom[x.tarea_id] = (nCom[x.tarea_id] || 0) + 1; });
    poner({ tareas: t, proyectos: p, nComentarios: nCom, error: false });
  } catch (e) { poner({ tareas: estado.tareas || [], proyectos: estado.proyectos || [], error: true }); }
}

export function usePlan() {
  const [s, setS] = useState(estado);
  useEffect(() => {
    subs.add(setS);
    if (!estado.tareas) cargarPlan();
    const t = setInterval(() => { if (!document.hidden) cargarPlan(); }, 60000);
    return () => { subs.delete(setS); clearInterval(t); };
  }, []);
  return s;
}

const limpiar = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !["id", "creado_en", "creado_por"].includes(k)));

export async function crearTarea(datos) {
  const fila = { titulo: "", estado: "pendiente", prioridad: "media", propietarios: [], checklist: [], ...datos };
  const r = await sb.insert("tareas_admin", fila);
  const nueva = Array.isArray(r) ? r[0] : r;
  poner({ tareas: [nueva, ...(estado.tareas || [])] });
  return nueva;
}
export async function actualizarTarea(id, patch) {
  const antes = estado.tareas;
  poner({ tareas: antes.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  try {
    const r = await sb.update("tareas_admin", `id=eq.${id}`, limpiar(patch));
    const fila = Array.isArray(r) ? r[0] : null;
    if (fila) poner({ tareas: estado.tareas.map((t) => (t.id === id ? fila : t)) });
  } catch (e) { poner({ tareas: antes }); throw e; }
}
export async function borrarTarea(id) {
  const antes = estado.tareas;
  poner({ tareas: antes.filter((t) => t.id !== id) });
  try { await sb.delete("tareas_admin", `id=eq.${id}`); } catch (e) { poner({ tareas: antes }); throw e; }
}
export async function crearProyecto(datos) {
  const r = await sb.insert("proyectos", datos);
  const nuevo = Array.isArray(r) ? r[0] : r;
  poner({ proyectos: [...(estado.proyectos || []), nuevo] });
  return nuevo;
}
export async function actualizarProyecto(id, patch) {
  const antes = estado.proyectos;
  poner({ proyectos: antes.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  try { await sb.update("proyectos", `id=eq.${id}`, limpiar(patch)); } catch (e) { poner({ proyectos: antes }); throw e; }
}
export async function borrarProyecto(id) {
  await sb.delete("proyectos", `id=eq.${id}`);
  poner({ proyectos: estado.proyectos.filter((p) => p.id !== id), tareas: estado.tareas.map((t) => (t.proyecto_id === id ? { ...t, proyecto_id: null } : t)) });
}
export async function comentariosDe(tareaId) {
  return sb.select("tarea_comentarios", `select=*&tarea_id=eq.${tareaId}&order=creado_en.asc`);
}
export async function comentar(tareaId, autor, texto) {
  const r = await sb.insert("tarea_comentarios", { tarea_id: tareaId, autor, texto });
  poner({ nComentarios: { ...(estado.nComentarios || {}), [tareaId]: ((estado.nComentarios || {})[tareaId] || 0) + 1 } });
  return Array.isArray(r) ? r[0] : r;
}
export async function borrarComentario(c) {
  await sb.delete("tarea_comentarios", `id=eq.${c.id}`);
  poner({ nComentarios: { ...(estado.nComentarios || {}), [c.tarea_id]: Math.max(0, ((estado.nComentarios || {})[c.tarea_id] || 1) - 1) } });
}
