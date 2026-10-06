// Datos de Producto compartidos por todas las subpáginas: catálogo y resumen (de Epos),
// escritura en Epos (vía la función epos-producto) y reglas de avisos y sugerencias.
import { useEffect, useState } from "react";
import { supabase, sb } from "../../../src/lib/supabase.js";
import { initTips } from "../charts.js";
import { num } from "../fmt.js";

export const FAMILIAS = ["Bollería", "Bebidas", "Snacks y chuches", "Tabaco y vapers", "Bocatas y frío", "Pan", "Alimentación y hogar", "Helados", "Cromos y papelería", "Sin clasificar"];
export const COLOR_FAM = { "Bollería": "#D9822B", "Bebidas": "#3D6E9E", "Snacks y chuches": "#B2412A", "Tabaco y vapers": "#5C6670", "Bocatas y frío": "#317039", "Pan": "#C59A3D", "Alimentación y hogar": "#7A5E9E", "Helados": "#2E8C8C", "Cromos y papelería": "#9E5E7A", "Sin clasificar": "#A9AFB4" };
export const ESTADOS = [{ id: "novedad", t: "Novedad" }, { id: "fijo", t: "Fijo" }, { id: "temporada", t: "Temporada" }, { id: "retirar", t: "A retirar" }];
export const n0 = (v) => Number(v) || 0;
export const r0 = (v) => Math.round(n0(v));
export const margenPct = (vs, c) => (n0(vs) > 0 ? ((n0(vs) - n0(c)) / n0(vs)) * 100 : null);
export const varPct = (a, b) => (n0(b) > 0 ? ((n0(a) - n0(b)) / n0(b)) * 100 : null);
// margen unitario a partir de precio con IVA y coste sin IVA
export const margenUnit = (pvp, coste, iva) => { const s = n0(pvp) / (1 + n0(iva) / 100); return s > 0 && n0(coste) > 0 ? ((s - n0(coste)) / s) * 100 : null; };

