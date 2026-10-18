// App de las eventuales (v3): solo turnos de APOYO + mis turnos.
import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, btnDark } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { NovedadesEquipo } from "../../components/Novedades.jsx"; // NOVEDADES
import { IcoCheck, IcoCalendar } from "../../lib/icons.jsx";
import {
  BOLSA_ACTIVA, TELEFONO_DIRECCION, DIAS_SOLTAR, esTurnoTrabajo, horarioDe, horasDe,
  fechaLarga, grupoSemana, hoyYmd, plazo, diasHasta, motivo,
} from "../../lib/bolsa.js";
import { card, seccion, btnNo, btnSi, btnTexto, ShiftChip, DateBlock, PlazoChip, Toast, Hoja, PreferenciaAvisos } from "../bolsa/BolsaUI.jsx";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "Apoyo 1", label: "Apoyo 1" },
  { id: "Apoyo 2", label: "Apoyo 2" },
  { id: "Apoyo 3", label: "Apoyo 3" },
];
const CLAVE_NORMA = "recao-bolsa-norma-vista";
function leerNorma() { try { return window.localStorage.getItem(CLAVE_NORMA) === "1"; } catch (e) { return false; } }
function guardarNorma(v) { try { if (v) window.localStorage.setItem(CLAVE_NORMA, "1"); else window.localStorage.removeItem(CLAVE_NORMA); } catch (e) { /* sin almacenamiento */ } }
const tel = TELEFONO_DIRECCION.replace(/\s/g, "");

