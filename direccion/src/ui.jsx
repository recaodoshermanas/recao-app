// Piezas comunes del panel: panel lateral, pestañas, avisos breves, avatar y carga del equipo.
import { useEffect, useState, useCallback, useRef } from "react";
import { sb } from "../../src/lib/supabase.js";

export const n0 = (v) => Number(v) || 0;
export const hoyStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return ymdLocal(d); };
export const fechaCorta = (f) => (f ? new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : "–");
export const fechaDia = (f) => (f ? new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "–");
export const hace = (ts) => {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "ahora"; const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`; const d = Math.floor(h / 24); if (d < 30) return `hace ${d} d`;
  return fechaDia(ts);
};
export const lunesDe = (f) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymdLocal(d); };

// Panel lateral (en móvil, a pantalla completa desde abajo)
export function Panel({ titulo, sub, onClose, children, pie, ancho }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    const prev = document.activeElement; ref.current?.focus();
    document.body.classList.add("con-panel");
    return () => { document.removeEventListener("keydown", k); document.body.classList.remove("con-panel"); prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="panel-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="panel" role="dialog" aria-modal="true" aria-label={typeof titulo === "string" ? titulo : undefined} tabIndex={-1} ref={ref} style={ancho ? { width: ancho } : undefined}>
        <header className="panel-cab">
          <div><h2>{titulo}</h2>{sub && <p className="sub">{sub}</p>}</div>
          <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="panel-cuerpo">{children}</div>
        {pie && <footer className="panel-pie">{pie}</footer>}
      </aside>
    </div>
  );
}

export function Pestanas({ valor, opciones, onChange, etiqueta }) {
  return (
    <div className="seg seg-wrap" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.id} role="tab" aria-selected={valor === o.id} aria-pressed={valor === o.id} onClick={() => onChange(o.id)}>
          {o.label}{o.n != null && o.n > 0 && <span className="cuenta">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

// Mensaje breve abajo ("Guardado", errores…)
let setAvisoGlobal = null;
export function avisar(texto, tipo = "ok") { setAvisoGlobal && setAvisoGlobal({ texto, tipo, t: Date.now() }); }
export function Avisos() {
  const [a, setA] = useState(null);
  useEffect(() => { setAvisoGlobal = setA; return () => { setAvisoGlobal = null; }; }, []);
  useEffect(() => { if (!a) return; const t = setTimeout(() => setA(null), 3200); return () => clearTimeout(t); }, [a]);
  return <div className={`toast ${a ? "on" : ""} ${a?.tipo || ""}`} role="status" aria-live="polite">{a?.texto}</div>;
}

const COLORES = ["#F1BE49", "#7A5E9E", "#317039", "#3D6E9E", "#B2412A", "#D9822B", "#2E8C8C", "#9E5E7A"];
export function colorDe(nombre) { let h = 0; const s = nombre || "?"; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return COLORES[h % COLORES.length]; }
export function Avatar({ nombre, size = 30 }) {
  const bg = colorDe(nombre);
  return <span className="avatar" style={{ width: size, height: size, background: bg, color: bg === "#F1BE49" ? "#1E272E" : "#fff", fontSize: size * 0.42 }} aria-hidden="true">{(nombre || "?").trim().charAt(0).toUpperCase()}</span>;
}

// Equipo (cuentas y eventuales) desde la función gestion-usuarios
let cacheEquipo = null;
export function useEquipo() {
  const [lista, setLista] = useState(cacheEquipo);
  const cargar = useCallback(async () => {
    try {
      const [r, extra] = await Promise.all([
        sb.fn("gestion-usuarios", { action: "listar" }),
        sb.select("usuarios", "select=id,tipo_turno,jornada,telefono").catch(() => []),
      ]);
      const ex = Object.fromEntries((extra || []).map((u) => [u.id, u]));
      cacheEquipo = (r.usuarios || []).map((u) => ({ ...ex[u.id], ...u, tipo_turno: u.tipo_turno ?? ex[u.id]?.tipo_turno, jornada: u.jornada ?? ex[u.id]?.jornada, telefono: u.telefono ?? ex[u.id]?.telefono }))
        .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
      setLista(cacheEquipo);
    }
    catch (e) { if (!cacheEquipo) setLista([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  return { equipo: lista, recargarEquipo: cargar };
}

export function Cargando({ texto = "Cargando…" }) { return <div className="state">{texto}</div>; }

export async function confirmar(texto) { return window.confirm(texto); }

export const ir = (ruta) => { window.location.hash = `#/${ruta}`; };
