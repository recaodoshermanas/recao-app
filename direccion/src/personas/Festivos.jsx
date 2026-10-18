// Personas · Horarios → Festivos: la lista de festivos que marcan el cuadrante, «Mis horarios» y el plus festivo.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { AMBITOS } from "../../../src/lib/festivos.js";
import { Panel, avisar, fechaCorta, Cargando } from "../ui.jsx";

export function FestivosPanel({ onClose, onCambio }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [lista, setLista] = useState(null);
  const [f, setF] = useState({ fecha: "", nombre: "", ambito: "local" });
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async () => {
    setLista(null);
    try { setLista(await sb.select("festivos", `select=*&activo=eq.true&fecha=gte.${anio}-01-01&fecha=lte.${anio}-12-31&order=fecha.asc`)); }
    catch (e) { setLista([]); avisar("No se han podido cargar los festivos", "mal"); }
  }, [anio]);
  useEffect(() => { cargar(); }, [cargar]);

  const anadir = async () => {
    if (!f.fecha || !f.nombre.trim()) return;
    setBusy(true);
    try {
      await sb.upsert("festivos", { fecha: f.fecha, nombre: f.nombre.trim(), ambito: f.ambito, activo: true }, "fecha");
      avisar("Festivo añadido"); setF({ fecha: "", nombre: "", ambito: "local" });
      if (f.fecha.slice(0, 4) !== String(anio)) setAnio(+f.fecha.slice(0, 4)); else cargar();
      onCambio && onCambio();
    } catch (e) { avisar("No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  const quitar = async (x) => {
    if (!window.confirm(`¿Quitar ${fechaCorta(x.fecha)} (${x.nombre}) de los festivos?`)) return;
    try { await sb.update("festivos", `fecha=eq.${x.fecha}`, { activo: false }); avisar("Quitado de los festivos"); cargar(); onCambio && onCambio(); }
    catch (e) { avisar("No se ha podido", "mal"); }
  };
  const locales = (lista || []).filter((x) => x.ambito === "local").length;

  return (
    <Panel titulo="Festivos" sub="Salen marcados en el cuadrante y en «Mis horarios», y cuentan para el plus festivo" onClose={onClose} ancho="560px">
      <div className="nav-sem" style={{ marginBottom: 12 }}>
        <button className="btn-l" onClick={() => setAnio(anio - 1)} aria-label="Año anterior">‹</button>
        <b style={{ minWidth: 56, textAlign: "center" }}>{anio}</b>
        <button className="btn-l" onClick={() => setAnio(anio + 1)} aria-label="Año siguiente">›</button>
      </div>
      {!lista ? <Cargando /> : (
        <>
          {lista.length === 0 && <p className="empty">No hay festivos apuntados para {anio}.</p>}
          {lista.length > 0 && locales < 2 && <p className="aviso-l">Faltan {2 - locales === 2 ? "los dos festivos locales" : "un festivo local"} de Dos Hermanas de {anio}. El Ayuntamiento los publica en otoño del año anterior.</p>}
          <ul className="pq-l fest-l">
            {lista.map((x) => (
              <li key={x.fecha}>
                <span><b>{fechaCorta(x.fecha)}</b> · {x.nombre}<span className="pf">{AMBITOS[x.ambito]}</span></span>
                <span className="der"><button className="btn-txt peligro" onClick={() => quitar(x)}>Quitar</button></span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="campo-t bloque"><span>Añadir festivo</span></div>
      <div className="fila-campos">
        <label className="campo">Fecha<input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
        <label className="campo">Tipo<select value={f.ambito} onChange={(e) => setF({ ...f, ambito: e.target.value })}>{Object.entries(AMBITOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <label className="campo">Nombre<input value={f.nombre} maxLength={80} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej.: Jueves de Feria" /></label>
      <button className="btn-p" disabled={busy || !f.fecha || !f.nombre.trim()} onClick={anadir}>{busy ? "Guardando…" : "Añadir"}</button>
    </Panel>
  );
}
