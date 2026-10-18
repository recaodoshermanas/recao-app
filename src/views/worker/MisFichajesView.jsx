import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW, inp, btnDark, btnGhost, lbl } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

// Mis fichajes: lo que ha registrado la caja este mes y pedir una corrección si algo está mal.
const fn = (accion, datos = {}) => sb.fn("fichajes", { accion, ...datos });
const hora = (t) => (t ? String(t).slice(11, 16) : "—");
const h2 = (n) => { const m = Math.round(Number(n || 0) * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`; };
const dia = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
const AVISO = { sin_fichaje: "No fichaste", sin_salida: "Falta la salida", cero: "Fichaje de 0 minutos", larga: "Fichaje demasiado largo", tarde: "Entrada después de la hora", exceso: "Salida después de la hora" };
const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, boxShadow: SHADOW.card };

export function MisFichajesView({ mesInicial }) {
  const [mes, setMes] = useState(mesInicial || new Date().toISOString().slice(0, 7));
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState("");
  const [pedir, setPedir] = useState(null); // día para el que se pide corrección
  const cargar = useCallback(async () => { setD(null); try { setD(await fn("mis_fichajes", { mes })); } catch (e) { setMsg(e.message || "No se han podido cargar tus fichajes"); setD({ dias: [], solicitudes: [] }); } }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);

  const moverMes = (n) => { const [y, m] = mes.split("-").map(Number); const x = new Date(y, m - 1 + n, 1); setMes(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); };
  const esteMes = mes === new Date().toISOString().slice(0, 7);

  if (pedir) return <PedirCorreccion dia={pedir} onCerrar={(ok) => { setPedir(null); if (ok) { setMsg("Petición enviada a dirección ✓"); cargar(); } }} />;

  const dias = (d?.dias || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const fichado = dias.reduce((s, x) => s + Number(x.horas_fichadas || 0), 0);
  const turno = dias.reduce((s, x) => s + Number(x.horas_turno || 0), 0);
  const solPorDia = new Map((d?.solicitudes || []).map((s) => [s.fecha, s]));

  return (
    <div style={{ padding: "16px 16px 28px", maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" onClick={() => moverMes(-1)} style={{ ...btnGhost, padding: "8px 14px" }} aria-label="Mes anterior">‹</button>
        <div style={{ fontFamily: SF, fontSize: 19 }}>{(() => { const t = new Date(`${mes}-15T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })()}</div>
        <button type="button" onClick={() => moverMes(1)} disabled={esteMes} style={{ ...btnGhost, padding: "8px 14px", opacity: esteMes ? 0.4 : 1 }} aria-label="Mes siguiente">›</button>
      </div>
      {msg && <div role="status" style={{ fontFamily: F, fontSize: 13, borderRadius: 12, padding: "10px 12px", background: msg.includes("✓") ? "#EAF4EE" : "#FBEAE7", color: msg.includes("✓") ? "#1E6B3C" : "#A3362B" }}>{msg}</div>}
      {!d ? <div style={{ padding: 30, textAlign: "center", fontFamily: F, color: C.mut }}>Cargando…</div> : (
        <>
          {!d.vinculada && <div style={{ ...card, background: "#FBF0DA", border: "1px solid #E0B94A", fontFamily: F, fontSize: 13.5 }}>Todavía no tienes usuario propio en la caja, así que tus fichajes no se registran. Pídele a dirección que te dé de alta.</div>}
          <div style={{ ...card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><div style={lbl}>Fichadas</div><div style={{ fontFamily: SF, fontSize: 22 }}>{h2(fichado)}</div></div>
            <div><div style={lbl}>Según tus turnos</div><div style={{ fontFamily: SF, fontSize: 22, color: C.mut }}>{h2(turno)}</div></div>
          </div>
          <p style={{ margin: 0, fontFamily: F, fontSize: 12.5, color: C.mut }}>Esto es lo que ha registrado la caja. Si algo está mal (se te olvidó fichar, fichaste dos veces…), pide que lo corrijan.</p>
          {dias.length === 0 && <div style={{ ...card, fontFamily: F, fontSize: 14, color: C.mut, textAlign: "center" }}>No hay fichajes ni turnos este mes.</div>}
          {dias.map((x) => {
            const avisos = (x.incidencias || []).filter((i) => AVISO[i]);
            const sol = solPorDia.get(x.fecha);
            return (
              <div key={x.fecha} style={{ ...card, display: "flex", flexDirection: "column", gap: 6, border: avisos.length ? "1.5px solid #E0B94A" : card.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, textTransform: "capitalize", minWidth: 64 }}>{dia(x.fecha)}</span>
                  <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut, flex: 1 }}>{x.turno ? `${x.turno} · ${String(x.ini).slice(0, 5)}–${String(x.fin).slice(0, 5)}` : "Sin turno"}</span>
                  <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700 }}>{x.fichajes ? h2(x.horas_fichadas) : ""}</span>
                </div>
                <div style={{ fontFamily: F, fontSize: 13.5 }}>{(x.fichajes || []).map((f) => `${hora(f.entrada)} → ${hora(f.salida)}${f.corregido ? " (corregido)" : ""}`).join(" · ") || "Sin fichajes"}</div>
                {avisos.length > 0 && <div style={{ fontFamily: F, fontSize: 12.5, color: "#8A5A0B", fontWeight: 600 }}>{avisos.map((i) => AVISO[i]).join(" · ")}</div>}
                {sol ? <div style={{ fontFamily: F, fontSize: 12.5, color: sol.estado === "rechazada" ? "#A3362B" : sol.estado === "aceptada" ? "#1E6B3C" : C.mut }}>Corrección {sol.estado === "pendiente" ? "pedida, pendiente de dirección" : sol.estado}{sol.respuesta ? `: ${sol.respuesta}` : ""}</div>
                  : <button type="button" onClick={() => { setMsg(""); setPedir(x); }} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: "6px 0", fontFamily: F, fontSize: 13, fontWeight: 600, color: "#4A4236", textDecoration: "underline", cursor: "pointer" }}>Pedir corrección</button>}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function PedirCorreccion({ dia: x, onCerrar }) {
  const f0 = (x.fichajes || [])[0];
  const [entrada, setEntrada] = useState(f0 ? hora(f0.entrada) : x.ini ? String(x.ini).slice(0, 5) : "");
  const [salida, setSalida] = useState(f0?.salida ? hora(f0.salida) : x.fin ? String(x.fin).slice(0, 5) : "");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const enviar = async () => {
    if (motivo.trim().length < 3) { setMsg("Cuenta brevemente qué pasó"); return; }
    setBusy(true); setMsg("");
    try { await fn("pedir_correccion", { fecha: x.fecha, fichaje_id: f0?.id ?? null, entrada, salida, motivo }); onCerrar(true); }
    catch (e) { setMsg(e.message || "No se ha podido enviar"); }
    setBusy(false);
  };
  return (
    <div style={{ padding: "16px 16px 28px", maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: SF, fontSize: 21, textTransform: "capitalize" }}>Corregir el {dia(x.fecha)}</div>
      <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>La caja registró: {(x.fichajes || []).map((f) => `${hora(f.entrada)} → ${hora(f.salida)}`).join(" · ") || "nada"}. Pon las horas reales; dirección lo revisa.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ fontFamily: F }}><span style={lbl}>Entrada</span><input type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} style={inp} /></label>
        <label style={{ fontFamily: F }}><span style={lbl}>Salida</span><input type="time" value={salida} onChange={(e) => setSalida(e.target.value)} style={inp} /></label>
      </div>
      <label style={{ fontFamily: F }}><span style={lbl}>¿Qué pasó?</span><textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="p. ej. Se me olvidó fichar la salida, cerré a las 23:05" style={{ ...inp, resize: "vertical" }} /></label>
      {msg && <div role="alert" style={{ fontFamily: F, fontSize: 13, color: "#A3362B" }}>{msg}</div>}
      <button type="button" disabled={busy} onClick={enviar} style={{ ...btnDark, opacity: busy ? 0.6 : 1 }}>{busy ? "Enviando…" : "Enviar a dirección"}</button>
      <button type="button" onClick={() => onCerrar(false)} style={{ background: "none", border: "none", fontFamily: F, fontSize: 13, color: C.mut, textDecoration: "underline", cursor: "pointer" }}>Cancelar</button>
    </div>
  );
}
