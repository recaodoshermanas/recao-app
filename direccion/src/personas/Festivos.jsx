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
  const [ed, setEd] = useState(null); // { orig, fecha, nombre, ambito } del festivo que se corrige
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
  // Corregir fecha, nombre o tipo. Si cambia la fecha: se apunta en la nueva y la antigua queda quitada (activo=false).
  const guardarEd = async () => {
    if (!ed || !ed.fecha || !ed.nombre.trim()) return;
    setBusy(true);
    try {
      if (ed.fecha !== ed.orig) {
        const ya = await sb.select("festivos", `select=fecha&activo=eq.true&fecha=eq.${ed.fecha}`);
        if (ya && ya.length) { avisar("Ya hay un festivo en esa fecha", "mal"); setBusy(false); return; }
      }
      if (ed.fecha === ed.orig) await sb.update("festivos", `fecha=eq.${ed.orig}`, { nombre: ed.nombre.trim(), ambito: ed.ambito });
      else {
        await sb.upsert("festivos", { fecha: ed.fecha, nombre: ed.nombre.trim(), ambito: ed.ambito, activo: true }, "fecha");
        await sb.update("festivos", `fecha=eq.${ed.orig}`, { activo: false });
      }
      avisar("Festivo corregido"); setEd(null);
      if (ed.fecha.slice(0, 4) !== String(anio)) setAnio(+ed.fecha.slice(0, 4)); else cargar();
      onCambio && onCambio();
    } catch (e) { avisar("No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  const locales = (lista || []).filter((x) => x.ambito === "local").length;

  return (
    <Panel titulo="Festivos" sub="Salen marcados en el cuadrante y en «Mis horarios», y cuentan para el plus festivo (también en «Mis turnos» de las eventuales)" onClose={onClose} ancho="560px">
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
            {lista.map((x) => ed && ed.orig === x.fecha ? (
              <li key={x.fecha} style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="fila-campos">
                  <label className="campo">Fecha<input type="date" value={ed.fecha} onChange={(e) => setEd({ ...ed, fecha: e.target.value })} /></label>
                  <label className="campo">Tipo<select value={ed.ambito} onChange={(e) => setEd({ ...ed, ambito: e.target.value })}>{Object.entries(AMBITOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                </div>
                <label className="campo">Nombre<input value={ed.nombre} maxLength={80} onChange={(e) => setEd({ ...ed, nombre: e.target.value })} /></label>
                <span className="der" style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn-txt" onClick={() => setEd(null)} disabled={busy}>Cancelar</button>
                  <button className="btn-p" onClick={guardarEd} disabled={busy || !ed.fecha || !ed.nombre.trim()}>{busy ? "Guardando…" : "Guardar"}</button>
                </span>
              </li>
            ) : (
              <li key={x.fecha}>
                <span><b>{fechaCorta(x.fecha)}</b> · {x.nombre}<span className="pf">{AMBITOS[x.ambito]}</span></span>
                <span className="der" style={{ display: "flex", gap: 10 }}>
                  <button className="btn-txt" onClick={() => setEd({ orig: x.fecha, fecha: x.fecha, nombre: x.nombre, ambito: x.ambito })}>Corregir</button>
                  <button className="btn-txt peligro" onClick={() => quitar(x)}>Quitar</button>
                </span>
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
