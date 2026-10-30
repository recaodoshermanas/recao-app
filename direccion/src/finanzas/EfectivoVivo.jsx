// #84 Finanzas → Efectivo: bloque «Efectivo vivo» (arriba en Caja y en Efectivo de sobres) y «Retiradas del banco por asignar» (en Caja).
// Efectivo vivo = efectivo guardado (solo socios) + caja fuerte + sobres del mes pendientes de abrir.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Panel, avisar, fechaCorta, Cargando, ir } from "../ui.jsx";
import { eur } from "../fmt.js";

// Avisa a las demás partes de la pantalla (caja fuerte, sobres, efectivo vivo) de que algo ha cambiado
export const EVENTO_EFECTIVO = "recao:efectivo";
export const avisarCambioEfectivo = () => { try { window.dispatchEvent(new Event(EVENTO_EFECTIVO)); } catch (e) { /* nada */ } };
export function useCambioEfectivo(fn) {
  useEffect(() => { window.addEventListener(EVENTO_EFECTIVO, fn); return () => window.removeEventListener(EVENTO_EFECTIVO, fn); }, [fn]);
}
export const numeroEur = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; const x = Number(t); return t !== "" && /^\d+(\.\d{1,2})?$/.test(t) && Number.isFinite(x) ? x : NaN; };
const r2 = (x) => Math.round(x * 100) / 100;

export function EfectivoVivo() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  const cargar = useCallback(() => { sb.rpc("efectivo_vivo").then((r) => { setD(r); setFallo(false); }).catch(() => setFallo(true)); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useCambioEfectivo(cargar);
  if (fallo) return null;
  if (!d) return <div className="card" style={{ marginBottom: 16 }}><Cargando /></div>;
  const lineas = [
    d.socio && { k: "guardado", t: "Efectivo guardado", v: d.guardado, s: "«Queda guardado» de Efectivo de sobres", ir: "finanzas/efectivo/sobres" },
    { k: "cf", t: "Caja fuerte", v: d.caja_fuerte, s: "«Queda en la caja fuerte»", ir: "finanzas/efectivo/caja" },
    { k: "sobres", t: "Sobres del mes pendientes de abrir", v: d.sobres_pendientes, s: "Lo metido en los sobres este mes (el esperado de la Apertura de sobres). Pasa a efectivo guardado el día 1.", ir: "finanzas/resultados/cierre" },
  ].filter(Boolean);
  return (
    <div className="card cf" style={{ marginBottom: 16 }}>
        <div className="head"><div><h2>Efectivo vivo</h2><p className="sub">Todo el efectivo que tiene ahora el negocio. Pulsa cada línea para ir a su pantalla.</p></div></div>
        {d.retiradas_sin_asignar > 0 && (
          <p className="cf-baja" style={{ cursor: "pointer" }} onClick={() => { ir("finanzas/efectivo/caja"); setTimeout(() => document.getElementById("retiradas-banco")?.scrollIntoView({ behavior: "smooth" }), 300); }}>
            {d.retiradas_sin_asignar} retirada{d.retiradas_sin_asignar === 1 ? "" : "s"} del banco sin asignar ({eur(d.retiradas_importe, 2)}): di a dónde fue ese dinero en Caja → «Retiradas del banco por asignar».
          </p>
        )}
        <div className="cf-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          {lineas.map((l) => (
            <div key={l.k} role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => ir(l.ir)} onKeyDown={(e) => { if (e.key === "Enter") ir(l.ir); }}>
              <small>{l.t}</small><b className={Number(l.v) < 0 ? "down" : ""}>{eur(l.v, 2)}</b><span>{l.s}</span>
            </div>
          ))}
          <div className="cf-saldo"><small>Total efectivo vivo</small><b>{eur(d.total, 2)}</b>{!d.socio && <span>Sin el efectivo guardado (solo lo ven los socios)</span>}</div>
        </div>
    </div>
  );
}

const DESTINOS = { caja_fuerte: "Caja fuerte", guardado: "Efectivo guardado", otro: "Otra cosa" };

