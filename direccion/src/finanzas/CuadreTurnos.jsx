// Finanzas → Efectivo → Caja → «Cuadre por turno» (solicitud #81). Desde octubre de 2026.
// Una línea por cierre de Epos (día, turno y caja) con el efectivo (lo mismo que la Apertura de sobres: sobres_mes / sobre_revisar)
// y la tarjeta (Epos frente al datáfono); en la última línea de cada caja y día, lo ingresado por el banco y la comisión
// (lo mismo que «Tarjeta frente al banco»: tarjeta_banco_mes / tarjeta_revisar_caja). No cambia ningún cálculo: solo dónde se confirma.
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { eur } from "../fmt.js";

const n = (v) => Number(v) || 0;
const e2 = (v) => (v == null ? "–" : eur(Number(v), 2));
const signo = (v) => (v == null ? "–" : `${Number(v) > 0 ? "+" : ""}${eur(Number(v), 2)}`);
const limpio = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); return s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; };
const numero = (v) => { const s = limpio(v); if (!s) return null; const x = Number(s); return Number.isFinite(x) && /^\d+(\.\d{1,2})?$/.test(s) ? x : NaN; };
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
const cuando = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const BANCO = { 1: "BBVA", 2: "La Caixa" };

const S = {
  linea: { borderTop: "1px solid var(--line)", padding: "12px 0" },
  cab: { display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "space-between" },
  tit: { fontWeight: 700, fontSize: 14, textTransform: "capitalize" },
  mut: { color: "var(--muted)", fontSize: 12.5 },
  bloques: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginTop: 8 },
  bloque: { border: "1px solid var(--line)", borderRadius: 12, padding: "9px 11px", fontSize: 13, lineHeight: 1.5 },
  et: { fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", marginBottom: 2 },
  fila: { display: "flex", justifyContent: "space-between", gap: 8 },
  acciones: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 },
  input: { font: "inherit", fontSize: 13.5, color: "var(--text)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "7px 10px", width: "100%", boxSizing: "border-box" },
  tot: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, margin: "4px 0 14px" },
  totc: { border: "1px solid var(--line)", borderRadius: 12, padding: "9px 11px" },
};
const pill = (tipo) => {
  const c = { ok: ["rgba(46,125,80,.13)", "var(--up)"], mal: ["rgba(178,65,42,.13)", "var(--down)"], aviso: ["rgba(214,160,40,.2)", "var(--text)"], neutro: ["rgba(127,127,127,.13)", "var(--text-2)"] }[tipo];
  return { display: "inline-block", fontSize: 11.5, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: c[0], color: c[1], whiteSpace: "nowrap" };
};
const resaltar = (v, umbral) => (Math.abs(n(v)) > umbral ? { fontWeight: 800, color: "#fff", background: "var(--down)", borderRadius: 6, padding: "0 5px" } : { fontWeight: 700, color: n(v) < 0 ? "var(--down)" : "inherit" });

