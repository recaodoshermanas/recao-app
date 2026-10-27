// Cierre de mes → «Tarjeta frente al banco» (solicitud #74). Desde octubre de 2026: caja 1 (datáfono de BBVA, conectado)
// y caja 2 (datáfono de La Caixa, con el extracto en PDF que se sube en Finanzas → Bancos).
// Por día: tarjeta según Epos (esperado de los cierres de la caja), según el datáfono (contado), lo ingresado por el banco
// (BBVA: remesas «LIQUIDACION REMESA DE COMERCIOS»; La Caixa: «ON …» del día de la venta), comisión = datáfono − banco y descuadre = datáfono − Epos.
// La comisión del mes va a Servicios («Comisiones del datáfono · caja N») y el descuadre se suma a «Descuadres de caja».
import { useState } from "react";
import { F, SF, C, crd, inp } from "../../lib/styles.js";
import { fmt2 } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const AMBAR = "#8A5A00";
const dinero = (v) => (v == null ? "–" : fmt2(Number(v)));
const conSigno = (v) => (v == null ? "–" : `${Number(v) > 0 ? "+" : ""}${fmt2(Number(v))}`);
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
const corto = (f) => new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
const num = (s) => { const t = String(s ?? "").trim().replace(/\s/g, ""); if (!t) return null; const x = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(x) ? x : NaN; };

