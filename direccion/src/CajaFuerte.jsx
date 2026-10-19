// Finanzas → Caja: cuadro «Caja fuerte» (solicitud #11). Dinero de dirección en la tienda para pagar a proveedores:
// saldo = recargas apuntadas − facturas pagadas con «Caja fuerte». Solo dirección.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../src/lib/supabase.js";
import { Panel, avisar, hoyStr, fechaCorta, Cargando } from "./ui.jsx";
import { eur } from "./fmt.js";

const numero = (v) => { const x = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(x) ? x : NaN; };

export function CajaFuerte() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const cargar = useCallback(async () => {
    try { setD(await sb.rpc("caja_fuerte_estado")); setFallo(false); } catch (e) { setFallo(true); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const quitar = async (m) => {
    if (!window.confirm(`¿Quitar la recarga de ${eur(m.importe, 2)} del ${fechaCorta(m.fecha)}? El saldo bajará esa cantidad.`)) return;
    try { await sb.update("caja_fuerte_recargas", `id=eq.${m.id}`, { anulada: true }); avisar("Recarga quitada"); cargar(); }
    catch (e) { avisar("No se ha podido quitar", "mal"); }
  };

  if (fallo) return <div className="card cf"><h2>Caja fuerte</h2><p className="empty">No se ha podido cargar la caja fuerte.</p></div>;
  if (!d) return <div className="card cf"><Cargando /></div>;
  const movs = d.movimientos || [];
  const saldo = Number(d.saldo), minimo = Number(d.minimo);
  const empezado = movs.some((m) => m.tipo === "recarga");
  const visibles = verTodo ? movs : movs.slice(0, 8);
  return (
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
      {movs.length > 0 && (
        <div className="tabla-scroll">
          <table className="ranking cf-movs">
            <thead><tr><th>Día</th><th>Concepto</th><th>Quién</th><th className="r">Importe</th><th className="r">Queda</th><th></th></tr></thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={`${m.tipo}-${m.id}`}>
                  <td>{fechaCorta(m.fecha)}</td>
                  <td>{m.tipo === "recarga" ? <span className="cf-chip in">Recarga</span> : <span className="cf-chip out">Pago</span>} {m.concepto}</td>
                  <td>{m.quien || "—"}</td>
                  <td className={`r b ${Number(m.importe) < 0 ? "down" : "up"}`}>{Number(m.importe) > 0 ? "+" : ""}{eur(m.importe, 2)}</td>
                  <td className={`r ${Number(m.saldo_tras) < 0 ? "down" : ""}`}>{eur(m.saldo_tras, 2)}</td>
                  <td className="r">{m.tipo === "recarga" && <button className="btn-txt peligro" onClick={() => quitar(m)}>Quitar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movs.length > 8 && <button className="btn-txt" style={{ marginTop: 10 }} onClick={() => setVerTodo(!verTodo)}>{verTodo ? "Ver menos" : `Ver los ${movs.length} movimientos`}</button>}
        </div>
      )}
      {nueva && <NuevaRecarga saldo={saldo} onClose={() => setNueva(false)} onGuardada={() => { setNueva(false); cargar(); }} />}
    </div>
  );
}

function NuevaRecarga({ saldo, onClose, onGuardada }) {
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(hoyStr());
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const x = numero(importe);
  const decimalesOk = /^\d+([.,]\d{1,2})?$/.test(String(importe).trim());
  const ok = x > 0 && decimalesOk && fecha;
  const guardar = async () => {
    if (!ok) return;
    setBusy(true);
    try { await sb.insert("caja_fuerte_recargas", { importe: Math.round(x * 100) / 100, fecha, nota: nota.trim() || null }); avisar("Recarga apuntada"); onGuardada(); }
    catch (e) { avisar("No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Añadir dinero a caja" sub="Lo que metéis en la caja fuerte de la tienda" onClose={onClose} ancho="440px"
      pie={<button className="btn-p" onClick={guardar} disabled={busy || !ok}>{busy ? "Guardando…" : "Guardar"}</button>}>
      <div className="fila-campos">
        <label className="campo">Importe (€)<input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="1000" autoFocus /></label>
        <label className="campo">Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
      {importe && !ok && <p className="cf-alerta" style={{ marginTop: 0 }}>Pon un importe mayor que 0, con 2 decimales como mucho.</p>}
      <label className="campo">Nota (opcional)<input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: del sobre de septiembre" /></label>
      <div className="cf-previa">
        <span>Ahora</span><b>{eur(saldo, 2)}</b>
        <span>Después de guardar</span><b>{ok ? eur(saldo + x, 2) : "–"}</b>
      </div>
    </Panel>
  );
}