// ---------- efectivo: igual que en la Apertura de sobres ----------
function Efectivo({ s, umbral, setSobres }) {
  const [modo, setModo] = useState(false);
  const [billetes, setBilletes] = useState(s.billetes != null ? String(s.billetes).replace(".", ",") : "");
  const [nota, setNota] = useState(s.nota || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const x = numero(billetes);
  const valido = x != null && !Number.isNaN(x) && x >= 0;
  const guardar = async (estado, b, nt) => {
    setBusy(true); setMsg("");
    try { setSobres(await sb.rpc("sobre_revisar", { p_eod_id: s.eod_id, p_estado: estado, p_billetes: b, p_nota: nt })); setModo(false); }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  const real = modo && valido ? x + n(s.facturas_total) : s.estado === "incorrecto" ? n(s.billetes) + n(s.facturas_total) : null;
  const desc = modo && valido ? Math.round((x - n(s.deberia)) * 100) / 100 : n(s.descuadre);
  return (
    <div style={S.bloque}>
      <div style={S.et}>Efectivo</div>
      <div style={S.fila}><span>Esperado por Epos</span><span>{e2(s.ef_esperado)}</span></div>
      <div style={S.fila}><span>Contado al cerrar</span><span>{e2(s.ef_contado)}</span></div>
      <div style={S.fila}><span>Diferencia</span><span style={resaltar(s.ef_dif, umbral)}>{signo(s.ef_dif)}</span></div>
      {n(s.facturas_total) > 0 && <div style={S.fila}><span>Facturas pagadas del cajón</span><span>−{e2(s.facturas_total)}</span></div>}
      {n(s.facturas_total) > 0 && <div style={S.mut}>{(s.facturas || []).map((f) => `${f.proveedor} ${e2(f.importe)}`).join(" · ")}</div>}
      <div style={{ ...S.fila, fontWeight: 800, borderTop: "1px dashed var(--line)", marginTop: 4, paddingTop: 4 }}><span>Debería haber en el sobre</span><span style={{ color: n(s.deberia) < 0 ? "var(--down)" : "inherit" }}>{e2(s.deberia)}</span></div>
      {n(s.deberia) < 0 && <div style={{ ...S.mut, color: "var(--down)" }}>Las facturas superan el efectivo del cierre: revisa si alguna se pagó de otro sitio.</div>}
      {s.emergencia && <div style={{ ...S.mut, fontWeight: 700 }}>Con ventas de emergencia: el descuadre del cajón no es una falta de dinero.</div>}
      {s.estado === "incorrecto" && !modo && <div style={{ marginTop: 4 }}>Contado {e2(s.billetes)} en billetes · efectivo real {e2(real)} · <b style={{ color: "var(--down)" }}>descuadre {signo(s.descuadre)}</b>{s.nota ? ` · ${s.nota}` : ""}</div>}
      {s.revisado_por && !modo && <div style={S.mut}>{s.estado === "correcto" ? "Correcto" : "Incorrecto"} · {s.revisado_por}, {cuando(s.revisado_en)}</div>}
      {modo ? (
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <label style={S.mut}>Billetes contados en este sobre
            <input inputMode="decimal" value={billetes} onChange={(e) => setBilletes(e.target.value)} placeholder="0,00" style={S.input} autoFocus />
          </label>
          {valido && <div>Efectivo real del turno {e2(real)} · <b style={desc ? { color: "#fff", background: "var(--down)", borderRadius: 6, padding: "0 5px" } : null}>descuadre {signo(desc)}</b></div>}
          {billetes && !valido && <div style={{ ...S.mut, color: "var(--down)" }}>Pon un importe válido, con 2 decimales como mucho.</div>}
          <label style={S.mut}>Nota (opcional)
            <input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} style={S.input} />
          </label>
          <div style={S.acciones}>
            <button type="button" className="btn-l" onClick={() => { setModo(false); setMsg(""); }}>Cancelar</button>
            <button type="button" className="btn-p" disabled={!valido || busy} onClick={() => guardar("incorrecto", Math.round(x * 100) / 100, nota.trim() || null)}>{busy ? "Guardando…" : "Guardar como incorrecto"}</button>
          </div>
        </div>
      ) : (
        <div style={S.acciones}>
          <button type="button" className={s.estado === "correcto" ? "btn-ok" : "btn-l"} disabled={busy} onClick={() => guardar("correcto", null, null)}>Correcto</button>
          <button type="button" className="btn-l" disabled={busy} onClick={() => setModo(true)} style={s.estado === "incorrecto" ? { borderColor: "var(--down)", color: "var(--down)" } : null}>{s.estado === "incorrecto" ? "Cambiar importe" : "Incorrecto"}</button>
          {s.estado && <button type="button" className="btn-txt" disabled={busy} onClick={() => guardar(null, null, null)}>Dejar sin revisar</button>}
        </div>
      )}
      {msg && <div role="alert" style={{ ...S.mut, color: "var(--down)", fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}

// ---------- tarjeta del día frente al banco: igual que en «Tarjeta frente al banco» ----------
function Banco({ caja, r, setTarjeta }) {
  const banco = BANCO[caja];
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [datafono, setDatafono] = useState("");
  const [bco, setBco] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const d = numero(datafono), b = numero(bco);
  const valido = (d != null || b != null) && !Number.isNaN(d) && !Number.isNaN(b) && nota.trim();
  const enviar = async (accion, extra) => {
    setBusy(true); setMsg("");
    try { setTarjeta(await sb.rpc("tarjeta_revisar_caja", { p_caja: caja, p_fecha: r.fecha, p_accion: accion, ...(extra || {}) })); setCorrigiendo(false); }
    catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  return (
    <div style={{ ...S.bloque, background: r.revisar ? "rgba(214,160,40,.12)" : "transparent" }}>
      <div style={S.et}>{banco} · día completo de la caja {caja}</div>
      <div style={S.fila}><span>Tarjeta del día (Epos / datáfono)</span><span>{e2(r.epos)} / {e2(r.datafono)}</span></div>
      <div style={S.fila}><span>Ingresado por {banco}</span><span>{r.pendiente ? "Esperando la remesa" : e2(r.bbva)}</span></div>
      <div style={S.fila}><span>Comisión</span><span style={{ fontWeight: 700 }}>{e2(r.comision)}</span></div>
      {(r.remesas || []).length > 0 && <div style={S.mut}>{r.remesas.map((x) => `${e2(x.i)} el ${String(x.f).slice(8, 10)}/${String(x.f).slice(5, 7)}`).join(" + ")}</div>}
      {(r.remesas || []).filter((x) => x.por_importe).map((x) => <div key={x.num} style={S.mut}>Encontrado por importe (abono del {String(x.f).slice(8, 10)}/{String(x.f).slice(5, 7)}, número {x.num})</div>)}
      {r.motivo && <div style={{ fontWeight: 700 }}>{r.motivo}</div>}
      {r.estado === "corregida" && <div style={S.mut}>Corregido: {r.datafono !== r.datafono_orig ? `datáfono ${e2(r.datafono_orig)} → ${e2(r.datafono)}` : ""}{r.datafono !== r.datafono_orig && r.bbva !== r.bbva_orig ? " · " : ""}{r.bbva !== r.bbva_orig ? `${banco} ${e2(r.bbva_orig)} → ${e2(r.bbva)}` : ""}</div>}
      {r.estado && <div style={S.mut}>{r.estado === "buena" ? "Dada por buena" : "Corregida"} · {r.por_nombre || "dirección"}, {cuando(r.en)}{r.nota ? ` · «${r.nota}»` : ""}</div>}
      {corrigiendo ? (
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <div style={S.mut}>Mete solo lo que esté mal. Si dejas un importe vacío, se queda el que hay.</div>
          <label style={S.mut}>Tarjeta del datáfono (hoy {e2(r.datafono_orig)})<input inputMode="decimal" value={datafono} onChange={(e) => setDatafono(e.target.value)} placeholder="Correcto" style={S.input} /></label>
          <label style={S.mut}>Ingresado por {banco} (hoy {e2(r.bbva_orig)})<input inputMode="decimal" value={bco} onChange={(e) => setBco(e.target.value)} placeholder="Correcto" style={S.input} /></label>
          <label style={S.mut}>Nota (obligatoria)<input value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder="Por qué se corrige" style={S.input} /></label>
          <div style={S.acciones}>
            <button type="button" className="btn-l" onClick={() => setCorrigiendo(false)}>Cancelar</button>
            <button type="button" className="btn-p" disabled={!valido || busy} onClick={() => enviar("corregir", { p_datafono: d, p_bbva: b, p_nota: nota.trim() })}>{busy ? "Guardando…" : "Guardar corrección"}</button>
          </div>
        </div>
      ) : (
        <div style={S.acciones}>
          {r.revisar && <button type="button" className="btn-p" disabled={busy} onClick={() => enviar("buena")}>{busy ? "Guardando…" : "Dar por buena"}</button>}
          <button type="button" className="btn-l" disabled={busy} onClick={() => setCorrigiendo(true)}>Corregir</button>
        </div>
      )}
      {msg && <div role="alert" style={{ ...S.mut, color: "var(--down)", fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}

function Linea({ s, banco, umbral, setSobres, setTarjeta }) {
  const turno = s.dos_turnos ? "mañana y tarde" : s.turno;
  const ef = s.estado === "correcto" ? ["Efectivo correcto", "ok"] : s.estado === "incorrecto" ? [`Efectivo incorrecto ${signo(s.descuadre)}`, "mal"] : ["Efectivo sin revisar", "neutro"];
  const tj = banco ? (banco.r.revisar ? ["Tarjeta: revisar", "aviso"] : banco.r.pendiente ? ["Esperando la remesa", "neutro"] : ["Tarjeta al día", "ok"]) : null;
  return (
    <div style={S.linea}>
      <div style={S.cab}>
        <div>
          <div style={S.tit}>{dia(s.fecha)} · {turno} · caja {s.caja}</div>
          <div style={S.mut}>{(s.personas || []).join(", ") || "Sin turno en Horarios"}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={pill(ef[1])}>{ef[0]}</span>
          {tj && <span style={pill(tj[1])}>{tj[0]}</span>}
        </div>
      </div>
      <div style={S.bloques}>
        <Efectivo key={`${s.eod_id}-${s.estado}-${s.billetes}`} s={s} umbral={umbral} setSobres={setSobres} />
        <div style={S.bloque}>
          <div style={S.et}>Tarjeta</div>
          <div style={S.fila}><span>Esperado por Epos</span><span>{e2(s.ta_esperado)}</span></div>
          <div style={S.fila}><span>Datáfono</span><span>{e2(s.ta_contado)}</span></div>
          <div style={S.fila}><span>Diferencia</span><span style={resaltar(s.ta_dif, umbral)}>{signo(s.ta_dif)}</span></div>
          {s.caja === 2 && !banco && <div style={S.mut}>La Caixa sale en la última línea de la caja 2 del día.</div>}
        </div>
        {banco && <Banco key={`${banco.caja}-${banco.r.fecha}-${banco.r.estado}-${banco.r.en}`} caja={banco.caja} r={banco.r} setTarjeta={setTarjeta} />}
      </div>
    </div>
  );
}

export function CuadreTurnos({ mes }) {
  const [sobres, setSobres] = useState(null); // null cargando · false sin acceso
  const [tarjeta, setTarjeta] = useState(null);
  const [pendientes, setPendientes] = useState(false);
  const cargar = useCallback(() => {
    setSobres(null); setTarjeta(null);
    sb.rpc("sobres_mes", { p_mes: mes }).then(setSobres, () => setSobres(false));
    sb.rpc("tarjeta_banco_mes", { p_mes: mes }).then(setTarjeta, () => setTarjeta(false));
  }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);

  // la tarjeta frente al banco es por caja y día: va en la última línea de esa caja ese día
  const lineas = useMemo(() => {
    if (!sobres || !sobres.sobres) return [];
    const dias = {};
    if (tarjeta && tarjeta.aplica) {
      const c1 = tarjeta.caja1 || { dias: tarjeta.dias };
      (c1.dias || []).forEach((r) => { dias[`1|${r.fecha}`] = { caja: 1, r }; });
      ((tarjeta.caja2 && tarjeta.caja2.dias) || []).forEach((r) => { dias[`2|${r.fecha}`] = { caja: 2, r }; });
    }
    const orden = [...sobres.sobres].sort((a, b) => (a.fecha === b.fecha ? String(a.abre || "").localeCompare(String(b.abre || "")) : a.fecha.localeCompare(b.fecha)));
    const ultima = {};
    orden.forEach((s, i) => { ultima[`${s.caja}|${s.fecha}`] = i; });
    return orden.map((s, i) => {
      const k = `${s.caja}|${s.fecha}`;
      const banco = ultima[k] === i ? dias[k] || null : null;
      return { s, banco, pendiente: !s.estado || !!(banco && banco.r.revisar) };
    });
  }, [sobres, tarjeta]);

  if (sobres === false) return <div className="card c12"><h2>Cuadre por turno</h2><p className="empty">Solo pueden verlo los socios de dirección.</p></div>;
  if (!sobres) return <div className="card c12"><h2>Cuadre por turno</h2><p className="state">Cargando…</p></div>;
  const umbral = n(sobres.umbral_cajon) || 5;
  const t1 = (tarjeta && tarjeta.caja1 && tarjeta.caja1.totales) || (tarjeta && tarjeta.totales) || {};
  const t2 = (tarjeta && tarjeta.caja2 && tarjeta.caja2.totales) || {};
  const porRevisar = n(t1.por_revisar) + n(t2.por_revisar);
  const comRev = n(t1.comision_revisar) + n(t2.comision_revisar), desRev = n(t1.descuadre_revisar) + n(t2.descuadre_revisar);
  const revisarTxt = porRevisar > 0 ? `${porRevisar} día${porRevisar === 1 ? "" : "s"} por revisar: no cuentan todavía (comisión ${e2(comRev)}, descuadre ${signo(desRev)})` : null; // #97
  const visibles = pendientes ? lineas.filter((l) => l.pendiente) : lineas;
  const tot = (titulo, valor, sub, mal) => (
    <div style={S.totc}>
      <div style={S.et}>{titulo}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: mal ? "var(--down)" : "inherit" }}>{valor}</div>
      {sub && <div style={S.mut}>{sub}</div>}
    </div>
  );
  return (
    <>
      <div style={S.tot}>
        {tot("Descuadre de efectivo", signo(sobres.diferencia || 0), "Suma de los sobres incorrectos", sobres.descuadre)}
        {tot("Descuadre de tarjeta", tarjeta ? signo(n(t1.descuadre) + n(t2.descuadre)) : "…", revisarTxt || "Datáfono − Epos, las dos cajas", false)}
        {tot("Comisión del datáfono", tarjeta ? e2(n(t1.comision) + n(t2.comision)) : "…", revisarTxt || `Caja 1 ${e2(t1.comision)}${tarjeta && tarjeta.caja2 ? ` · caja 2 ${e2(t2.comision)}` : ""}`, false)}
        {tot("Turnos por revisar", `${n(sobres.sin_revisar)} de ${n(sobres.cierres)}`, "Efectivo sin confirmar (cuentan como correctos)", n(sobres.sin_revisar) > 0)}
        {tot("Días de tarjeta por revisar", String(porRevisar), n(t1.pendientes) + n(t2.pendientes) ? `${n(t1.pendientes) + n(t2.pendientes)} esperando la remesa` : null, porRevisar > 0)}
      </div>
      {tarjeta && tarjeta.caja2 && tarjeta.caja2.extracto && Number(tarjeta.caja2.extracto.movimientos) === 0 && <p className="sub">Todavía no se ha subido el extracto de La Caixa: <a href="#/finanzas/banco/bancos">súbelo en Finanzas → Bancos</a>.</p>}
      {(sobres.facturas_sin_sobre || []).length > 0 && <p className="sub aviso-txt">Facturas en efectivo de caja sin ningún cierre de Epos en su turno (no se restan de ningún sobre): {sobres.facturas_sin_sobre.map((f) => `${dia(f.fecha)} · ${f.proveedor} ${e2(f.importe)}`).join("; ")}.</p>}
      <label className="chk" style={{ marginTop: 0 }}><input type="checkbox" checked={pendientes} onChange={(e) => setPendientes(e.target.checked)} /> Solo pendientes ({lineas.filter((l) => l.pendiente).length})</label>
      <p className="sub">Efectivo: «Correcto» si el sobre tiene lo que debería (vale lo marcado) o «Incorrecto» con los billetes contados. Tarjeta: el ingreso del banco y la comisión van en la última línea de cada caja y día. En rojo, las diferencias de más de {e2(umbral)}.</p>
      <div>
        {visibles.length === 0 ? <p className="empty">{lineas.length ? "No queda nada pendiente este mes." : "Todavía no hay cierres de Epos este mes."}</p>
          : visibles.map((l) => <Linea key={l.s.eod_id} s={l.s} banco={l.banco} umbral={umbral} setSobres={setSobres} setTarjeta={setTarjeta} />)}
      </div>
    </>
  );
}
