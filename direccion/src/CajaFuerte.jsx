// Finanzas → Caja: cuadro «Caja fuerte» (solicitud #11). Dinero de dirección en la tienda para pagar a proveedores:
// saldo = recargas apuntadas − facturas pagadas con «Caja fuerte». Solo dirección.
// #84: cada recarga dice de dónde sale el dinero (Efectivo de sobres, una retirada de BBVA o La Caixa), y se puede repartir.
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
      {movs.length > 0 && (
        <div className="tabla-scroll">
          <table className="ranking cf-movs">
            <thead><tr><th>Día</th><th>Concepto</th><th>Quién</th><th className="r">Importe</th><th className="r">Queda</th><th></th></tr></thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={`${m.tipo}-${m.id}`}>
                  <td>{fechaCorta(m.fecha)}</td>
                  <td>{m.tipo === "recarga" ? <span className="cf-chip in">Recarga</span> : <span className="cf-chip out">Pago</span>} {m.concepto}
                    {m.tipo === "recarga" && <span className="pf">{m.origenes?.length ? `De: ${m.origenes.map((o) => `${ORIGENES[o.origen] || o.origen}${o.fecha_mov && o.origen === "bbva" ? ` (retirada del ${fechaCorta(o.fecha_mov)})` : ""} ${eur(o.importe, 2)}`).join(" · ")}` : "Sin origen apuntado"}</span>}</td>
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
  const [origenes, setOrigenes] = useState([{ origen: socio ? "sobres" : "bbva", importe: "", movimiento_id: "" }]);
  const [retiradas, setRetiradas] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { sb.rpc("banco_retiradas").then((r) => setRetiradas((r.retiradas || []).filter((x) => Number(x.pendiente) > 0.005))).catch(() => setRetiradas([])); }, []);
  const x = numeroEur(importe);
  const set = (i, k, v) => setOrigenes(origenes.map((o, j) => (j === i ? { ...o, [k]: v, ...(k === "origen" ? { movimiento_id: "" } : {}) } : o)));
  // con un solo origen, su importe es el total
  const vals = origenes.map((o) => ({ ...o, x: origenes.length === 1 ? x : numeroEur(o.importe) }));
  const suma = r2(vals.reduce((t, o) => t + (Number.isFinite(o.x) ? o.x : 0), 0));
  const errores = [];
  if (importe && !(x > 0)) errores.push("Pon un importe mayor que 0, con 2 decimales como mucho.");
  if (x > 0 && vals.some((o) => !(o.x > 0))) errores.push("Cada origen tiene que tener un importe mayor que 0.");
  if (x > 0 && suma !== r2(x)) errores.push(`Los orígenes suman ${eur(suma, 2)} y el total es ${eur(x, 2)}.`);
  if (vals.some((o) => o.origen === "bbva" && !o.movimiento_id)) errores.push("Elige la retirada de BBVA.");
  const porMov = {};
  vals.forEach((o) => { if (o.origen === "bbva" && o.movimiento_id && Number.isFinite(o.x)) porMov[o.movimiento_id] = r2((porMov[o.movimiento_id] || 0) + o.x); });
  Object.entries(porMov).forEach(([id, t]) => { const rt = (retiradas || []).find((r) => String(r.id) === id); if (rt && t > Number(rt.pendiente)) errores.push(`A la retirada del ${fechaCorta(rt.fecha)} solo le quedan ${eur(rt.pendiente, 2)} sin asignar.`); });
  const ok = x > 0 && fecha && errores.length === 0;
  const guardar = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      const p = { importe: r2(x), fecha, nota: nota.trim() || null, origenes: vals.map((o) => ({ origen: o.origen, importe: r2(o.x), ...(o.origen === "bbva" ? { movimiento_id: Number(o.movimiento_id) } : {}) })) };
      onGuardada(await sb.rpc("caja_fuerte_recargar", { p }));
      avisar("Recarga apuntada");
    } catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  const opciones = [...(socio ? ["sobres"] : []), "bbva", "caixa"];
  return (
    <Panel titulo="Añadir dinero a caja" sub="Lo que metéis en la caja fuerte de la tienda y de dónde sale. Se apunta solo aquí: si sale de Efectivo de sobres, su salida se crea sola allí." onClose={onClose} ancho="520px"
      pie={<button className="btn-p" onClick={guardar} disabled={busy || !ok}>{busy ? "Guardando…" : "Guardar"}</button>}>
      <div className="fila-campos">
        <label className="campo">Importe total (€)<input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="1000" autoFocus /></label>
        <label className="campo">Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      </div>
      <label className="campo">Nota (opcional)<input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: recarga de la semana" /></label>
      <div className="campo-t"><span>¿De dónde sale?{origenes.length > 1 ? " (repartido)" : ""}</span></div>
      {origenes.map((o, i) => (
        <div key={i} style={{ border: "1px solid var(--line, #EBE3D5)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
          <div className="seg" style={{ marginBottom: 8 }}>{opciones.map((k) => <button key={k} aria-pressed={o.origen === k} onClick={() => set(i, "origen", k)}>{ORIGENES[k]}</button>)}</div>
          {o.origen === "bbva" && (
            <label className="campo">Retirada de BBVA<select value={o.movimiento_id} onChange={(e) => set(i, "movimiento_id", e.target.value)}>
              <option value="">{retiradas === null ? "Cargando…" : retiradas.length ? "Elegir…" : "No hay retiradas de BBVA sin asignar"}</option>
              {(retiradas || []).map((r) => <option key={r.id} value={r.id}>{fechaCorta(r.fecha)} · {eur(r.importe, 2)} (sin asignar {eur(r.pendiente, 2)})</option>)}
            </select></label>
          )}
          {o.origen === "caixa" && <p className="sub" style={{ marginTop: 0 }}>Importe a mano hasta que llegue el extracto de La Caixa.</p>}
          {o.origen === "sobres" && <p className="sub" style={{ marginTop: 0 }}>Crea la salida «Caja fuerte» en Efectivo de sobres (no es gasto).</p>}
          {origenes.length > 1 && (
            <div className="fila-campos">
              <label className="campo">Importe (€)<input inputMode="decimal" value={o.importe} onChange={(e) => set(i, "importe", e.target.value)} /></label>
              <div style={{ alignSelf: "end", paddingBottom: 8 }}><button className="btn-txt peligro" onClick={() => setOrigenes(origenes.filter((_, j) => j !== i))}>Quitar</button></div>
            </div>
          )}
        </div>
      ))}
      <button className="btn-l" onClick={() => {
        const base = origenes.length === 1 ? [{ ...origenes[0], importe: Number.isFinite(x) ? String(x).replace(".", ",") : "" }] : origenes;
        const resto = Number.isFinite(x) ? r2(x - base.reduce((t, o) => t + (Number.isFinite(numeroEur(o.importe)) ? numeroEur(o.importe) : 0), 0)) : 0;
        setOrigenes([...base, { origen: opciones.find((k) => !base.some((b) => b.origen === k)) || "caixa", importe: resto > 0 ? String(resto).replace(".", ",") : "", movimiento_id: "" }]);
      }}>+ Repartir entre varios orígenes</button>
      {errores.map((e) => <p key={e} className="cf-alerta" style={{ marginTop: 10 }}>{e}</p>)}
      <div className="cf-previa">
        <span>Ahora</span><b>{eur(saldo, 2)}</b>
        <span>Después de guardar</span><b>{ok ? eur(saldo + x, 2) : "–"}</b>
      </div>
    </Panel>
  );
}
