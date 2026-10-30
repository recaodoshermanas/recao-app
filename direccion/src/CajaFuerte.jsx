// Finanzas → Caja: cuadro «Caja fuerte» (solicitud #11). Dinero de dirección en la tienda para pagar a proveedores:
// saldo = recargas apuntadas − facturas pagadas con «Caja fuerte». Solo dirección.
// #84: antes cada recarga decía de dónde salía el dinero. #118: ahora sale siempre de Efectivo de sobres; las retiradas del banco entran solas en Efectivo y se enlazan con la recarga.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../src/lib/supabase.js";
import { Panel, avisar, hoyStr, fechaCorta, Cargando } from "./ui.jsx";
import { eur } from "./fmt.js";
import { avisarCambioEfectivo, useCambioEfectivo, numeroEur, EfectivoVivo, RetiradasBanco } from "./finanzas/EfectivoVivo.jsx";

const ORIGENES = { sobres: "Efectivo de sobres", bbva: "BBVA", caixa: "La Caixa" };
const r2 = (x) => Math.round(x * 100) / 100;

export function CajaFuerte() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const cargar = useCallback(async () => {
    try { setD(await sb.rpc("caja_fuerte_estado")); setFallo(false); } catch (e) { setFallo(true); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useCambioEfectivo(cargar);

  const quitar = async (m) => {
    const deSobres = (m.origenes || []).some((o) => o.origen === "sobres");
    if (!window.confirm(`¿Quitar la recarga de ${eur(m.importe, 2)} del ${fechaCorta(m.fecha)}? El saldo bajará esa cantidad${deSobres ? " y se quitará también su salida en Efectivo de sobres" : ""}.`)) return;
    try { setD(await sb.rpc("caja_fuerte_recarga_quitar", { p_id: Number(m.id) })); avisar("Recarga quitada"); avisarCambioEfectivo(); }
    catch (e) { avisar("No se ha podido quitar", "mal"); }
  };

  if (fallo) return <><EfectivoVivo /><div className="card cf"><h2>Caja fuerte</h2><p className="empty">No se ha podido cargar la caja fuerte.</p></div></>;
  if (!d) return <><EfectivoVivo /><div className="card cf"><Cargando /></div></>;
  const movs = d.movimientos || [];
  const saldo = Number(d.saldo), minimo = Number(d.minimo);
  const empezado = movs.some((m) => m.tipo === "recarga");
  const visibles = verTodo ? movs : movs.slice(0, 8);
  const banco = d.banco || { pendientes: [], por_elegir: [] };
  const accion = async (fn, args, ok) => {
    try { setD(await sb.rpc(fn, args)); avisar(ok); avisarCambioEfectivo(); } catch (e) { avisar(e.message || "No se ha podido hacer", "mal"); }
  };
  const quitarPendiente = (x) => { if (window.confirm(`¿Quitar la entrada «Pendiente del banco» de ${eur(x.importe, 2)}? Efectivo de sobres bajará esa cantidad.`)) accion("efectivo_banco_pendiente_quitar", { p_id: Number(x.id) }, "Entrada pendiente quitada"); };
  const avisos = banco.pendientes.filter((x) => x.aviso);
  return (
    <>
    <EfectivoVivo />
    <div className="card cf">
      <div className="head">
        <div><h2>Caja fuerte</h2><p className="sub">Dinero de dirección en la tienda para pagar a proveedores. No es efectivo de la caja registradora.</p></div>
        <button className="btn-p" onClick={() => setNueva(true)}>Añadir dinero a caja</button>
      </div>
      {!empezado ? (
        <div className="cf-vacio">
          <b>Todavía no hay movimientos.</b>
          <span>Empieza apuntando el dinero que hay ahora mismo en la caja fuerte. A partir de ahí, cada factura que se pague con «Caja fuerte» lo descuenta sola.</span>
          {movs.length > 0 && <span>Ya hay {movs.length} factura{movs.length === 1 ? "" : "s"} pagada{movs.length === 1 ? "" : "s"} con la caja fuerte: se descontarán en cuanto apuntes la primera recarga.</span>}
        </div>
      ) : (
        <>
          {saldo < 0 && <p className="cf-alerta">Se ha pagado más de lo metido: falta apuntar alguna recarga.</p>}
          {saldo >= 0 && saldo < minimo && <p className="cf-baja">Queda menos de {eur(minimo, 0)}: toca recargarla.</p>}
          <div className="cf-kpis">
            <div className={`cf-saldo${saldo < 0 ? " neg" : saldo < minimo ? " bajo" : ""}`}><small>Queda en la caja fuerte</small><b>{eur(saldo, 2)}</b></div>
            <div><small>Total metido</small><b>{eur(d.metido, 2)}</b></div>
            <div><small>Pagado a proveedores</small><b>{eur(d.pagado, 2)}</b></div>
            <div><small>Última recarga</small><b>{d.ultima ? eur(d.ultima.importe, 2) : "–"}</b>{d.ultima && <span>{fechaCorta(d.ultima.fecha)}</span>}</div>
          </div>
        </>
      )}
      {avisos.map((x) => (
        <div key={x.id} className="cf-baja">
          <b>Retirada pendiente del banco sin aparecer:</b> {fechaCorta(x.fecha)} · {x.banco} · {eur(x.importe, 2)}.
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {x.retiradas.map((r) => <button key={r.movimiento_id} className="btn-l" onClick={() => accion("efectivo_banco_enlazar", { p_mov: Number(r.movimiento_id), p_recarga: Number(x.recarga_id) }, "Enlazada")}>Enlazar con la retirada del {fechaCorta(r.fecha)} ({eur(r.importe, 2)})</button>)}
            <button className="btn-txt peligro" onClick={() => quitarPendiente(x)}>Quitar la entrada pendiente</button>
          </div>
        </div>
      ))}
      {banco.por_elegir.map((x) => (
        <div key={x.recarga_id} className="cf-baja">
          <b>Elegir retirada del banco</b> para la recarga del {fechaCorta(x.fecha)} de {eur(x.importe, 2)}: encajan varias.
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {x.retiradas.map((r) => <button key={r.movimiento_id} className="btn-l" onClick={() => accion("efectivo_banco_enlazar", { p_mov: Number(r.movimiento_id), p_recarga: Number(x.recarga_id) }, "Enlazada")}>{r.banco} · {fechaCorta(r.fecha)} · {eur(r.importe, 2)}</button>)}
          </div>
        </div>
      ))}
      {movs.length > 0 && (
        <div className="tabla-scroll">
          <table className="ranking cf-movs">
            <thead><tr><th>Día</th><th>Concepto</th><th>Quién</th><th className="r">Importe</th><th className="r">Queda</th><th></th></tr></thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={`${m.tipo}-${m.id}`}>
                  <td>{fechaCorta(m.fecha)}</td>
                  <td>{m.tipo === "recarga" ? <span className="cf-chip in">Recarga</span> : <span className="cf-chip out">Pago</span>} {m.concepto}
                    {m.tipo === "recarga" && <span className="pf">{[
                      "De: Efectivo de sobres",
                      m.pend && `Pendiente del banco (${m.pend}): la retirada aún no ha llegado`,
                      m.enlace && `Retirada de ${m.enlace.banco} del ${fechaCorta(m.enlace.fecha)}${m.enlace.auto ? "" : " (enlazada a mano)"}`,
                    ].filter(Boolean).join(" · ")}{(m.origenes || []).some((o) => o.origen !== "sobres") ? ` · Antes: ${m.origenes.map((o) => `${ORIGENES[o.origen] || o.origen} ${eur(o.importe, 2)}`).join(" + ")}` : ""}</span>}</td>
                  <td>{m.quien || "—"}</td>
                  <td className={`r b ${Number(m.importe) < 0 ? "down" : "up"}`}>{Number(m.importe) > 0 ? "+" : ""}{eur(m.importe, 2)}</td>
                  <td className={`r ${Number(m.saldo_tras) < 0 ? "down" : ""}`}>{eur(m.saldo_tras, 2)}</td>
                  <td className="r">{m.tipo === "recarga" && m.enlace && <button className="btn-txt" onClick={() => accion("efectivo_banco_enlace_quitar", { p_recarga: Number(m.id) }, "Enlace quitado")}>Desenlazar</button>}{m.tipo === "recarga" && <button className="btn-txt peligro" onClick={() => quitar(m)}>Quitar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movs.length > 8 && <button className="btn-txt" style={{ marginTop: 10 }} onClick={() => setVerTodo(!verTodo)}>{verTodo ? "Ver menos" : `Ver los ${movs.length} movimientos`}</button>}
        </div>
      )}
      {nueva && <NuevaRecarga saldo={saldo} socio={d.socio} onClose={() => setNueva(false)} onGuardada={(r) => { setNueva(false); setD(r); avisarCambioEfectivo(); }} />}
    </div>
    <div style={{ marginTop: 16 }}><RetiradasBanco /></div>
    </>
  );
}

function NuevaRecarga({ saldo, socio, onClose, onGuardada }) {
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(hoyStr());
  const [nota, setNota] = useState("");
  const [pend, setPend] = useState(false);
  const [banco, setBanco] = useState("BBVA");
  const [busy, setBusy] = useState(false);
  const x = numeroEur(importe);
  const errores = [];
  if (importe && !(x > 0)) errores.push("Pon un importe mayor que 0, con 2 decimales como mucho.");
  if (!socio) errores.push("Solo los socios pueden sacar dinero de Efectivo de sobres.");
  const ok = x > 0 && fecha && errores.length === 0;
  const guardar = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const p = { importe: r2(x), fecha, nota: nota.trim() || null, origenes: [{ origen: "sobres", importe: r2(x) }], ...(pend ? { pendiente_banco: banco } : {}) };
      onGuardada(await sb.rpc("caja_fuerte_recargar", { p }));
      avisar("Recarga apuntada");
    } catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Añadir dinero a caja" sub="Lo que metéis en la caja fuerte de la tienda. Sale siempre de Efectivo de sobres (su salida «Caja fuerte» se crea sola allí). Las retiradas del banco entran solas en Efectivo." onClose={onClose} ancho="520px"
      pie={<button className="btn-p" onClick={guardar} disabled={busy || !ok}>{busy ? "Guardando…" : "Guardar"}</button>}>
      <div className="fila-campos">
        <label className="campo">Importe (€)<input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="1000" autoFocus /></label>
        <label className="campo">Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
      <label className="campo">Nota (opcional)<input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: recarga de la semana" /></label>
      <label className="campo" style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={pend} onChange={(e) => setPend(e.target.checked)} style={{ width: "auto" }} />
        Viene de una retirada del banco que aún no ha salido
      </label>
      {pend && (
        <>
          <div className="seg" style={{ marginBottom: 8 }}>{["BBVA", "La Caixa"].map((k) => <button key={k} aria-pressed={banco === k} onClick={() => setBanco(k)}>{k}</button>)}</div>
          <p className="sub" style={{ marginTop: 0 }}>Entra en Efectivo de sobres una entrada «Pendiente del banco» por este importe, para que Efectivo no baje. Se confirma sola cuando llegue la retirada.</p>
        </>
      )}
      {errores.map((e) => <p key={e} className="cf-alerta" style={{ marginTop: 10 }}>{e}</p>)}
      <div className="cf-previa">
        <span>Ahora</span><b>{eur(saldo, 2)}</b>
        <span>Después de guardar</span><b>{ok ? eur(saldo + x, 2) : "–"}</b>
      </div>
    </Panel>
  );
}
