import { useState, useEffect, useCallback } from "react";
import { F, SF, C, btnDark } from "../../lib/styles.js";
import { IcoCheck } from "../../lib/icons.jsx";
import { fmt2, pn } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";
import { ymd } from "../../lib/turnos.js";

function isoDow(d) { const g = d.getDay(); return g === 0 ? 7 : g; }
const SUG = { "Mañana": "mañana", "Apoyo 1": "mañana", "Tarde": "tarde", "Apoyo 2": "tarde" };
const grpLbl = { fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.mutL, margin: "2px 2px 10px" };

export function CerrarTurnoView({ user }) {
  const hoy = new Date();
  const fecha = ymd(hoy);
  const dow = isoDow(hoy);
  const fechaLarga = hoy.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const [turno, setTurno] = useState(null);
  const [modo, setModo] = useState("ver");
  const [sugerido, setSugerido] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [estado, setEstado] = useState({});
  const [yaCerrado, setYaCerrado] = useState(null);
  const [cajaCerrada, setCajaCerrada] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState("");

  const [caja, setCaja] = useState({ c1e: "", c1t: "", c2e: "", c2t: "" });
  const [provList, setProvList] = useState([]);
  const [selProv, setSelProv] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const r = await sb.select("horarios", `select=turno&usuario_id=eq.${user.id}&fecha=eq.${fecha}`);
        if (r[0] && SUG[r[0].turno]) setSugerido(SUG[r[0].turno]);
      } catch (e) { /* noop */ }
    })();
  }, [user.id, fecha]);

  const load = useCallback(async (tn) => {
    setLoading(true); setMsg("");
    try {
      const ex = await sb.select("cierres_turno", `select=id&usuario_id=eq.${user.id}&fecha=eq.${fecha}&turno=eq.${tn}`);
      if (ex[0]) {
        const items = await sb.select("cierre_items", `select=tarea_texto,hecha,justificacion&cierre_id=eq.${ex[0].id}`);
        setYaCerrado(items);
        try {
          const cc = await sb.select("cierres_caja", `select=*&cierre_turno_id=eq.${ex[0].id}`);
          if (cc[0]) {
            const facs = await sb.select("facturas_proveedores", `select=proveedor,importe,caja&cierre_caja_id=eq.${cc[0].id}`);
            setCajaCerrada({ row: cc[0], facturas: facs });
          } else setCajaCerrada(null);
        } catch (e) { setCajaCerrada(null); }
        setTareas([]); setLoading(false); return;
      }
      setYaCerrado(null); setCajaCerrada(null);
      const all = await sb.select("cierre_tareas", `select=id,orden,texto,dia_semana,hora,grupo&turno=eq.${tn}&activa=eq.true&order=orden.asc`);
      const aplican = all.filter(t => t.dia_semana == null || t.dia_semana === dow);
      setTareas(aplican);
      const st = {}; aplican.forEach(t => { st[t.id] = { estado: null, nota: "" }; });
      setEstado(st);
    } catch (e) { setMsg(e.message || "Error"); }
    setLoading(false);
  }, [user.id, fecha, dow]);

  const cargarProv = useCallback(async (tn) => {
    try {
      const p = await sb.select("facturas_proveedores", `select=id,proveedor,importe&tipo_pago=eq.efectivo&fecha=eq.${fecha}&turno=eq.${tn}&cierre_caja_id=is.null&order=proveedor.asc`);
      setProvList(p);
    } catch (e) { setProvList([]); }
  }, [fecha]);

  const elegir = (tn) => { setTurno(tn); setModo("ver"); load(tn); };
  const volver = () => { setTurno(null); setModo("ver"); setTareas([]); setYaCerrado(null); setCajaCerrada(null); setMsg(""); };
  const abrirCierre = () => { setMsg(""); const st = {}; tareas.forEach(t => { st[t.id] = { estado: null, nota: "" }; }); setEstado(st); setModo("cerrar"); };
  const setEst = (id, v) => setEstado(s => ({ ...s, [id]: { ...s[id], estado: v } }));
  const setNota = (id, v) => setEstado(s => ({ ...s, [id]: { ...s[id], nota: v } }));
  const setProvCaja = (id, n) => setSelProv(s => { const c = { ...s }; if (c[id] === n) delete c[id]; else c[id] = n; return c; });

  const justif = (s) => s.estado === "no" ? s.nota.trim() : null;
  const revisadas = tareas.filter(t => estado[t.id] && estado[t.id].estado).length;

  const irACaja = async () => {
    const sinRevisar = tareas.filter(t => !estado[t.id] || !estado[t.id].estado);
    if (sinRevisar.length) { setMsg(`Te faltan ${sinRevisar.length} ${sinRevisar.length === 1 ? "tarea" : "tareas"} por revisar`); return; }
    const faltaMotivo = tareas.filter(t => { const s = estado[t.id]; return s.estado === "no" && !s.nota.trim(); });
    if (faltaMotivo.length) { setMsg("Indica el motivo de las tareas no hechas"); return; }
    setMsg("");
    await cargarProv(turno);
    setCaja({ c1e: "", c1t: "", c2e: "", c2t: "" });
    setSelProv({});
    setModo("caja");
  };

  const enviar = async () => {
    setSaving(true); setMsg("");
    try {
      const items = tareas.map(t => ({ tarea_id: t.id, tarea_texto: t.texto, hecha: estado[t.id].estado === "hecha", justificacion: justif(estado[t.id]) }));
      const p_caja = { caja1: { efectivo: pn(caja.c1e), tarjeta: pn(caja.c1t) }, caja2: { efectivo: pn(caja.c2e), tarjeta: pn(caja.c2t) } };
      const p_facturas = Object.entries(selProv).map(([id, c]) => ({ id, caja: c }));
      await sb.rpc("cerrar_turno_caja", { p_fecha: fecha, p_turno: turno, p_items: items, p_notas: null, p_caja, p_facturas });
      setConfirmando(false);
      setModo("ver");
      await load(turno);
    } catch (e) { setMsg(e.message || "Error al cerrar"); setConfirmando(false); }
    setSaving(false);
  };

  const filaVer = (t) => (
    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 13, padding: "13px 14px", marginBottom: 9 }}>
      <span style={{ width: 20, height: 20, borderRadius: "999px", border: `2px solid ${C.brd}`, flexShrink: 0 }} />
      <span style={{ fontFamily: F, fontSize: 14, color: C.char, fontWeight: 500 }}>{t.texto}{t.hora ? <span style={{ color: C.mut, fontSize: 12 }}> · {t.hora}</span> : null}</span>
    </div>
  );

  const segBtn = (activo, tipo) => {
    const col = tipo === "hecha" ? C.grn : C.red;
    return { flex: 1, textAlign: "center", padding: "9px", borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 700, border: `1.5px solid ${activo ? col : C.brd}`, background: activo ? col : "#fff", color: activo ? "#fff" : C.mut };
  };

  const tarjetaTarea = (t) => {
    const st = estado[t.id] || { estado: null, nota: "" };
    const done = st.estado === "hecha", no = st.estado === "no";
    return (
      <div key={t.id} style={{ background: "#fff", border: `1.5px solid ${no ? C.red : done ? "#BFE6CC" : C.brdL}`, borderRadius: 13, padding: "13px 14px", marginBottom: 9 }}>
        <div style={{ fontFamily: F, fontSize: 14, color: C.char, fontWeight: 500, marginBottom: 10 }}>{t.texto}{t.hora ? <span style={{ color: C.mut, fontSize: 12 }}> · {t.hora}</span> : null}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setEst(t.id, "hecha")} style={segBtn(done, "hecha")}>Hecha</button>
          <button onClick={() => setEst(t.id, "no")} style={segBtn(no, "no")}>No hecha</button>
        </div>
        {no && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: "#B23A2C", marginBottom: 8 }}>¿Por qué no se ha hecho?</div>
            <input value={st.nota} onChange={e => setNota(t.id, e.target.value)} placeholder="Escribe el motivo" style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", background: "#FBF4F3", border: "1px solid #EDC9C3", borderRadius: 10, fontFamily: F, fontSize: 12.5, color: "#B23A2C", outline: "none" }} />
          </div>
        )}
      </div>
    );
  };

  const cajaInput = (key, label) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: C.mut, marginBottom: 5 }}>{label}</div>
      <div style={{ position: "relative" }}>
        <input value={caja[key]} onChange={e => setCaja(c => ({ ...c, [key]: e.target.value }))} inputMode="decimal" placeholder="0,00" style={{ width: "100%", boxSizing: "border-box", padding: "11px 24px 11px 12px", border: `1.5px solid ${C.brd}`, borderRadius: 10, fontFamily: F, fontSize: 15, color: C.char, outline: "none" }} />
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.mutL, fontFamily: F, fontSize: 14 }}>€</span>
      </div>
    </div>
  );

  const cajaCard = (titulo, kE, kT) => (
    <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 15, padding: 15, marginBottom: 12 }}>
      <div style={{ fontFamily: SF, fontSize: 16, color: C.char, marginBottom: 12 }}>{titulo}</div>
      <div style={{ display: "flex", gap: 10 }}>
        {cajaInput(kE, "Efectivo (ventas)")}
        {cajaInput(kT, "Tarjeta")}
      </div>
    </div>
  );

  if (!turno) {
    return (
      <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
        <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 6 }}>Hoy</div>
        <div style={{ fontFamily: SF, fontSize: 22, color: C.char, textTransform: "capitalize", marginBottom: 22 }}>{fechaLarga}</div>
        <div style={{ fontFamily: F, fontSize: 14, color: C.mut, marginBottom: 14 }}>¿Qué turno vas a hacer?</div>
        {[["mañana", "Turno de mañana", "07:00 – 15:00", "#cbf7d0", "#06281C", "M"], ["tarde", "Turno de tarde", "15:00 – 23:00", "#f5a68e", "#5a1f10", "T"]].map(([tn, lab, horas, bg, fg, ini]) => (
          <button key={tn} onClick={() => elegir(tn)} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", background: "#fff", border: `1.5px solid ${sugerido === tn ? C.gold : C.brdL}`, borderRadius: 16, padding: 18, marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: SF, fontSize: 20 }}>{ini}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontFamily: SF, fontSize: 18, color: C.char }}>{lab}</span>
              <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>{horas}</span>
            </span>
            {sugerido === tn && <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: C.goldSub, background: "#FBF0DA", borderRadius: 999, padding: "4px 9px" }}>Tu turno hoy</span>}
          </button>
        ))}
      </div>
    );
  }

  const diarias = tareas.filter(t => t.grupo !== "semanal");
  const semanales = tareas.filter(t => t.grupo === "semanal");
  const completo = revisadas === tareas.length && tareas.length > 0;

  const ticketsC1 = provList.filter(p => selProv[p.id] === 1).reduce((s, p) => s + Number(p.importe), 0);
  const ticketsC2 = provList.filter(p => selProv[p.id] === 2).reduce((s, p) => s + Number(p.importe), 0);
  const totalTickets = ticketsC1 + ticketsC2;
  const sub1 = pn(caja.c1e) + pn(caja.c1t);
  const sub2 = pn(caja.c2e) + pn(caja.c2t);
  const totalDia = sub1 + sub2;

  const hechasN = tareas.filter(t => estado[t.id] && estado[t.id].estado === "hecha").length;
  const noHechasList = tareas.filter(t => estado[t.id] && estado[t.id].estado === "no").map(t => ({ texto: t.texto, nota: estado[t.id].nota }));

  const backAction = modo === "caja" ? () => { setModo("cerrar"); setMsg(""); } : (modo === "cerrar" && !yaCerrado ? () => { setModo("ver"); setMsg(""); } : volver);
  const backLabel = modo === "caja" ? "‹ Volver a las tareas" : (modo === "cerrar" && !yaCerrado ? "‹ Volver a las tareas" : "‹ Cambiar turno");

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      <button onClick={backAction} style={{ background: "none", border: "none", color: C.blu, fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 10 }}>{backLabel}</button>
      <div style={{ fontFamily: SF, fontSize: 18, color: C.char, textTransform: "capitalize", marginBottom: 14 }}>Turno de {turno}</div>

      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.red, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : yaCerrado ? (
          <div>
            <div style={{ background: "#E7F3EC", color: "#1E7A46", fontFamily: SF, fontSize: 16, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>Turno cerrado ✓</div>
            {yaCerrado.map((it, i) => (
              <div key={i} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 13, padding: "11px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: it.hecha ? C.grn : "#FBEAE7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {it.hecha ? <IcoCheck size={15} color="#fff" sw={3} /> : <span style={{ color: "#B23A2C", fontSize: 13, fontWeight: 700 }}>✕</span>}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F, fontSize: 14, color: C.char }}>{it.tarea_texto}</div>
                  {!it.hecha && it.justificacion && <div style={{ fontFamily: F, fontSize: 12, color: "#B23A2C", marginTop: 3 }}>{it.justificacion}</div>}
                </div>
              </div>
            ))}
            {cajaCerrada && (() => {
              const c = cajaCerrada.row;
              const facs1 = cajaCerrada.facturas.filter(f => f.caja === 1);
              const facs2 = cajaCerrada.facturas.filter(f => f.caja === 2);
              const tk1 = facs1.reduce((s, f) => s + Number(f.importe), 0);
              const tk2 = facs2.reduce((s, f) => s + Number(f.importe), 0);
              const s1 = Number(c.caja1_efectivo) + Number(c.caja1_tarjeta);
              const s2 = Number(c.caja2_efectivo) + Number(c.caja2_tarjeta);
              const provTotal = tk1 + tk2;
              const linea = (l, v, mut) => <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 13, color: mut ? C.mutL : C.mut, marginBottom: 5 }}><span>{l}</span><span style={{ color: mut ? C.mut : C.char, fontWeight: 600 }}>{fmt2(v)}</span></div>;
              const bloque = (titulo, ef, ta, facs, sub) => (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.char, marginBottom: 7 }}>{titulo}</div>
                  {linea("Efectivo (ventas)", ef)}
                  {linea("Tarjeta", ta)}
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 13, color: C.char, fontWeight: 700, marginTop: 4, paddingTop: 6, borderTop: `1px dashed ${C.brdL}` }}><span>Ventas de la caja</span><span>{fmt2(sub)}</span></div>
                  {facs.length > 0 && <div style={{ fontFamily: F, fontSize: 10.5, color: C.mutL, marginTop: 8, marginBottom: 4 }}>Pagado a proveedores desde esta caja (no es venta):</div>}
                  {facs.map((f, i) => linea(`· ${f.proveedor}`, f.importe, true))}
                </div>
              );
              return (
                <div style={{ marginTop: 18 }}>
                  <div style={grpLbl}>Cierre de caja</div>
                  <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 15 }}>
                    {bloque("Caja 1", c.caja1_efectivo, c.caja1_tarjeta, facs1, s1)}
                    {bloque("Caja 2", c.caja2_efectivo, c.caja2_tarjeta, facs2, s2)}
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SF, fontSize: 16, color: C.char, borderTop: `1px solid ${C.brdL}`, paddingTop: 11 }}><span>Total del día</span><span>{fmt2(s1 + s2)}</span></div>
                    {provTotal > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 12, color: C.mutL, marginTop: 8 }}><span>Pagado a proveedores (sale de la caja)</span><span>{fmt2(provTotal)}</span></div>}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : modo === "ver" ? (
          <div>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginBottom: 14 }}>Estas son tus tareas de hoy. Ve haciéndolas y cierra el turno al final.</div>
            {semanales.length > 0 && <div style={grpLbl}>Diarias</div>}
            {diarias.map(filaVer)}
            {semanales.length > 0 && <div style={{ ...grpLbl, marginTop: 18 }}>Hoy además</div>}
            {semanales.map(filaVer)}
            <button onClick={abrirCierre} disabled={tareas.length === 0} style={{ ...btnDark, fontSize: 17, padding: 16, marginTop: 10 }}>Cerrar turno</button>
          </div>
        ) : modo === "cerrar" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10 }}>
              <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Marca cada tarea como hecha o no.</div>
              <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: completo ? C.grn : C.mutL, whiteSpace: "nowrap" }}>{revisadas} / {tareas.length}</div>
            </div>
            {semanales.length > 0 && <div style={grpLbl}>Diarias</div>}
            {diarias.map(tarjetaTarea)}
            {semanales.length > 0 && <div style={{ ...grpLbl, marginTop: 18 }}>Hoy además</div>}
            {semanales.map(tarjetaTarea)}
            <button onClick={irACaja} disabled={!completo} style={{ ...btnDark, fontSize: 17, padding: 16, marginTop: 10, opacity: !completo ? 0.5 : 1 }}>{completo ? "Continuar al cierre de caja" : `Revisa todas (faltan ${tareas.length - revisadas})`}</button>
          </div>
        ) : (
          <div>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginBottom: 16 }}>Indica lo vendido en cada caja: efectivo y tarjeta.</div>
            {cajaCard("Caja 1", "c1e", "c1t")}
            {cajaCard("Caja 2", "c2e", "c2t")}

            <div style={{ marginTop: 6 }}>
              <div style={grpLbl}>Pagos a proveedor en efectivo de este turno</div>
              {provList.length === 0 ? (
                <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "12px 14px" }}>No hay pagos en efectivo a proveedores de este turno.</div>
              ) : (
                <>
                  <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginBottom: 10, lineHeight: 1.4 }}>Marca de qué caja salió el dinero de cada pago en efectivo. Es solo para cuadrar la caja: <b>no cuenta como venta</b>.</div>
                  {provList.map(p => {
                    const sel = selProv[p.id];
                    const cajaBtn = (n) => <button key={n} onClick={() => setProvCaja(p.id, n)} style={{ flex: 1, padding: "9px", borderRadius: 9, cursor: "pointer", fontFamily: F, fontSize: 12.5, fontWeight: 700, border: `1.5px solid ${sel === n ? C.gold : C.brd}`, background: sel === n ? C.gold : "#fff", color: sel === n ? C.goldDark : C.mut }}>Caja {n}</button>;
                    return (
                      <div key={p.id} style={{ background: sel ? "#FBF4E6" : "#fff", border: `1.5px solid ${sel ? C.gold : C.brdL}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <span style={{ flex: 1, fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{p.proveedor}</span>
                          <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.char }}>{fmt2(p.importe)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>{cajaBtn(1)}{cajaBtn(2)}</div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div style={{ background: C.char, borderRadius: 15, padding: "15px 18px", marginTop: 16 }}>
              {[["Caja 1", pn(caja.c1e), pn(caja.c1t), sub1], ["Caja 2", pn(caja.c2e), pn(caja.c2t), sub2]].map(([lab, ef, ta, sub]) => (
                <div key={lab} style={{ marginBottom: 11 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: F, fontSize: 14, color: "#fff", fontWeight: 600 }}><span>{lab}</span><span>{fmt2(sub)}</span></div>
                  <div style={{ fontFamily: F, fontSize: 11.5, color: "#9a927f", marginTop: 2 }}>Efectivo {fmt2(ef)} · Tarjeta {fmt2(ta)}</div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #4A443B", margin: "6px 0 9px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SF, fontSize: 18, color: C.gold }}><span>Total del día</span><span>{fmt2(totalDia)}</span></div>
              {totalTickets > 0 && <div style={{ fontFamily: F, fontSize: 11.5, color: "#9a927f", marginTop: 8 }}>Pagado a proveedores desde la caja: {fmt2(totalTickets)} · no es venta</div>}
            </div>

            <button onClick={() => setConfirmando(true)} style={{ ...btnDark, fontSize: 17, padding: 16, marginTop: 14 }}>Revisar y cerrar</button>
          </div>
        )}

      {confirmando && (
        <div onClick={() => setConfirmando(false)} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 24px" }}>
            <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>Confirmar cierre</div>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginTop: 3, marginBottom: 16, textTransform: "capitalize" }}>Turno de {turno} · {fechaLarga}</div>

            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, background: "#E7F3EC", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: SF, fontSize: 26, color: "#1E7A46", lineHeight: 1 }}>{hechasN}</div>
                <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "#1E7A46", marginTop: 4 }}>hechas</div>
              </div>
              <div style={{ flex: 1, background: noHechasList.length ? "#FBEAE7" : "#F0EADF", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: SF, fontSize: 26, color: noHechasList.length ? "#B23A2C" : C.mut, lineHeight: 1 }}>{noHechasList.length}</div>
                <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: noHechasList.length ? "#B23A2C" : C.mut, marginTop: 4 }}>sin hacer</div>
              </div>
            </div>

            {noHechasList.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 8 }}>Tareas sin hacer</div>
                {noHechasList.map((x, i) => (
                  <div key={i} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 10, padding: "9px 12px", marginBottom: 7 }}>
                    <div style={{ fontFamily: F, fontSize: 13, color: C.char }}>{x.texto}</div>
                    <div style={{ fontFamily: F, fontSize: 12, color: "#B23A2C", marginTop: 2 }}>{x.nota}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: C.char, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: F, fontSize: 13, color: "#fff", fontWeight: 600 }}>Total del día (ventas)</span>
                <span style={{ fontFamily: SF, fontSize: 18, color: C.gold }}>{fmt2(totalDia)}</span>
              </div>
              {totalTickets > 0 && <div style={{ fontFamily: F, fontSize: 11.5, color: "#9a927f", marginTop: 6 }}>Pagado a proveedores desde la caja: {fmt2(totalTickets)} · no es venta</div>}
            </div>

            <div style={{ fontFamily: F, fontSize: 12, color: "#7A5C1A", background: "#FBF4E6", border: "1px solid #EAD9AE", borderRadius: 10, padding: "10px 12px", marginBottom: 16, lineHeight: 1.45 }}>Una vez cerrado, el registro <b>no se puede modificar</b>. Si después ves algo mal, se corrige por la vía de la incidencia.</div>

            <button onClick={enviar} disabled={saving} style={{ ...btnDark, fontSize: 16, padding: 15, opacity: saving ? 0.5 : 1 }}>{saving ? "Cerrando…" : "Sí, cerrar turno"}</button>
            <button onClick={() => setConfirmando(false)} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Revisar</button>
          </div>
        </div>
      )}
    </div>
  );
}