// ---------- almacén compartido ----------
const FN = { resumen: "dash_producto", catalogo: "dash_catalogo" };
const store = { resumen: { d: null, fallo: false, t: 0 }, catalogo: { d: null, fallo: false, t: 0 }, ultimo: null };
const subs = new Set();
const avisarCambio = () => subs.forEach((f) => f());
const enCurso = {};
export function cargar(clave) {
  if (enCurso[clave]) return enCurso[clave];
  enCurso[clave] = (async () => {
    const { data, error } = await supabase.rpc(FN[clave]);
    if (error) { if (!store[clave].d) store[clave] = { ...store[clave], fallo: true }; }
    else store[clave] = { d: data, fallo: false, t: Date.now() };
    enCurso[clave] = null; avisarCambio();
  })();
  return enCurso[clave];
}
export function useDatos(clave) {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    subs.add(f); initTips(document.body);
    if (!store[clave].d || Date.now() - store[clave].t > 10 * 60 * 1000) cargar(clave);
    const t = setInterval(() => { if (!document.hidden) cargar(clave); }, 10 * 60 * 1000);
    return () => { subs.delete(f); clearInterval(t); };
  }, [clave]);
  return store[clave];
}
export function useUltimo() { const [, set] = useState(0); useEffect(() => { const f = () => set((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []); return store.ultimo; }

// Refleja un cambio en el catálogo cargado sin esperar a recargar
function parchear(id, campos) {
  const C = store.catalogo.d; if (!C) return;
  const i = C.productos.findIndex((p) => p.id === id); if (i < 0) return;
  if (campos.archivado) { C.productos = C.productos.filter((p) => p.id !== id); return; }
  const p = { ...C.productos[i] };
  for (const [k, v] of Object.entries(campos)) {
    if (k === "nombre") p.n = v;
    if (k === "categoria_id") { const c = (C.categorias || []).find((x) => x.id === Number(v)); p.cat_id = v ? Number(v) : null; p.cat = c?.n ?? null; p.fam = c?.fam ?? "Sin clasificar"; }
    if (k === "proveedor_id") { const s = (C.proveedores || []).find((x) => x.id === Number(v)); p.prov_id = v ? Number(v) : null; p.prov = s?.n ?? null; }
    if (k === "coste") p.cost = n0(v);
    if (k === "pvp") p.pvp = n0(v);
    if (k === "codigo") { p.cod = v || null; p.bc = !!v; }
    if (k === "iva_id") { const t = (C.iva || []).find((x) => x.id === Number(v)); p.iva_id = v ? Number(v) : null; p.iva = t?.pct ?? null; }
  }
  C.productos = [...C.productos]; C.productos[i] = p;
}
const recargarPronto = () => setTimeout(() => cargar("catalogo"), 1200);

// cambios: [{ id, campos: { nombre, categoria_id, proveedor_id, coste, pvp, codigo, iva_id, archivado } }]
export async function guardarCambios(cambios, texto) {
  const r = await sb.fn("epos-producto", { accion: "actualizar", cambios });
  cambios.forEach((c) => parchear(c.id, c.campos));
  store.ultimo = r.lote ? { lote: r.lote, texto: texto || `Guardado en Epos (${num(r.ok)} producto${r.ok === 1 ? "" : "s"})`, t: Date.now() } : null;
  avisarCambio(); recargarPronto();
  return r;
}
export async function deshacer(lote) {
  const r = await sb.fn("epos-producto", { accion: "deshacer", lote });
  store.ultimo = null; avisarCambio();
  await cargar("catalogo");
  return r;
}
export function olvidarUltimo() { store.ultimo = null; avisarCambio(); }
export async function crearProducto(producto) {
  const r = await sb.fn("epos-producto", { accion: "crear", producto });
  await cargar("catalogo");
  return r.producto;
}
export async function crearCategoria(nombre) {
  const r = await sb.fn("epos-producto", { accion: "crear_categoria", nombre });
  const C = store.catalogo.d; if (C) { C.categorias = [...(C.categorias || []), { id: r.id, n: r.nombre, padre: null, fam: "Alimentación y hogar" }]; avisarCambio(); }
  return r;
}
export async function crearProveedor(nombre) {
  const r = await sb.fn("epos-producto", { accion: "crear_proveedor", nombre });
  const C = store.catalogo.d; if (C) { C.proveedores = [...(C.proveedores || []), { id: r.id, n: r.nombre }].sort((a, b) => a.n.localeCompare(b.n)); avisarCambio(); }
  return r;
}
// Datos propios del panel (Epos no los tiene)
export async function guardarFicha(id, x) {
  const fila = { product_id: id, unidades_caja: x.uc ? Number(x.uc) : null, coste_caja: x.cc ? (String(x.cc).includes(",") ? Number(String(x.cc).split(".").join("").replace(",", ".")) : Number(x.cc)) || null : null, ubicacion: x.ub || null, stock_minimo: x.sm ? Number(x.sm) : null, estado: x.es || null, notas: x.no || null, actualizado_en: new Date().toISOString() };
  await sb.upsert("producto_ficha", fila, "product_id");
  const C = store.catalogo.d; const p = C?.productos.find((q) => q.id === id);
  if (p) { const lim = Object.fromEntries(Object.entries({ uc: fila.unidades_caja, cc: fila.coste_caja, ub: fila.ubicacion, sm: fila.stock_minimo, es: fila.estado, no: fila.notas }).filter(([, v]) => v != null)); p.x = Object.keys(lim).length ? lim : undefined; C.productos = [...C.productos]; avisarCambio(); }
}

// ---------- avisos de cada producto ----------
export function senales(p) {
  const s = [];
  if (p.d28 >= 20 && n0(p.u2) === 0 && n0(p.uh) === 0) s.push({ id: "rotura", t: "Posible rotura", tono: "mal", tip: `Se vendía casi a diario (${p.d28} de 28 días) y no se ha vendido ni ayer, ni anteayer, ni hoy` });
  if (n0(p.v) > 0 && n0(p.cost) === 0) s.push({ id: "sincoste", t: "Sin coste", tono: "mal", tip: "Sin precio de coste en Epos: su margen no se puede calcular" });
  const m = margenPct(p.vs, p.c);
  if (m != null && n0(p.c) > 0 && m < 0) s.push({ id: "negativo", t: "Pierde dinero", tono: "mal", tip: `Margen ${num(m, 1)} %` });
  else if (m != null && n0(p.c) > 0 && m < 15) s.push({ id: "margen", t: "Margen bajo", tono: "aviso", tip: `Margen ${num(m, 1)} %` });
  if (n0(p.v90) > 0 && p.iva_id == null) s.push({ id: "siniva", t: "Sin IVA", tono: "mal", tip: "Sin grupo de IVA en Epos: se vende sin repercutir IVA" });
  if (n0(p.v) > 0 && !p.prov_id) s.push({ id: "sinprov", t: "Sin proveedor", tono: "aviso", tip: "Sin proveedor asignado en Epos" });
  if (n0(p.v90) > 0 && !p.cat_id) s.push({ id: "sincat", t: "Sin categoría", tono: "aviso", tip: "Sin categoría en Epos" });
  if ((p.abc === "A" || p.abc === "B") && !p.bc) s.push({ id: "sinbc", t: "Sin código", tono: "aviso", tip: "Sin código de barras: se cobra a mano y es más fácil equivocarse" });
  return s;
}
export const tiene = (p, id) => (id === "dormidos" ? p.abc === "D" : senales(p).some((s) => s.id === id));

// ---------- sugerencias ----------
const VACIAS = new Set(["DE", "DEL", "LA", "EL", "LOS", "LAS", "CON", "SIN", "Y", "EN", "AL", "PARA", "LATA", "BOTELLA", "PACK", "ZERO", "CERO", "SABOR", "GR", "ML", "CL", "UD", "UDS", "BOLSA", "OFERTA", "NUEVO", "NUEVA", "MINI", "MAXI", "GRANDE", "PEQUEÑO", "EXTRA", "SUPER", "PRODUCTO", "PRODUCTOS", "VARIOS", "VARIAS", "PROMO", "UNIDAD", "UNIDADES", "SOBRE", "CAJA"]);
const limpio = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9Ñ ]+/g, " ");
function claves(nombre) {
  const t = limpio(nombre).split(/\s+/).filter((w) => w.length >= 3 && !VACIAS.has(w) && !/^\d/.test(w));
  const out = []; if (t.length >= 2) out.push(`${t[0]} ${t[1]}`); if (t.length) out.push(t[0]);
  return out;
}
function indice(ps, campo) {
  const m = new Map();
  for (const p of ps) { const v = p[campo]; if (v == null) continue; for (const k of claves(p.n)) { const o = m.get(k) || new Map(); o.set(v, (o.get(v) || 0) + 1); m.set(k, o); } }
  return m;
}
function votar(m, nombre, minN = 2, minShare = 0.7) {
  for (const k of claves(nombre)) {
    const o = m.get(k); if (!o) continue;
    const tot = [...o.values()].reduce((s, x) => s + x, 0);
    const [v, c] = [...o].sort((a, b) => b[1] - a[1])[0];
    if (c >= minN && c / tot >= minShare) return { v, por: k, n: c };
  }
  return null;
}
const mediana = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

// Devuelve funciones que sugieren proveedor, categoría, IVA y coste para un producto
let cacheSug = { ref: null, f: null };
export function sugeridor(C) {
  if (!C) return null;
  if (cacheSug.ref === C.productos) return cacheSug.f;
  const ps = C.productos;
  const iProv = indice(ps, "prov_id"), iCat = indice(ps, "cat_id"), iIva = indice(ps, "iva_id");
  // IVA más habitual por categoría y margen típico por categoría / familia
  const ivaCat = new Map(), mCat = new Map(), mFam = new Map();
  for (const p of ps) {
    if (p.cat_id && p.iva_id) { const o = ivaCat.get(p.cat_id) || new Map(); o.set(p.iva_id, (o.get(p.iva_id) || 0) + 1); ivaCat.set(p.cat_id, o); }
    const m = margenUnit(p.pvp, p.cost, p.iva ?? 10);
    if (m != null && m > 0 && m < 80 && n0(p.v90) > 0) { if (p.cat_id) (mCat.get(p.cat_id) || mCat.set(p.cat_id, []).get(p.cat_id)).push(m); (mFam.get(p.fam) || mFam.set(p.fam, []).get(p.fam)).push(m); }
  }
  const nomProv = new Map((C.proveedores || []).map((x) => [x.id, x.n])), nomCat = new Map((C.categorias || []).map((x) => [x.id, x.n])), nomIva = new Map((C.iva || []).map((x) => [x.id, x]));
  const f = {
    prov(p) { const r = votar(iProv, p.n); return r && { id: r.v, n: nomProv.get(r.v), por: r.por, cuantos: r.n }; },
    cat(p) { const r = votar(iCat, p.n); return r && { id: r.v, n: nomCat.get(r.v), por: r.por, cuantos: r.n }; },
    iva(p) {
      const o = p.cat_id && ivaCat.get(p.cat_id);
      if (o) { const tot = [...o.values()].reduce((s, x) => s + x, 0); const [v, c] = [...o].sort((a, b) => b[1] - a[1])[0]; if (c >= 3 && c / tot >= 0.7) { const t = nomIva.get(v); return t && { id: v, n: t.n, pct: t.pct, por: `${p.cat}` }; } }
      const r = votar(iIva, p.n); if (r) { const t = nomIva.get(r.v); return t && { id: r.v, n: t.n, pct: t.pct, por: r.por }; }
      return null;
    },
    coste(p) {
      const arr = (p.cat_id && mCat.get(p.cat_id)?.length >= 4 ? mCat.get(p.cat_id) : mFam.get(p.fam)) || [];
      const m = mediana(arr); if (m == null || !(n0(p.pvp) > 0)) return null;
      const iva = p.iva ?? 10;
      return { coste: Math.round((n0(p.pvp) / (1 + iva / 100)) * (1 - m / 100) * 100) / 100, margen: m };
    },
  };
  cacheSug = { ref: ps, f };
  return f;
}
