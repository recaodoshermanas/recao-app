// Producto · App de tienda (solicitud #35): el texto de «Instrucciones» de cada pantalla de producto de la app
// de trabajadoras y los motivos de cambio de precio (los que crean las trabajadoras se ven, se renombran o se quitan aquí).
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, avisar, hace } from "../ui.jsx";

const ORDEN = ["recepcion", "escanear", "sin_codigo", "anadir", "incidencia", "marcado"];
const msg = (e) => String(e?.message || e || "No se ha podido");

export function AppTienda() {
  const [instr, setInstr] = useState(null);
  const [motivos, setMotivos] = useState(null);
  const [nombres, setNombres] = useState(new Map());
  const cargar = useCallback(async () => {
    try {
      const [i, m, u] = await Promise.all([
        sb.select("producto_instrucciones", "select=*"),
        sb.select("precio_motivos", "select=*&activo=eq.true&order=es_marcado.desc,nombre.asc"),
        sb.select("usuarios", "select=id,nombre"),
      ]);
      setInstr([...(i || [])].sort((a, b) => ORDEN.indexOf(a.pantalla) - ORDEN.indexOf(b.pantalla)));
      setMotivos(m || []);
      setNombres(new Map((u || []).map((x) => [x.id, (x.nombre || "").split(" ")[0]])));
    } catch (e) { avisar(msg(e), "mal"); setInstr((x) => x || []); setMotivos((x) => x || []); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!instr || !motivos) return <Cargando />;
  return (
    <>
      <div className="card mt">
        <div className="head"><div><h2>Instrucciones de cada pantalla</h2><p className="sub">Salen arriba de cada pantalla de producto en la app de trabajadoras, cerradas: se abren al pulsar «Instrucciones». Un paso por línea (mejor 5–7 pasos cortos). Si lo dejas vacío, esa pantalla no muestra instrucciones.</p></div></div>
        {instr.map((x) => <EditarInstr key={x.pantalla} x={x} nombres={nombres} onGuardado={cargar} />)}
      </div>
      <div className="card mt">
        <div className="head"><div><h2>Motivos de cambio de precio</h2><p className="sub">Los que salen en «Escanear producto → Cambiar precio». Las trabajadoras pueden añadir motivos nuevos; aquí los puedes renombrar o quitar. Los cambios ya hechos guardan el motivo con el que se hicieron.</p></div></div>
        {motivos.length === 0 ? <p className="empty">No hay motivos.</p> : motivos.map((m) => <EditarMotivo key={m.id} m={m} nombres={nombres} onGuardado={cargar} />)}
      </div>
    </>
  );
}

function EditarInstr({ x, nombres, onGuardado }) {
  const [texto, setTexto] = useState(x.texto || "");
  const [busy, setBusy] = useState(false);
  const cambiado = texto !== (x.texto || "");
  const pasos = texto.split("\n").filter((l) => l.trim()).length;
  const guardar = async () => {
    setBusy(true);
    try {
      const yo = await sb.rpc("current_usuario_id").catch(() => null);
      const limpio = texto.split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
      await sb.update("producto_instrucciones", `pantalla=eq.${x.pantalla}`, { texto: limpio, actualizado_por: yo || null, actualizado_en: new Date().toISOString() });
      avisar(`Instrucciones de «${x.titulo}» guardadas`); await onGuardado();
    } catch (e) { avisar(msg(e), "mal"); }
    setBusy(false);
  };
  return (
    <div style={{ borderTop: "1px solid var(--line, #EBE3D5)", padding: "14px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <label htmlFor={`in-${x.pantalla}`} style={{ fontWeight: 700 }}>{x.titulo}</label>
        <span className="pf">{pasos} paso{pasos === 1 ? "" : "s"}{x.actualizado_por ? ` · cambiado por ${nombres.get(x.actualizado_por) || "dirección"} ${hace(x.actualizado_en)}` : ""}</span>
      </div>
      <textarea id={`in-${x.pantalla}`} value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.max(4, pasos + 1)} style={{ width: "100%", boxSizing: "border-box", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #D9D0BF", font: "inherit", fontSize: 14, lineHeight: 1.45, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <button className="btn-p" disabled={!cambiado || busy} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>
        {cambiado && <button className="btn-txt" disabled={busy} onClick={() => setTexto(x.texto || "")}>Deshacer</button>}
      </div>
    </div>
  );
}

function EditarMotivo({ m, nombres, onGuardado }) {
  const [nombre, setNombre] = useState(m.nombre);
  const [busy, setBusy] = useState(false);
  const hacer = async (campos, ok) => {
    setBusy(true);
    try { await sb.update("precio_motivos", `id=eq.${m.id}`, campos); avisar(ok); await onGuardado(); }
    catch (e) { avisar(/409|duplicate|unique/i.test(msg(e)) ? "Ya hay otro motivo con ese nombre" : msg(e), "mal"); }
    setBusy(false);
  };
  const limpio = nombre.trim().replace(/\s+/g, " ");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--line, #EBE3D5)", padding: "10px 0" }}>
      <label htmlFor={`mo-${m.id}`} style={{ position: "absolute", left: -9999 }}>Nombre del motivo</label>
      <input id={`mo-${m.id}`} className="mini-input" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} style={{ flex: "1 1 220px", minWidth: 0 }} />
      <span className="pf" style={{ flex: "1 1 180px" }}>{m.es_marcado ? "Fijo: pide el precio marcado y lo guarda en el producto" : m.creado_por ? `Lo añadió ${nombres.get(m.creado_por) || "una trabajadora"} ${hace(m.creado_en)}` : ""}</span>
      <button className="btn-l" disabled={busy || limpio.length < 3 || limpio === m.nombre} onClick={() => hacer({ nombre: limpio }, "Motivo renombrado")}>Renombrar</button>
      {!m.es_marcado && <button className="btn-txt" disabled={busy} onClick={() => { if (window.confirm(`Quita «${m.nombre}» de la lista. Los cambios ya hechos con este motivo lo conservan. ¿Seguimos?`)) hacer({ activo: false }, "Motivo quitado"); }}>Quitar</button>}
    </div>
  );
}