export function EventualApp({ user }) {
  const [tab, setTab] = useState("bolsa");
  const [filtro, setFiltro] = useState("todos");
  const [ofertas, setOfertas] = useState([]);       // bolsa_disponibles()
  const [mios, setMios] = useState([]);             // horarios de trabajo futuros
  const [deBolsa, setDeBolsa] = useState({});       // fecha → oferta cogida (para poder soltar)
  const [emailOn, setEmailOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [fase, setFase] = useState(null);           // confirmar | ok | motivo | soltar
  const [mot, setMot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verRech, setVerRech] = useState(false);
  const [normaVista, setNormaVista] = useState(leerNorma);
  const [toast, setToast] = useState("");
  const avisar = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async (silencioso) => {
    if (!silencioso) setLoading(true);
    try {
      const hoy = hoyYmd();
      const [o, h, c, u] = await Promise.all([
        sb.rpc("bolsa_disponibles"),
        sb.select("horarios", `select=fecha,turno&usuario_id=eq.${user.id}&fecha=gte.${hoy}&order=fecha.asc`),
        sb.select("bolsa_turnos", `select=id,fecha,turno&cogido_por=eq.${user.id}&estado=eq.cubierto&fecha=gte.${hoy}`),
        sb.select("usuarios", `select=avisos_email&id=eq.${user.id}`),
      ]);
      setOfertas(o || []);
      setMios(h.filter(x => esTurnoTrabajo(x.turno)));
      const m = {}; c.forEach(x => { m[x.fecha] = x; }); setDeBolsa(m);
      if (u && u[0]) setEmailOn(u[0].avisos_email !== false);
      setError("");
    } catch (e) { setError("No se han podido cargar los turnos. Comprueba la conexión."); }
    if (!silencioso) setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 60000);
    const v = () => { if (document.visibilityState === "visible") load(true); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [load]);

  const pendientes = useMemo(() => ofertas.filter(o => !o.rechazado), [ofertas]);
  const descartadas = useMemo(() => ofertas.filter(o => o.rechazado), [ofertas]);
  const urgentes = pendientes.filter(o => plazo(o.fecha).urgente);
  const visibles = filtro === "todos" ? pendientes : pendientes.filter(o => o.turno === filtro);
  const grupos = useMemo(() => {
    const out = [];
    visibles.forEach(o => { const g = grupoSemana(o.fecha); let x = out.find(y => y.titulo === g); if (!x) { x = { titulo: g, items: [] }; out.push(x); } x.items.push(o); });
    return out;
  }, [visibles]);
  const totalHoras = mios.reduce((t, m) => t + horasDe(m.turno, m.fecha), 0);

  const cerrar = () => { setSel(null); setFase(null); setMot(null); };

  const confirmar = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      const r = await sb.rpc("aceptar_turno_bolsa", { p_id: sel.id });
      if (r && r.ok) { setFase("ok"); load(true); }
      else { setMot(motivo(r && r.motivo)); setFase("motivo"); load(true); }
    } catch (e) { setMot({ titulo: "No se ha podido coger", texto: "Ha fallado la conexión. Inténtalo de nuevo." }); setFase("motivo"); }
    setBusy(false);
  };

  const responder = async (o, noPuedo) => {
    setOfertas(prev => prev.map(x => x.id === o.id ? { ...x, rechazado: noPuedo } : x));
    try {
      const r = await sb.rpc(noPuedo ? "rechazar_turno_bolsa" : "deshacer_rechazo_turno_bolsa", { p_id: o.id });
      if (r && r.ok) avisar(noPuedo ? "Gracias por avisar. No te avisaremos más de este turno." : "Vuelve a estar en tus turnos disponibles.");
      else { load(true); avisar("Este turno ya no está en la bolsa."); }
    } catch (e) { load(true); avisar("No se ha podido guardar. Inténtalo de nuevo."); }
  };

  const soltar = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      const r = await sb.rpc("soltar_turno_bolsa", { p_id: sel.id });
      if (r && r.ok) { cerrar(); avisar("Turno devuelto a la bolsa. Dirección ya lo sabe."); load(true); }
      else { setMot(motivo(r && r.motivo)); setFase("motivo"); }
    } catch (e) { setMot({ titulo: "No se ha podido soltar", texto: "Ha fallado la conexión. Inténtalo de nuevo." }); setFase("motivo"); }
    setBusy(false);
  };

  const cambiarEmail = async (v) => {
    setEmailOn(v);
    try { await sb.rpc("bolsa_set_avisos_email", { p_email: v }); avisar(v ? "Recibirás los avisos por email y en la app." : "Solo recibirás los avisos en la app."); }
    catch (e) { setEmailOn(!v); avisar("No se ha podido guardar."); }
  };

  if (!BOLSA_ACTIVA) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 540, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontFamily: SF, fontSize: 22, color: C.char }}>La bolsa de turnos aún no está abierta</div>
        <div style={{ fontFamily: F, fontSize: 14, color: C.mut, marginTop: 8, lineHeight: 1.5 }}>Te avisaremos cuando puedas empezar a coger turnos desde aquí.</div>
      </div>
    );
  }

  const tabBtn = (id, label, n) => {
    const on = tab === id;
    return (
      <button onClick={() => setTab(id)} aria-pressed={on} style={{ flex: 1, minHeight: 44, border: "none", borderRadius: 12, cursor: "pointer", background: on ? C.char : "transparent", color: on ? C.gold : C.mut, fontFamily: F, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
        {label}
        {n > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", boxSizing: "border-box", borderRadius: 999, background: on ? C.gold : C.brdL, color: on ? C.goldDark : C.char, fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>}
      </button>
    );
  };

  return (
    <div style={{ padding: "18px 16px 40px", maxWidth: 540, margin: "0 auto" }}>
      <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>Bolsa de turnos</div>
      <div style={{ fontFamily: SF, fontSize: 28, color: C.char, marginTop: 4 }}>Hola, {(user.nombre || "").split(" ")[0]}</div>
      <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, marginTop: 4, lineHeight: 1.45 }}>
        {pendientes.length === 0 ? "No tienes turnos esperando respuesta." : `${pendientes.length} turno${pendientes.length > 1 ? "s esperan" : " espera"} tu respuesta`}
      </div>

      <NovedadesEquipo estilo={{ marginTop: 16 }} />

      <div role="group" aria-label="Secciones" style={{ display: "flex", gap: 4, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 15, padding: 4, marginTop: 16 }}>
        {tabBtn("bolsa", "Disponibles", pendientes.length)}
        {tabBtn("mis", "Mis turnos", mios.length)}
      </div>

      {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red, background: "#FBEAE7", borderRadius: 12, padding: "10px 12px", marginTop: 14 }}>{error}</div>}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 30 }}>Cargando…</div>
        : tab === "bolsa" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
            {!normaVista ? (
              <div style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 10, padding: 16 }}>
                <div style={{ fontFamily: SF, fontSize: 18, color: C.char }}>Cómo funciona la bolsa</div>
                {[
                  ["Aquí salen los turnos de apoyo", " que hay que cubrir: Apoyo 1, Apoyo 2 y Apoyo 3."],
                  ["Salen con 3 semanas de antelación.", " Así puedes organizarte con tiempo."],
                  ["Responde lo antes posible:", " «Lo cojo» si puedes, «No puedo» si no. Se lo queda la primera que acepta."],
                  ["Si te surge algo,", ` puedes soltarlo desde aquí hasta ${DIAS_SOLTAR} días antes. Después, llama a dirección.`],
                ].map(([b, t]) => <div key={b} style={{ fontFamily: F, fontSize: 13.5, lineHeight: 1.45, color: C.char }}><strong>{b}</strong>{t}</div>)}
                <button onClick={() => { setNormaVista(true); guardarNorma(true); }} style={{ alignSelf: "flex-end", minHeight: 40, padding: "0 14px", border: `1.5px solid ${C.brd}`, background: "#fff", borderRadius: 12, fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char, cursor: "pointer" }}>Entendido</button>
              </div>
            ) : (
              <button onClick={() => { setNormaVista(false); guardarNorma(false); }} style={{ alignSelf: "flex-start", minHeight: 32, padding: 0, border: "none", background: "transparent", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.goldSub, textDecoration: "underline", cursor: "pointer" }}>¿Cómo funciona la bolsa?</button>
            )}

            {urgentes.length > 0 && (
              <div style={{ background: "#FBEAE7", borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: C.red, color: "#fff", fontFamily: SF, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>{urgentes.length}</span>
                <div>
                  <div style={{ fontFamily: F, fontSize: 14.5, fontWeight: 700, color: "#8A2A1F" }}>{urgentes.length === 1 ? "1 turno urgente sin cubrir" : `${urgentes.length} turnos urgentes sin cubrir`}</div>
                  <div style={{ fontFamily: F, fontSize: 13, color: "#8A2A1F", lineHeight: 1.4, marginTop: 2 }}>Quedan 10 días o menos y nadie los ha cogido.</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FILTROS.map(f => { const on = filtro === f.id; return <button key={f.id} onClick={() => setFiltro(f.id)} aria-pressed={on} style={{ minHeight: 40, padding: "0 14px", borderRadius: 999, cursor: "pointer", fontFamily: F, fontSize: 13, fontWeight: 600, background: on ? C.char : "#fff", color: on ? C.gold : C.char, border: `1.5px solid ${on ? C.char : C.brd}` }}>{f.label}</button>; })}
            </div>

            {grupos.length === 0 ? (
              <div style={{ ...card, flexDirection: "column", alignItems: "center", textAlign: "center", padding: 24, borderStyle: "dashed" }}>
                <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>No hay turnos {filtro === "todos" ? "esperando respuesta" : "de este tipo"}</div>
                <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Te avisamos en cuanto salga alguno.</div>
              </div>
            ) : grupos.map(g => (
              <div key={g.titulo} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={seccion}>{g.titulo}</div>
                {g.items.map(o => (
                  <div key={o.id} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 12, border: plazo(o.fecha).urgente ? "1.5px solid #E9B9B0" : card.border }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <DateBlock f={o.fecha} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                        <ShiftChip turno={o.turno} />
                        <span style={{ fontFamily: F, fontSize: 16.5, fontWeight: 700, color: C.char }}>{horarioDe(o.turno, o.fecha)}</span>
                        <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{horasDe(o.turno, o.fecha)} horas{o.nota ? ` · ${o.nota}` : ""}</span>
                      </div>
                      <PlazoChip f={o.fecha} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => responder(o, true)} aria-label={`No puedo el ${o.turno} del ${fechaLarga(o.fecha)}`} style={btnNo}>No puedo</button>
                      <button onClick={() => { setSel(o); setFase("confirmar"); }} aria-label={`Coger el ${o.turno} del ${fechaLarga(o.fecha)}`} style={btnSi}>Lo cojo</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {descartadas.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={() => setVerRech(v => !v)} aria-expanded={verRech} style={{ minHeight: 44, padding: "0 14px", border: `1px solid ${C.brdL}`, borderRadius: 14, background: "#F3EEE4", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char, cursor: "pointer" }}>
                  <span>Has dicho que no puedes · {descartadas.length}</span><span style={{ color: C.goldSub }}>{verRech ? "Ocultar" : "Ver"}</span>
                </button>
                {verRech && descartadas.map(o => (
                  <div key={o.id} style={{ ...card, padding: "12px 14px", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.char }}>{fechaLarga(o.fecha)}</div>
                      <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 3 }}>{o.turno} · {horarioDe(o.turno, o.fecha)}</div>
                    </div>
                    <button onClick={() => responder(o, false)} style={{ minHeight: 40, padding: "0 12px", border: `1.5px solid ${C.brd}`, borderRadius: 11, background: "#fff", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>Al final sí puedo</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <div style={{ background: C.char, borderRadius: 18, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div><div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "#C9C0B0" }}>Próximos turnos</div><div style={{ fontFamily: SF, fontSize: 34, color: C.gold, lineHeight: 1.1 }}>{mios.length}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "#C9C0B0" }}>Horas</div><div style={{ fontFamily: SF, fontSize: 34, color: C.gold, lineHeight: 1.1 }}>{totalHoras}</div></div>
            </div>

            {mios.length === 0 ? (
              <div style={{ ...card, flexDirection: "column", alignItems: "center", textAlign: "center", padding: 24 }}>
                <IcoCalendar size={26} color={C.mutL} />
                <div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>Todavía no tienes turnos. Cuando cojas uno aparecerá aquí.</div>
              </div>
            ) : mios.map(m => {
              const b = deBolsa[m.fecha]; const puedeSoltar = b && diasHasta(m.fecha) >= DIAS_SOLTAR;
              return (
                <div key={m.fecha} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <DateBlock f={m.fecha} />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      <ShiftChip turno={m.turno} />
                      <span style={{ fontFamily: F, fontSize: 16.5, fontWeight: 700, color: C.char }}>{horarioDe(m.turno, m.fecha)}</span>
                      <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{horasDe(m.turno, m.fecha)} horas</span>
                    </div>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: F, fontSize: 12.5, fontWeight: 700, color: "#1E7A46" }}><IcoCheck size={15} color="#1E7A46" sw={2.6} />Tuyo</span>
                  </div>
                  {puedeSoltar && <button onClick={() => { setSel({ ...b, fecha: m.fecha, turno: m.turno }); setFase("soltar"); }} style={{ alignSelf: "flex-start", minHeight: 38, padding: "0 12px", border: `1.5px solid ${C.brd}`, borderRadius: 11, background: "#fff", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>Ya no puedo ir</button>}
                </div>
              );
            })}

            <div style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>¿Te ha surgido algo?</div>
              <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>Hasta {DIAS_SOLTAR} días antes puedes soltar un turno desde aquí. Con menos tiempo, llama a dirección cuanto antes.</div>
              <a href={`tel:${tel}`} style={{ fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.goldSub, padding: "8px 0 2px" }}>Llamar a dirección · {TELEFONO_DIRECCION}</a>
            </div>

            <PreferenciaAvisos email={emailOn} onChange={cambiarEmail} />
          </div>
        )}

      <Toast texto={toast} />

      {fase && sel && (
        <Hoja etiqueta="Turno">
          {fase === "confirmar" && (<>
            <div style={{ fontFamily: SF, fontSize: 23, color: C.char }}>¿Te quedas este turno?</div>
            <div style={{ background: C.cream, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontFamily: F, fontSize: 17, fontWeight: 700, color: C.char }}>{fechaLarga(sel.fecha)}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><ShiftChip turno={sel.turno} /><span style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: C.char }}>{horarioDe(sel.turno, sel.fecha)}</span></div>
              <span style={{ fontFamily: F, fontSize: 13, color: C.mut }}>{horasDe(sel.turno, sel.fecha)} horas · Recao Entrenúcleos{sel.nota ? ` · ${sel.nota}` : ""}</span>
            </div>
            <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>En cuanto confirmes es tuyo y desaparece de la bolsa. Podrás soltarlo hasta {DIAS_SOLTAR} días antes.</div>
            <button onClick={confirmar} disabled={busy} style={{ ...btnDark, fontSize: 17, opacity: busy ? 0.6 : 1 }}>{busy ? "Cogiendo…" : "Sí, me lo quedo"}</button>
            <button onClick={cerrar} disabled={busy} style={btnTexto}>Ahora no</button>
          </>)}
          {fase === "ok" && (<>
            <span style={{ width: 62, height: 62, borderRadius: "50%", background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}><IcoCheck size={32} color={C.goldDark} sw={2.6} /></span>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: SF, fontSize: 24, color: C.char }}>¡El turno es tuyo!</div>
              <div style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: C.char, marginTop: 6 }}>{fechaLarga(sel.fecha)} · {sel.turno}, {horarioDe(sel.turno, sel.fecha)}</div>
            </div>
            <button onClick={() => { cerrar(); setTab("mis"); }} style={{ ...btnDark, fontSize: 17 }}>Ver mis turnos</button>
            <button onClick={cerrar} style={btnTexto}>Seguir mirando</button>
          </>)}
          {fase === "soltar" && (<>
            <div style={{ fontFamily: SF, fontSize: 23, color: C.char }}>¿Sueltas este turno?</div>
            <div style={{ fontFamily: F, fontSize: 14, color: C.char }}>{fechaLarga(sel.fecha)} · {sel.turno}, {horarioDe(sel.turno, sel.fecha)}</div>
            <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>Vuelve a la bolsa para que lo coja otra compañera y dirección recibe el aviso.</div>
            <button onClick={soltar} disabled={busy} style={{ ...btnDark, fontSize: 17, opacity: busy ? 0.6 : 1 }}>{busy ? "Soltando…" : "Sí, lo suelto"}</button>
            <button onClick={cerrar} style={btnTexto}>No, me lo quedo</button>
          </>)}
          {fase === "motivo" && mot && (<>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: SF, fontSize: 24, color: C.char }}>{mot.titulo}</div>
              <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5, marginTop: 6 }}>{mot.texto}</div>
            </div>
            <a href={`tel:${tel}`} style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: C.goldSub, textAlign: "center" }}>Llamar a dirección · {TELEFONO_DIRECCION}</a>
            <button onClick={cerrar} style={{ ...btnDark, fontSize: 17 }}>Volver</button>
          </>)}
        </Hoja>
      )}
    </div>
  );
}
