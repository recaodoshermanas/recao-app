// Finanzas → Facturas pendientes de pago (solicitud #27): facturas de proveedores que se pagan por transferencia,
// cruzadas solas con las transferencias del banco (solicitud #23). Todo pasa por funciones pagos_* (solo dirección).
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Panel, Pestanas, avisar, hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";

const fecha = (f) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const numero = (t) => { const v = Number(String(t).replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : NaN; };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const copiar = async (texto, ok) => {
  try { await navigator.clipboard.writeText(texto); avisar(ok); }
  catch (e) { avisar("No se ha podido copiar", "mal"); }
};

// Número de factura (#50): se copia al pulsarlo; si falta, sale en rojo y se puede añadir ahí mismo
function Numero({ p, busy, onGuardar }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState("");
  if (p.tipo !== "f") return null;
  if (edit) {
    return (
      <span style={{ display: "inline-flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
        <input value={v} autoFocus maxLength={60} onChange={(e) => setV(e.target.value)} placeholder="Número de factura" style={{ padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 8, font: "inherit" }}
          onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onGuardar(v).then((ok) => ok && setEdit(false)); }} />
        <button className="btn-l" disabled={busy || !v.trim()} onClick={() => onGuardar(v).then((ok) => ok && setEdit(false))}>Guardar</button>
        <button className="btn-txt" onClick={() => setEdit(false)}>Cancelar</button>
      </span>
    );
  }
  if (!p.numero) {
    return <span style={{ display: "block", marginTop: 2 }}><strong style={{ color: "var(--down)" }}>Sin número</strong> <button className="btn-txt" onClick={() => setEdit(true)}>Añadir</button></span>;
  }
  return <button className="btn-txt" title="Pulsa para copiar" style={{ display: "block", fontWeight: 700, marginTop: 2 }} onClick={() => copiar(p.numero, "Número copiado")}>Nº {p.numero}</button>;
}

const pideDias = (n) => (n <= 0 ? "hoy" : n === 1 ? "1 día" : `${n} días`);

export function PagosPendientes() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [tab, setTab] = useState("pendientes");
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sinClas, setSinClas] = useState({ sin_clasificar: [], ignorados: [] }); // #46
  const [verIgn, setVerIgn] = useState(false);
  const [sel, setSel] = useState(() => new Set()); // #50: facturas marcadas para copiar sus números juntos
  const marcar = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const guardarNumero = async (p, numero) => accion("pagos_factura_numero", { p_id: p.id, p_numero: numero }, "Número guardado");

  const cargar = useCallback(async () => {
    try { setD(await sb.rpc("pagos_datos")); setFallo(false); } catch (e) { setFallo(true); }
    try { const r = await sb.rpc("pagos_sin_clasificar"); setSinClas({ sin_clasificar: r?.sin_clasificar || [], ignorados: r?.ignorados || [] }); } catch (e) { /* el aviso es secundario */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn, params, ok) => {
    setBusy(true);
    try { await sb.rpc(fn, params); avisar(ok); await cargar(); return true; }
    catch (e) { avisar(msg(e), "mal"); return false; }
    finally { setBusy(false); }
  };

  const grupos = useMemo(() => {
    const g = new Map();
    (d?.pendientes || []).forEach((p) => { if (!g.has(p.grupo)) g.set(p.grupo, []); g.get(p.grupo).push(p); });
    return [...g.entries()].map(([nombre, items]) => ({ nombre, items, total: items.reduce((s, x) => s + Number(x.importe), 0) }))
      .sort((a, b) => (a.nombre === "Pagos fijos") - (b.nombre === "Pagos fijos") || b.total - a.total);
  }, [d]);

  if (fallo) return <div className="card"><h2>Facturas pendientes de pago</h2><p className="empty">No se ha podido cargar. Recarga la página en un momento.</p></div>;
  if (!d) return <div className="card"><Cargando /></div>;

  const total = d.pendientes.reduce((s, x) => s + Number(x.importe), 0);
  const nProp = d.propuestas.length;

  return (
    <>
      <div className="card">
        <div className="head" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h2>Facturas pendientes de pago</h2>
            <p className="sub">Proveedores que se pagan por transferencia, desde el 1/10/2026. Se quitan solas cuando la transferencia aparece en el banco.</p>
          </div>
          <button className="btn-l" onClick={() => setPanel({ config: true })}>Pagos fijos</button>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "14px 0 6px" }}>
          <div><div className="sub">Total pendiente</div><div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.01em" }}>{eur(total, 2)}</div></div>
          <div><div className="sub">Facturas y pagos</div><div style={{ fontSize: 34, fontWeight: 800 }}>{d.pendientes.length}</div></div>
        </div>
        {!d.banco_conectado && <p className="es-aviso">Todavía no hay ningún banco conectado: de momento se marcan a mano con «Marcar como pagada».</p>}
        <Pestanas valor={tab} onChange={setTab} etiqueta="Vista"
          opciones={[{ id: "pendientes", label: "Pendientes" }, { id: "propuestas", label: "Posibles pagos por confirmar", n: nProp }, { id: "pagadas", label: "Pagadas (60 días)" }]} />
      </div>

      {tab === "pendientes" && (sinClas.sin_clasificar.length > 0 || sinClas.ignorados.length > 0) && (
        <div className="card" style={{ marginTop: 16 }}>
          {sinClas.sin_clasificar.length > 0 && (
            <>
              <h3 className="fh3" style={{ marginTop: 0 }}>Proveedores sin clasificar</h3>
              <p className="sub">Tienen facturas con forma de pago «Banco» desde el 1/10/2026 pero no están en la lista de transferencia o domiciliación, así que no salen en pendientes. Dime cómo se pagan.</p>
              {sinClas.sin_clasificar.map((p) => (
                <div key={p.clave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                  <span><strong>{p.nombre}</strong> <span className="pf" style={{ display: "inline", marginLeft: 6 }}>{p.n} {p.n === 1 ? "factura" : "facturas"} · {eur(p.total, 2)}</span></span>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn-l" disabled={busy} onClick={() => accion("pagos_clasificar_proveedor", { p_nombre: p.nombre, p_modo: "transferencia" }, `${p.nombre}: transferencia`)}>Es transferencia</button>
                    <button className="btn-l" disabled={busy} onClick={() => accion("pagos_clasificar_proveedor", { p_nombre: p.nombre, p_modo: "domiciliacion" }, `${p.nombre}: domiciliado`)}>Es domiciliado</button>
                    <button className="btn-l" disabled={busy} onClick={() => accion("pagos_ignorar_proveedor", { p_nombre: p.nombre, p_ignorar: true }, `${p.nombre}: ignorado`)}>Ignorar</button>
                  </span>
                </div>
              ))}
            </>
          )}
          {sinClas.ignorados.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button className="btn-l" onClick={() => setVerIgn((v) => !v)}>{verIgn ? "Ocultar" : "Ver"} ignorados ({sinClas.ignorados.length})</button>
              {verIgn && sinClas.ignorados.map((p) => (
                <div key={p.clave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span>{p.nombre} <span className="pf" style={{ display: "inline", marginLeft: 6 }}>{p.n} {p.n === 1 ? "factura" : "facturas"} · {eur(p.total, 2)}</span></span>
                  <button className="btn-l" disabled={busy} onClick={() => accion("pagos_ignorar_proveedor", { p_nombre: p.nombre, p_ignorar: false }, `${p.nombre}: vuelve al aviso`)}>Deshacer</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "pendientes" && (
        <div className="card" style={{ marginTop: 16 }}>
          {!grupos.length ? <p className="empty">No hay nada pendiente de pagar.</p> : grupos.map((g) => (
            <div key={g.nombre} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <strong>{g.nombre} <span className="pf" style={{ display: "inline", marginLeft: 6 }}>{g.items.length} {g.items.length === 1 ? "pendiente" : "pendientes"}</span></strong>
                <strong>{eur(g.total, 2)}</strong>
              </div>
              {g.items.some((p) => sel.has(`${p.tipo}-${p.id}`)) && (() => {
                const marcadas = g.items.filter((p) => p.tipo === "f" && sel.has(`${p.tipo}-${p.id}`));
                const nums = marcadas.map((p) => p.numero).filter(Boolean);
                return (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0" }}>
                    <span className="sub">{marcadas.length} marcadas · {eur(marcadas.reduce((s, x) => s + Number(x.importe), 0), 2)}</span>
                    <button className="btn-p" disabled={!nums.length} onClick={() => copiar(`${nums.join(" / ")} RECAO`, "Números copiados")}>Copiar números</button>
                    {nums.length < marcadas.length && <span className="sub" style={{ color: "var(--down)" }}>Alguna marcada no tiene número</span>}
                  </div>
                );
              })()}
              <div className="tabla-scroll">
                <table className="ranking es-tabla">
                  <tbody>
                    {g.items.map((p) => (
                      <tr key={`${p.tipo}-${p.id}`}>
                        <td style={{ width: 28 }}>{p.tipo === "f" && <input type="checkbox" aria-label="Marcar para copiar el número" checked={sel.has(`${p.tipo}-${p.id}`)} onChange={() => marcar(`${p.tipo}-${p.id}`)} />}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{fecha(p.fecha)}<span className="pf">{p.dias > 0 ? `lleva ${pideDias(p.dias)}` : "de hoy"}</span></td>
                        <td>{p.nombre}<Numero p={p} busy={busy} onGuardar={(n) => guardarNumero(p, n)} />{p.etiqueta && <span className="es-chip com" style={{ marginLeft: 8 }}>{p.etiqueta}</span>}
                          {(p.quien || p.nota) && <span className="pf">{[p.quien && `Lo metió ${p.quien}`, p.nota].filter(Boolean).join(" · ")}</span>}</td>
                        <td className="r b">{eur(p.importe, 2)}</td>
                        <td className="r" style={{ whiteSpace: "nowrap" }}>
                          {p.tipo === "x" && <button className="btn-txt" disabled={busy} onClick={() => setPanel({ importe: p })}>Cambiar importe</button>}
                          <button className="btn-l" disabled={busy} onClick={() => setPanel({ marcar: p })}>Marcar como pagada</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "propuestas" && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="sub">Transferencias del banco que podrían ser el pago de estas facturas pero no se quitan solas: o hay más de una opción, o no cuadran al céntimo (margen de {eur(d.margen, 2)}). Tú decides.</p>
          {!nProp ? <p className="empty">No hay posibles pagos por confirmar.</p> : d.propuestas.map((p) => (
            <div key={p.mov.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px", margin: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div><strong>Transferencia de {eur(p.mov.importe, 2)}</strong> · {fecha(p.mov.fecha)}<span className="pf">{p.mov.contraparte || p.mov.concepto}</span></div>
              </div>
              {p.opciones.map((o, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", borderTop: "1px dashed var(--line)", marginTop: 10, paddingTop: 10 }}>
                  <div>
                    {o.items.map((it) => <div key={`${it.tipo}-${it.id}`}>{it.nombre} · {fecha(it.fecha)} · {eur(it.importe, 2)}{it.numero && <> · <strong>Nº {it.numero}</strong></>}</div>)}
                    {o.por_numero && <span className="pf" style={{ fontWeight: 700 }}>El concepto de la transferencia lleva el número de factura</span>}
                    <span className="pf" style={{ color: Number(o.dif) === 0 ? undefined : "var(--down)", fontWeight: Number(o.dif) === 0 ? 500 : 700 }}>
                      {Number(o.dif) === 0 ? "Cuadra exacto" : `Diferencia ${eur(Math.abs(o.dif), 2)} (${o.dif > 0 ? "se ha transferido de más" : "se ha transferido de menos"})`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-p" disabled={busy} onClick={() => accion("pagos_confirmar", { p_mov: p.mov.id, p_items: o.items.map((x) => ({ tipo: x.tipo, id: x.id })) }, "Marcado como pagado")}>Confirmar</button>
                    <button className="btn-txt" disabled={busy} onClick={() => accion("pagos_descartar", { p_mov: p.mov.id, p_items: o.items.map((x) => ({ tipo: x.tipo, id: x.id })) }, "Propuesta descartada")}>No es esta</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "pagadas" && (
        <div className="card" style={{ marginTop: 16 }}>
          {!d.pagadas.length ? <p className="empty">No hay pagos en los últimos 60 días.</p> : (
            <div className="tabla-scroll">
              <table className="ranking es-tabla">
                <thead><tr><th>Pagada</th><th>Factura</th><th>Cómo</th><th className="r">Importe</th><th></th></tr></thead>
                <tbody>
                  {d.pagadas.map((p) => (
                    <tr key={`${p.tipo}-${p.id}`}>
                      <td style={{ whiteSpace: "nowrap" }}>{fecha(p.pagada_fecha)}</td>
                      <td>{p.grupo !== p.nombre && p.tipo === "f" ? `${p.grupo} · ` : ""}{p.nombre}<span className="pf">{p.tipo === "x" ? "Pago fijo" : "Factura"} del {fecha(p.fecha)}</span>{p.tipo === "f" && p.numero && <button className="btn-txt" title="Pulsa para copiar" style={{ display: "block", fontWeight: 700 }} onClick={() => copiar(p.numero, "Número copiado")}>Nº {p.numero}</button>}</td>
                      <td>{p.mov ? <>Banco · {fecha(p.mov.fecha)} · {eur(p.mov.importe, 2)}<span className="pf">{p.mov.concepto}</span></> : <>Marcada a mano{p.nota && <span className="pf">{p.nota}</span>}</>}</td>
                      <td className="r b">{eur(p.importe, 2)}</td>
                      <td className="r"><button className="btn-l" disabled={busy} onClick={() => { if (window.confirm("¿Volver a ponerla como pendiente de pago?")) accion("pagos_volver_pendiente", { p_tipo: p.tipo, p_id: p.id }, "Vuelve a pendiente"); }}>Volver a pendiente</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {panel?.marcar && <PanelMarcar p={panel.marcar} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
      {panel?.importe && <PanelImporte p={panel.importe} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
      {panel?.config && <PanelFijos fijos={d.fijos} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
    </>
  );
}

function PanelMarcar({ p, onClose, onListo }) {
  const [f, setF] = useState(hoyStr());
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    setBusy(true);
    try { await sb.rpc("pagos_marcar_pagada", { p_tipo: p.tipo, p_id: p.id, p_fecha: f, p_nota: nota }); avisar("Marcada como pagada"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  return (
    <Panel titulo="Marcar como pagada" sub={`${p.nombre} · ${eur(p.importe, 2)}`} onClose={onClose} ancho="420px"
      pie={<button className="btn-p" disabled={busy || !f} onClick={guardar}>{busy ? "Guardando…" : "Marcar como pagada"}</button>}>
      <label className="campo">Fecha del pago<input type="date" value={f} onChange={(e) => setF(e.target.value)} /></label>
      <label className="campo">Nota (opcional)<input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: pagada en efectivo" /></label>
      <p className="sub">Queda en «Pagadas» como «marcada a mano». Desde allí se puede volver a pendiente.</p>
    </Panel>
  );
}

function PanelImporte({ p, onClose, onListo }) {
  const [v, setV] = useState(String(p.importe).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const x = numero(v);
  const guardar = async () => {
    setBusy(true);
    try { await sb.rpc("pagos_fijo_editar", { p_id: Number(p.id), p_importe: x }); avisar("Importe cambiado"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  return (
    <Panel titulo="Cambiar importe" sub={`${p.nombre} · ${fecha(p.fecha)}`} onClose={onClose} ancho="400px"
      pie={<button className="btn-p" disabled={busy || !(x > 0)} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>}>
      <label className="campo">Importe (€)<input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></label>
      <p className="sub">Solo cambia este pago. Para los meses siguientes, usa «Pagos fijos».</p>
    </Panel>
  );
}

function PanelFijos({ fijos, onClose, onListo }) {
  const [imp, setImp] = useState(() => Object.fromEntries(fijos.map((f) => [f.concepto, String(f.importe).replace(".", ",")])));
  const [busy, setBusy] = useState(false);
  const vals = fijos.map((f) => ({ concepto: f.concepto, importe: numero(imp[f.concepto]) }));
  const ok = vals.every((v) => v.importe > 0);
  const guardar = async () => {
    setBusy(true);
    try { await sb.rpc("pagos_fijos_config_guardar", { p: vals }); avisar("Importes guardados"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  return (
    <Panel titulo="Pagos fijos del mes" sub="Se añaden solos a pendientes el día 30 de cada mes (en febrero, el último día)" onClose={onClose} ancho="420px"
      pie={<button className="btn-p" disabled={busy || !ok} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>}>
      {fijos.map((f) => <label key={f.concepto} className="campo">{f.concepto} (€)<input inputMode="decimal" value={imp[f.concepto]} onChange={(e) => setImp({ ...imp, [f.concepto]: e.target.value })} /></label>)}
      <p className="sub">El cambio se aplica a los meses que se creen desde ahora. Los ya creados no cambian; se pueden editar uno a uno con «Cambiar importe».</p>
    </Panel>
  );
}