export function RetiradasBanco() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [verTodas, setVerTodas] = useState(false);
  const cargar = useCallback(() => { sb.rpc("banco_retiradas").then((r) => { setD(r); setFallo(false); }).catch(() => setFallo(true)); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useCambioEfectivo(cargar);
  if (fallo) return null;
  if (!d) return <div className="card"><Cargando /></div>;
  const pendientes = d.retiradas.filter((r) => Number(r.pendiente) > 0.005);
  const lista = verTodas ? d.retiradas : pendientes;
  const quitar = async (x) => {
    if (!window.confirm(`¿Quitar esta asignación de ${eur(x.importe, 2)}? La retirada vuelve a quedar por asignar en esa cantidad.`)) return;
    try { setD(await sb.rpc("banco_retirada_destino_quitar", { p_id: Number(x.id) })); avisar("Asignación quitada"); avisarCambioEfectivo(); }
    catch (e) { avisar(e.message || "No se ha podido quitar", "mal"); }
  };
  return (
    <div className="card cf" id="retiradas-banco">
      <div className="head">
        <div><h2>Retiradas del banco por asignar</h2><p className="sub">Retiradas de BBVA de octubre anteriores al 30/10. Las retiradas nuevas (BBVA y La Caixa) entran solas en Efectivo de sobres y ya no pasan por aquí.</p></div>
        <button className="btn-txt" onClick={() => setVerTodas(!verTodas)}>{verTodas ? "Ver solo las pendientes" : `Ver todas (${d.retiradas.length})`}</button>
      </div>
      {lista.length === 0 ? <p className="empty">{verTodas ? "No hay retiradas de efectivo de BBVA desde el 1 de octubre." : "Todas las retiradas están asignadas."}</p> : (
        <div className="tabla-scroll">
          <table className="ranking cf-movs">
            <thead><tr><th>Día</th><th className="r">Retirada</th><th>A dónde fue</th><th className="r">Sin asignar</th><th></th></tr></thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id}>
                  <td>{fechaCorta(r.fecha)}<span className="pf">BBVA</span></td>
                  <td className="r b">{eur(r.importe, 2)}</td>
                  <td>
                    {r.destinos.length === 0 ? <span className="pf">Sin asignar</span> : r.destinos.map((x) => (
                      <div key={`${x.destino}-${x.id}`} style={{ fontSize: 13 }}>
                        <span className="cf-chip in">{DESTINOS[x.destino]}</span> {eur(x.importe, 2)}
                        {x.destino === "caja_fuerte" ? <span className="pf">Recarga del {fechaCorta(x.fecha)} · se cambia quitando la recarga en la caja fuerte</span>
                          : <>{x.nota ? ` · ${x.nota}` : ""}{x.quien ? ` · ${x.quien}` : ""} <button className="btn-txt peligro" onClick={() => quitar(x)}>Quitar</button></>}
                      </div>
                    ))}
                  </td>
                  <td className={`r ${Number(r.pendiente) > 0.005 ? "b down" : ""}`}>{eur(r.pendiente, 2)}</td>
                  <td className="r">{Number(r.pendiente) > 0.005 && <button className="btn-l" onClick={() => setAbierta(r)}>Asignar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierta && <PanelAsignar r={abierta} d={d} onClose={() => setAbierta(null)} onListo={(nd) => { setD(nd); setAbierta(null); avisarCambioEfectivo(); }} />}
    </div>
  );
}

function PanelAsignar({ r, d, onClose, onListo }) {
  const pend = Number(r.pendiente);
  const opciones = [{ v: "caja_fuerte", t: "Caja fuerte" }, ...(d.socio ? [{ v: "guardado", t: "Efectivo guardado" }] : []), { v: "otro", t: "Otra cosa" }];
  const [partes, setPartes] = useState([{ destino: "caja_fuerte", importe: String(pend).replace(".", ","), recarga_id: "", nota: "" }]);
  const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setPartes(partes.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const vals = partes.map((p) => ({ ...p, x: numeroEur(p.importe) }));
  const suma = r2(vals.reduce((t, p) => t + (Number.isFinite(p.x) ? p.x : 0), 0));
  const recargas = d.recargas || [];
  const errores = [];
  if (vals.some((p) => !(p.x > 0))) errores.push("Cada parte tiene que tener un importe mayor que 0.");
  if (suma > r2(pend)) errores.push(`Repartes ${eur(suma, 2)} y quedan ${eur(pend, 2)} sin asignar.`);
  if (vals.some((p) => p.destino === "otro" && !p.nota.trim())) errores.push("En «Otra cosa» la nota es obligatoria.");
  vals.forEach((p) => { if (p.destino === "caja_fuerte" && p.recarga_id) { const rc = recargas.find((x) => String(x.id) === String(p.recarga_id)); if (rc && p.x > Number(rc.sobres)) errores.push(`La recarga del ${fechaCorta(rc.fecha)} solo tiene ${eur(rc.sobres, 2)} apuntados como Efectivo de sobres.`); } });
  const guardar = async () => {
    setBusy(true);
    try {
      const destinos = vals.map((p) => ({ destino: p.destino, importe: p.x, ...(p.destino === "caja_fuerte" && p.recarga_id ? { recarga_id: Number(p.recarga_id) } : {}), ...(p.nota.trim() ? { nota: p.nota.trim() } : {}) }));
      onListo(await sb.rpc("banco_retirada_asignar", { p_mov: Number(r.id), p: { destinos } }));
      avisar("Retirada asignada");
    } catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="¿A dónde fue este dinero?" sub={`Retirada de BBVA del ${fechaCorta(r.fecha)} · ${eur(r.importe, 2)} · sin asignar ${eur(pend, 2)}`} onClose={onClose} ancho="520px"
      pie={<button className="btn-p" disabled={busy || errores.length > 0} onClick={guardar}>{busy ? "Guardando…" : `Asignar ${eur(suma, 2)}`}</button>}>
      {partes.map((p, i) => (
        <div key={i} style={{ border: "1px solid var(--line, #EBE3D5)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
          <div className="campo-t"><span>Destino</span><div className="seg">{opciones.map((o) => <button key={o.v} aria-pressed={p.destino === o.v} onClick={() => set(i, "destino", o.v)}>{o.t}</button>)}</div></div>
          <div className="fila-campos">
            <label className="campo">Importe (€)<input inputMode="decimal" value={p.importe} onChange={(e) => set(i, "importe", e.target.value)} /></label>
            {p.destino === "caja_fuerte" && (
              <label className="campo">Recarga<select value={p.recarga_id} onChange={(e) => set(i, "recarga_id", e.target.value)}>
                <option value="">Una recarga nueva (con fecha de la retirada)</option>
                {d.socio && recargas.map((x) => <option key={x.id} value={x.id}>Ya apuntada: {fechaCorta(x.fecha)} · {eur(x.importe, 2)} (de sobres {eur(x.sobres, 2)})</option>)}
              </select></label>
            )}
          </div>
          {p.destino === "caja_fuerte" && p.recarga_id && <p className="sub" style={{ marginTop: 0 }}>Esa parte de la recarga deja de contar como salida de Efectivo de sobres y pasa a BBVA.</p>}
          {p.destino === "guardado" && <p className="sub" style={{ marginTop: 0 }}>Entra en Efectivo de sobres como «Retirada del banco» (otra entrada) y desde ahí se gasta como siempre.</p>}
          <label className="campo">{p.destino === "otro" ? "Nota (obligatoria)" : "Nota (opcional)"}<input value={p.nota} maxLength={200} onChange={(e) => set(i, "nota", e.target.value)} placeholder={p.destino === "otro" ? "Ej.: pago en efectivo al fontanero" : ""} /></label>
          {partes.length > 1 && <button className="btn-txt peligro" onClick={() => setPartes(partes.filter((_, j) => j !== i))}>Quitar esta parte</button>}
        </div>
      ))}
      <button className="btn-l" onClick={() => setPartes([...partes, { destino: d.socio ? "guardado" : "otro", importe: String(r2(Math.max(pend - suma, 0))).replace(".", ","), recarga_id: "", nota: "" }])}>+ Repartir en otra parte</button>
      {errores.map((e) => <p key={e} className="cf-alerta" style={{ marginTop: 10 }}>{e}</p>)}
      {errores.length === 0 && suma < r2(pend) && <p className="sub">Quedarán {eur(r2(pend - suma), 2)} sin asignar.</p>}
    </Panel>
  );
}
