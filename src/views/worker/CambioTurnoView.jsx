import { useState, useEffect, useCallback } from "react";
import { F, SF, C, btnDark, chipStyle, CHIP } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { TURNOS, ymd } from "../../lib/turnos.js";
import { esTrabajo } from "../../lib/vacaciones.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
function masDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); }
const secLbl = { fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mutL, margin: "22px 2px 10px" };
const back = { background: "none", border: "none", color: C.blu, fontFamily: F, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 };

function ShiftChip({ turno }) {
  const d = TURNOS[turno]; if (!d) return null;
  return <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: d.bg, color: d.fg }}>{turno}</span>;
}

export function CambioTurnoView({ user }) {
  const [mios, setMios] = useState([]);
  const [misTurnos, setMisTurnos] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(1);
  const [mio, setMio] = useState(null);
  const [opciones, setOpciones] = useState([]);
  const [cargandoOp, setCargandoOp] = useState(false);
  const [elegida, setElegida] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2800); };
  const load = useCallback(async () => {
    try {
      const r = await sb.fn("cambios-turno", { action: "mios" });
      setMios(r.cambios || []);
      const rows = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${user.id}&fecha=gte.${ymd(new Date())}&fecha=lte.${masDias(60)}&order=fecha.asc`);
      setMisTurnos(rows.filter(x => esTrabajo(x.turno)));
    } catch (e) { /* noop */ }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const abrir = () => { setAbierto(true); setPaso(1); setMio(null); setElegida(null); setOpciones([]); setMsg(""); };
  const elegirMio = async (t) => {
    setMio(t); setPaso(2); setCargandoOp(true); setOpciones([]);
    try { const r = await sb.fn("cambios-turno", { action: "compatibles", turno_1: t.turno }); setOpciones((r.opciones || []).filter(o => !(o.fecha === t.fecha && o.turno === t.turno))); }
    catch (e) { flash(e.message || "Error"); }
    setCargandoOp(false);
  };
  const elegirOtra = (o) => { setElegida(o); setPaso(3); };
  const enviar = async () => {
    setBusy(true);
    try {
      await sb.fn("cambios-turno", { action: "crear", fecha_1: mio.fecha, turno_1: mio.turno, otra_id: elegida.otra_id, fecha_2: elegida.fecha, turno_2: elegida.turno });
      setAbierto(false); flash("Propuesta enviada"); await load();
    } catch (e) { flash(e.message || "Error"); }
    setBusy(false);
  };
  const cancelar = async (c) => { try { await sb.fn("cambios-turno", { action: "eliminar", id: c.id }); await load(); } catch (e) { flash(e.message); } };

  const cardRow = (onClick, children) => (
    <button onClick={onClick} style={{ width: "100%", boxSizing: "border-box", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "13px 14px", marginBottom: 9, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>{children}</button>
  );

  if (abierto) {
    return (
      <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
        {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.red, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
        {paso === 1 && (
          <div>
            <button onClick={() => setAbierto(false)} style={back}>‹ Cancelar</button>
            <div style={{ fontFamily: SF, fontSize: 19, color: C.char, marginBottom: 4 }}>Elige tu turno a cambiar</div>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginBottom: 16 }}>Tus próximos turnos de trabajo</div>
            {misTurnos.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>No tienes turnos próximos asignados</div>
              : misTurnos.map((t, i) => cardRow(() => elegirMio(t), <>
                <span style={{ flex: 1, fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char, textTransform: "capitalize" }}>{fmtDia(t.fecha)}</span>
                <ShiftChip turno={t.turno} />
              </>))}
          </div>
        )}
        {paso === 2 && (
          <div>
            <button onClick={() => { setPaso(1); setMio(null); }} style={back}>‹ Atrás</button>
            <div style={{ fontFamily: SF, fontSize: 19, color: C.char, marginBottom: 4 }}>¿Con qué turno lo cambias?</div>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginBottom: 16 }}>Cambias tu <b style={{ textTransform: "capitalize" }}>{fmtDia(mio.fecha)} · {mio.turno}</b>. Solo turnos compatibles ({TURNOS[mio.turno].tipo}).</div>
            {cargandoOp ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Buscando turnos compatibles…</div>
              : opciones.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>No hay turnos compatibles disponibles en las próximas semanas</div>
                : opciones.map((o, i) => cardRow(() => elegirOtra(o), <>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>{o.nombre}</span>
                    <span style={{ display: "block", fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 1, textTransform: "capitalize" }}>{fmtDia(o.fecha)}</span>
                  </span>
                  <ShiftChip turno={o.turno} />
                </>))}
          </div>
        )}
        {paso === 3 && elegida && (
          <div>
            <button onClick={() => { setPaso(2); setElegida(null); }} style={back}>‹ Atrás</button>
            <div style={{ fontFamily: SF, fontSize: 19, color: C.char, marginBottom: 16 }}>Confirmar cambio</div>
            <div style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 6 }}>Tú haces ahora</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: F, fontSize: 14, color: C.char, textTransform: "capitalize" }}>{fmtDia(mio.fecha)}</span><ShiftChip turno={mio.turno} /></div>
              <div style={{ textAlign: "center", fontFamily: F, fontSize: 20, color: C.gold, margin: "10px 0" }}>⇅</div>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, marginBottom: 6 }}>Pasarías a hacer</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: F, fontSize: 14, color: C.char, textTransform: "capitalize" }}>{fmtDia(elegida.fecha)}</span><ShiftChip turno={elegida.turno} /><span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>(de {elegida.nombre})</span></div>
            </div>
            <div style={{ fontFamily: F, fontSize: 12, color: C.mutL, margin: "12px 2px" }}>Cada una hará el turno de la otra. Se enviará a dirección para aprobarlo.</div>
            <button onClick={enviar} disabled={busy} style={{ ...btnDark, fontSize: 16, padding: 15, opacity: busy ? 0.6 : 1 }}>{busy ? "Enviando…" : "Enviar propuesta"}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}
      <button onClick={abrir} style={{ ...btnDark, fontSize: 15, padding: 14 }}>+ Proponer cambio de turno</button>

      <div style={secLbl}>Mis cambios</div>
      {mios.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 18 }}>Aún no has propuesto ningún cambio</div>
        : mios.map(c => (
          <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char }}>{c.soyYo ? "Tú" : c.solicitante}</span>
              <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut, textTransform: "capitalize" }}>{fmtDia(c.fecha_1)}</span>
              <ShiftChip turno={c.turno_1} />
              <span style={{ color: C.mutL }}>⇄</span>
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char }}>{c.soyYo ? c.otra : "Tú"}</span>
              <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut, textTransform: "capitalize" }}>{fmtDia(c.fecha_2)}</span>
              <ShiftChip turno={c.turno_2} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <span style={chipStyle(c.estado)}>{CHIP[c.estado].label}</span>
              {c.estado === "pendiente" && c.soyYo && <button onClick={() => cancelar(c)} style={{ background: "none", border: "none", color: C.mutL, fontFamily: F, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>}
            </div>
          </div>
        ))}
    </div>
  );
}
