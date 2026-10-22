// Horas extra pedidas de palabra (solicitud #39): la plantilla y las eventuales las apuntan desde su app y dirección las confirma.
// Se usa en las dos apps. Todo pasa por las funciones he_* (cada persona solo ve lo suyo).
import { useState, useEffect, useCallback } from "react";
import { F, SF, C, btnDark } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { fechaLarga } from "../../lib/bolsa.js";
import { card, seccion, btnTexto, ShiftChip, Hoja, Toast } from "../bolsa/BolsaUI.jsx";

const PRECIO_HORA = 8; // € brutos por hora extra (el mismo que usa «Salarios del mes»)
const hTxt = (n) => Number(n).toLocaleString("es-ES", { maximumFractionDigits: 1 });
const eur2 = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const ESTADO = {
  pendiente: { label: "Pendiente", bg: "#FBF0DA", fg: "#8A6410" },
  confirmada: { label: "Confirmada", bg: "#E7F3EC", fg: "#1E7A46" },
  rechazada: { label: "Rechazada", bg: "#FBEAE7", fg: "#B23A2C" },
};
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : "No se ha podido guardar. Inténtalo de nuevo."; };
// Hora a la que saldría: fin del turno + horas extra (HH:MM)
const salida = (fin, horas) => {
  const [h, m] = String(fin || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  const t = (h * 60 + m + Math.round(horas * 60)) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function HorasExtraView({ user, onCambio }) {
  const [dias, setDias] = useState(null);
  const [mias, setMias] = useState(null);
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [toast, setToast] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([sb.rpc("he_mis_dias"), sb.rpc("he_mis_peticiones")]);
      setDias(d || []); setMias(m || []); setError(false);
      if (onCambio) onCambio(m || []);
    } catch (e) { setError(true); setDias((x) => x || []); setMias((x) => x || []); }
  }, [onCambio]);
  useEffect(() => { cargar(); }, [cargar]);

  const avisar = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };

  return (
    <div style={{ padding: "18px 16px 40px", maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>¿Te han pedido quedarte más tiempo?</div>
        <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>Apúntalo aquí, hasta 7 días después, y dirección lo confirma. Solo cuentan las horas que te hayan pedido en el momento; las de un cambio de turno ya pactado no se apuntan aquí.</div>
        <button onClick={() => setAbierto(true)} disabled={!dias || dias.length === 0} style={{ ...btnDark, fontSize: 16, opacity: !dias || dias.length === 0 ? 0.5 : 1 }}>Apuntar horas extra</button>
        {dias && dias.length === 0 && <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>No tienes días que apuntar: solo salen los días que has trabajado en los últimos 7 y todavía no tienen petición.</div>}
      </div>

      {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red, background: "#FBEAE7", borderRadius: 12, padding: "10px 12px" }}>No se ha podido cargar. Comprueba la conexión.</div>}

      <div style={seccion}>Tus peticiones</div>
      {!mias ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 20 }}>Cargando…</div>
        : mias.length === 0 ? <div style={{ ...card, borderStyle: "dashed", justifyContent: "center", fontFamily: F, fontSize: 13.5, color: C.mut }}>Todavía no has apuntado ninguna.</div>
        : mias.map((p) => {
          const e = ESTADO[p.estado];
          return (
            <div key={p.id} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.char }}>{fechaLarga(p.fecha)}</div>
                <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: e.bg, color: e.fg }}>{e.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {p.turno && <ShiftChip turno={p.turno} />}
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: C.char }}>+{hTxt(p.horas)} h{user.eventual && p.estado === "confirmada" ? ` · ${eur2(p.horas * PRECIO_HORA)}` : ""}</span>
              </div>
              <div style={{ fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.45 }}>{p.motivo}</div>
              {p.estado === "rechazada" && p.motivo_rechazo && <div style={{ fontFamily: F, fontSize: 13, color: "#B23A2C", lineHeight: 1.45 }}>Motivo: {p.motivo_rechazo}</div>}
            </div>
          );
        })}

      <Toast texto={toast} />
      {abierto && <Formulario dias={dias || []} onClose={() => setAbierto(false)} onListo={() => { setAbierto(false); avisar("Enviado a dirección"); cargar(); }} />}
    </div>
  );
}

function Formulario({ dias, onClose, onListo }) {
  const [fecha, setFecha] = useState(dias[0]?.fecha || "");
  const [horas, setHoras] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dia = dias.find((d) => d.fecha === fecha);
  const boton = { width: 46, height: 46, borderRadius: 12, border: `1.5px solid ${C.brd}`, background: "#fff", fontFamily: F, fontSize: 22, fontWeight: 700, color: C.char, cursor: "pointer" };
  const enviar = async () => {
    setBusy(true); setError("");
    try { await sb.rpc("he_pedir", { p_fecha: fecha, p_horas: horas, p_motivo: motivo.trim() }); onListo(); }
    catch (e) { setError(msg(e)); setBusy(false); }
  };
  return (
    <Hoja etiqueta="Apuntar horas extra">
      <div style={{ fontFamily: SF, fontSize: 23, color: C.char }}>Apuntar horas extra</div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em" }}>Día
        <select value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ minHeight: 48, borderRadius: 12, border: `1.5px solid ${C.brd}`, padding: "0 12px", fontFamily: F, fontSize: 15, color: C.char, background: "#fff", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>
          {dias.map((d) => <option key={d.fecha} value={d.fecha}>{fechaLarga(d.fecha)} · {d.turno}</option>)}
        </select>
      </label>
      <div>
        <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Horas de más</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button type="button" style={boton} onClick={() => setHoras((h) => Math.max(0.5, h - 0.5))} aria-label="Menos media hora">−</button>
          <div style={{ minWidth: 70, textAlign: "center", fontFamily: SF, fontSize: 28, color: C.char }}>{hTxt(horas)} h</div>
          <button type="button" style={boton} onClick={() => setHoras((h) => h + 0.5)} aria-label="Más media hora">+</button>
        </div>
        {dia && <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginTop: 8 }}>Habrías salido a las {salida(dia.fin, horas)} (el turno acaba a las {String(dia.fin).slice(0, 5)}).</div>}
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.08em" }}>¿Qué pasó?
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} placeholder="Ej.: Me pidieron quedarme a recoger el pedido" style={{ borderRadius: 12, border: `1.5px solid ${C.brd}`, padding: 12, fontFamily: F, fontSize: 15, color: C.char, resize: "vertical", textTransform: "none", letterSpacing: 0, fontWeight: 500 }} />
      </label>
      {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>{error}</div>}
      <button onClick={enviar} disabled={busy || !fecha || !motivo.trim()} style={{ ...btnDark, fontSize: 17, opacity: busy || !fecha || !motivo.trim() ? 0.5 : 1 }}>{busy ? "Enviando…" : "Enviar a dirección"}</button>
      <button onClick={onClose} disabled={busy} style={btnTexto}>Cancelar</button>
    </Hoja>
  );
}