function Corregir({ r, caja, banco, onListo, onCancelar }) {
  const [datafono, setDatafono] = useState("");
  const [bbva, setBbva] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const d = num(datafono), b = num(bbva);
  const valido = (d != null || b != null) && !Number.isNaN(d) && !Number.isNaN(b) && (d == null || d >= 0) && (b == null || b >= 0) && nota.trim();
  const guardar = async () => {
    setBusy(true); setMsg("");
    try { onListo(await sb.rpc("tarjeta_revisar_caja", { p_caja: caja, p_fecha: r.fecha, p_accion: "corregir", p_datafono: d, p_bbva: b, p_nota: nota.trim() })); }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); setBusy(false); }
  };
  const campo = { ...inp, padding: "8px 10px", fontSize: 13, marginBottom: 0 };
  return (
    <div style={{ fontFamily: F, fontSize: 12.5, color: C.char, display: "grid", gap: 8, maxWidth: 380 }}>
      <div style={{ color: C.mut }}>Mete solo lo que esté mal. Si dejas un importe vacío, se queda el que hay.</div>
      <label>Tarjeta del datáfono (hoy {dinero(r.datafono_orig)})<input inputMode="decimal" value={datafono} onChange={(e) => setDatafono(e.target.value)} placeholder="Correcto" style={campo} /></label>
      <label>Ingresado por {banco} (hoy {dinero(r.bbva_orig)})<input inputMode="decimal" value={bbva} onChange={(e) => setBbva(e.target.value)} placeholder="Correcto" style={campo} /></label>
      <label>Nota (obligatoria)<input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Por qué se corrige" style={campo} /></label>
      {msg && <div role="alert" style={{ color: ROJO, fontWeight: 700 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={!valido || busy} onClick={guardar} style={{ fontFamily: F, fontWeight: 700, fontSize: 13, padding: "8px 14px", borderRadius: 10, border: "none", background: !valido || busy ? "#D8D0C4" : C.char, color: !valido || busy ? "#A09888" : C.gold, cursor: !valido || busy ? "default" : "pointer" }}>{busy ? "Guardando…" : "Guardar corrección"}</button>
        <button type="button" onClick={onCancelar} style={{ fontFamily: F, fontSize: 13, padding: "8px 14px", borderRadius: 10, border: `1px solid ${C.brd}`, background: "#fff", cursor: "pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

const CAJAS = {
  1: { banco: "BBVA", nombre: "Caja 1 (datáfono de BBVA)" },
  2: { banco: "La Caixa", nombre: "Caja 2 (datáfono de La Caixa)" },
};

function TarjetaCaja({ caja, mes, datos, d, setDatos }) {
  const { banco, nombre } = CAJAS[caja];
  const [abierta, setAbierta] = useState(false);
  const [fila, setFila] = useState(null);
  const [corrigiendo, setCorrigiendo] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const dias = d.dias || [];
  const t = d.totales || {};
  const ext = d.extracto;
  const sinExtracto = caja === 2 && ext && Number(ext.movimientos) === 0;
  const revisar = Number(t.por_revisar) > 0;
  const darPorBuena = async (r) => {
    setBusy(r.fecha); setMsg("");
    try { setDatos(await sb.rpc("tarjeta_revisar_caja", { p_caja: caja, p_fecha: r.fecha, p_accion: "buena" })); }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(null);
  };
  const celda = { padding: "5px 6px", textAlign: "right", whiteSpace: "nowrap" };
  const color = (v) => ({ fontWeight: 700, color: Number(v) < 0 ? ROJO : Number(v) > 0 ? "#1E6B3C" : C.mut });
  const tot = (l, v, extra) => (
    <div style={{ background: C.cream, borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 700, ...(extra || {}) }}>{v}</div>
    </div>
  );
  return (
    <div style={{ ...crd, padding: 0, overflow: "hidden", border: revisar ? `2px solid ${AMBAR}` : crd.border }}>
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: SF, fontSize: 17, color: C.char }}>Tarjeta frente al banco · caja {caja}</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>
            {nombre} · comisión {dinero(t.comision)} · descuadre {conSigno(t.descuadre)}{revisar ? ` · ${t.por_revisar} día${t.por_revisar === 1 ? "" : "s"} por revisar` : ""}
          </span>
        </span>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: revisar ? "#FBF0DA" : "#EAF4EE", color: revisar ? AMBAR : "#1E6B3C" }}>{revisar ? "Revisar" : "Al día"}</span>
        <span aria-hidden="true" style={{ fontFamily: F, fontSize: 18, color: C.mut, transform: abierta ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {abierta && (
        <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.brdL}`, fontFamily: F }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, margin: "12px 0" }}>
            {tot("Tarjeta Epos", dinero(t.epos))}
            {tot("Datáfono", dinero(t.datafono))}
            {tot(`Ingresado ${banco}`, dinero(t.bbva))}
            {tot("Comisión", dinero(t.comision))}
            {tot("Descuadre", conSigno(t.descuadre), color(t.descuadre))}
            {tot("Días por revisar", String(t.por_revisar || 0), revisar ? { color: AMBAR } : null)}
          </div>
          <div style={{ fontSize: 12.5, color: C.mut, lineHeight: 1.45, marginBottom: 8 }}>
            {caja === 1
              ? "BBVA ingresa la tarjeta de cada día con fecha valor del día siguiente (lo del fin de semana llega junto el lunes). "
              : "La Caixa abona la tarjeta de cada día con un movimiento «ON …» cuyo número final es el día y mes de la venta (se lee del extracto en PDF que subes en Finanzas → Bancos); el pequeño cargo «C. …» del mismo día se suma a la comisión. "}
            Comisión = datáfono − {banco}: va como gasto en Servicios («Comisiones del datáfono · caja {caja}»). Descuadre = datáfono − Epos: si es negativo falta dinero, si es positivo sobra; se suma a «Descuadres de caja». Sale «Revisar» cuando la comisión es negativa o pasa del 3 %, o cuando a los 3 días hábiles no ha llegado la remesa.
            {Number(t.pendientes) > 0 ? ` Hay ${t.pendientes} día${Number(t.pendientes) === 1 ? "" : "s"} esperando la remesa: su comisión no cuenta todavía.` : ""}
          </div>
          {caja === 2 && (
            <div style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 8, color: sinExtracto ? AMBAR : C.mut, fontWeight: sinExtracto ? 700 : 400 }}>
              {sinExtracto ? "Todavía no has subido el extracto de La Caixa: " : ext && ext.ultimo ? `Extracto de La Caixa cargado hasta el ${corto(ext.ultimo)}. Para actualizarlo, ` : ""}
              <a href="#/finanzas/bancos" style={{ color: "inherit" }}>súbelo en Finanzas → Bancos</a>.
            </div>
          )}
          {msg && <div role="alert" style={{ fontSize: 12.5, color: "#fff", background: ROJO, borderRadius: 10, padding: "9px 12px", marginBottom: 8 }}>{msg}</div>}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: C.mut, textAlign: "left" }}>
                  <th style={{ padding: "4px 6px" }}>Día</th><th style={celda}>Epos</th><th style={celda}>Datáfono</th><th style={celda}>{banco}</th><th style={celda}>Comisión</th><th style={celda}>Descuadre</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((r) => {
                  const abierto = fila === r.fecha;
                  return [
                    <tr key={r.fecha} onClick={() => { setFila(abierto ? null : r.fecha); setCorrigiendo(null); }} style={{ borderTop: `1px solid ${C.brdL}`, cursor: "pointer", background: r.revisar ? "#FBF0DA" : "transparent" }}>
                      <td style={{ padding: "5px 6px", textTransform: "capitalize", whiteSpace: "nowrap" }}>
                        {dia(r.fecha)}
                        {r.revisar && <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: AMBAR, textTransform: "none" }}>Revisar</span>}
                        {!r.revisar && r.estado && <span style={{ display: "block", fontSize: 10.5, color: C.mut, textTransform: "none" }}>{r.estado === "buena" ? "Dada por buena" : "Corregida"}</span>}
                      </td>
                      <td style={celda}>{dinero(r.epos)}</td>
                      <td style={celda}>{dinero(r.datafono)}</td>
                      <td style={celda}>{r.pendiente ? <span style={{ color: C.mut }}>Esperando</span> : dinero(r.bbva)}</td>
                      <td style={celda}>{dinero(r.comision)}</td>
                      <td style={celda}><span style={color(r.descuadre)}>{conSigno(r.descuadre)}</span></td>
                    </tr>,
                    abierto && (
                      <tr key={`${r.fecha}-d`}><td colSpan={6} style={{ padding: "6px 6px 12px", background: "#FBF8F1" }}>
                        <div style={{ fontSize: 12.5, color: C.char, lineHeight: 1.5, display: "grid", gap: 6 }}>
                          {r.motivo && <div style={{ color: AMBAR, fontWeight: 700 }}>{r.motivo}</div>}
                          <div>
                            <b>Remesas de {banco}</b>{" "}
                            {(r.remesas || []).length ? r.remesas.map((x) => (x.fv === x.f ? `${dinero(x.i)} (ingresada el ${corto(x.f)})` : `${dinero(x.i)} (fecha valor ${corto(x.fv)}, ingresada el ${corto(x.f)})`)).join(" + ") : <span style={{ color: C.mut }}>Ninguna todavía.</span>}
                          </div>
                          {r.estado === "corregida" && <div>Corregido: {r.datafono !== r.datafono_orig ? `datáfono ${dinero(r.datafono_orig)} → ${dinero(r.datafono)}` : ""}{r.datafono !== r.datafono_orig && r.bbva !== r.bbva_orig ? " · " : ""}{r.bbva !== r.bbva_orig ? `${banco} ${dinero(r.bbva_orig)} → ${dinero(r.bbva)}` : ""}</div>}
                          {r.estado && <div style={{ color: C.mut }}>{r.estado === "buena" ? "Dada por buena" : "Corregida"} por {r.por_nombre || "dirección"} el {new Date(r.en).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{r.nota ? ` · «${r.nota}»` : ""}</div>}
                          {corrigiendo === r.fecha ? (
                            <Corregir r={r} caja={caja} banco={banco} onListo={(d) => { setDatos(d); setCorrigiendo(null); }} onCancelar={() => setCorrigiendo(null)} />
                          ) : (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {r.revisar && <button type="button" disabled={busy === r.fecha} onClick={(e) => { e.stopPropagation(); darPorBuena(r); }} style={{ fontFamily: F, fontWeight: 700, fontSize: 13, padding: "7px 12px", borderRadius: 10, border: "none", background: C.char, color: C.gold, cursor: "pointer" }}>{busy === r.fecha ? "Guardando…" : "Dar por buena"}</button>}
                              <button type="button" onClick={(e) => { e.stopPropagation(); setCorrigiendo(r.fecha); }} style={{ fontFamily: F, fontSize: 13, padding: "7px 12px", borderRadius: 10, border: `1px solid ${C.brd}`, background: "#fff", cursor: "pointer" }}>Corregir</button>
                            </div>
                          )}
                        </div>
                      </td></tr>
                    ),
                  ];
                })}
                {!dias.length && <tr><td colSpan={6} style={{ padding: "8px 6px", color: C.mut }}>Todavía no hay cierres de la caja {caja} este mes.</td></tr>}
                <tr style={{ borderTop: `2px solid ${C.char}`, fontWeight: 700 }}>
                  <td style={{ padding: "6px" }}>Total</td>
                  <td style={celda}>{dinero(t.epos)}</td><td style={celda}>{dinero(t.datafono)}</td><td style={celda}>{dinero(t.bbva)}</td>
                  <td style={celda}>{dinero(t.comision)}</td><td style={celda}><span style={color(t.descuadre)}>{conSigno(t.descuadre)}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function TarjetaBanco({ mes, datos, setDatos }) {
  if (mes < "2026-10" || datos === false) return null;
  if (!datos) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando tarjeta frente al banco…</div>;
  if (!datos.aplica) return null;
  const c1 = datos.caja1 || { dias: datos.dias, totales: datos.totales };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <TarjetaCaja caja={1} mes={mes} datos={datos} d={c1} setDatos={setDatos} />
      {datos.caja2 && <TarjetaCaja caja={2} mes={mes} datos={datos} d={datos.caja2} setDatos={setDatos} />}
    </div>
  );
}
