// Plantilla · Turnos para cubrir (Mañana y Tarde de los días que libra)
//  · Apoyo: cubre cambiando uno de sus días de apoyo de esa semana (+2/+3 h)
//  · Principal: trabaja su día libre (+8 h); si se queda sin descanso semanal,
//    la app le propone un descanso compensatorio
import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, btnDark } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { IcoCheck } from "../../lib/icons.jsx";
import {
  BOLSA_ACTIVA, TELEFONO_DIRECCION, DIAS_SOLTAR, horarioDe, horasDe, fechaLarga, fechaCorta, mesLargo,
  hoyYmd, plazo, diasHasta, horaCorta, motivo,
} from "../../lib/bolsa.js";
import { card, seccion, btnNo, btnSi, btnTexto, ShiftChip, DateBlock, PlazoChip, Toast, Hoja, Fila, PreferenciaAvisos } from "../bolsa/BolsaUI.jsx";

const tel = TELEFONO_DIRECCION.replace(/\s/g, "");

export function CubrirTurnosView({ user }) {
  const esApoyo = user.jornada === "apoyo";
  const [ofertas, setOfertas] = useState([]);
  const [mias, setMias] = useState([]);         // coberturas que he cogido
  const [pend, setPend] = useState([]);         // mis descansos compensatorios pendientes
  const [emailOn, setEmailOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [prev, setPrev] = useState(null);       // bolsa_previsualizar
  const [elegido, setElegido] = useState(null); // fecha del día de apoyo que libra
  const [fase, setFase] = useState(null);       // confirmar | ok | motivo | soltar
  const [mot, setMot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const avisar = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async () => {
    try {
      const hoy = hoyYmd();
      const [o, m, p, u] = await Promise.all([
        sb.rpc("bolsa_disponibles"),
        sb.select("bolsa_turnos", `select=*&cogido_por=eq.${user.id}&estado=eq.cubierto&fecha=gte.${hoy}&order=fecha.asc`),
        sb.select("bolsa_turnos", `select=*&descanso_de=eq.${user.id}&estado=eq.abierto&order=fecha.asc`),
        sb.select("usuarios", `select=avisos_email&id=eq.${user.id}`),
      ]);
      setOfertas((o || []).filter(x => x.destino === "plantilla"));
      setMias(m); setPend(p);
      if (u && u[0]) setEmailOn(u[0].avisos_email !== false);
    } catch (e) { avisar("No se han podido cargar los turnos."); }
    setLoading(false);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const pendientes = useMemo(() => ofertas.filter(o => !o.rechazado), [ofertas]);
  const descartadas = useMemo(() => ofertas.filter(o => o.rechazado), [ofertas]);
  const cerrar = () => { setSel(null); setPrev(null); setElegido(null); setFase(null); setMot(null); };

  const abrir = async (o) => {
    setSel(o); setFase("cargando"); setElegido(null);
    try {
      const r = await sb.rpc("bolsa_previsualizar", { p_id: o.id });
      if (r && r.ok) { setPrev(r); setFase("confirmar"); }
      else { setMot(motivo(r && r.motivo)); setFase("motivo"); load(); }
    } catch (e) { setMot({ titulo: "Error de conexión", texto: "Inténtalo de nuevo en un momento." }); setFase("motivo"); }
  };

  const confirmar = async () => {
    if (!sel || busy || (esApoyo && !elegido)) return;
    setBusy(true);
    try {
      const r = await sb.rpc("aceptar_turno_bolsa", { p_id: sel.id, p_cambio_fecha: esApoyo ? elegido : null });
      if (r && r.ok) { setFase("ok"); load(); }
      else { setMot(motivo(r && r.motivo)); setFase("motivo"); load(); }
    } catch (e) { setMot({ titulo: "No se ha podido cubrir", texto: "Ha fallado la conexión. Inténtalo de nuevo." }); setFase("motivo"); }
    setBusy(false);
  };

  const responder = async (o, noPuedo) => {
    setOfertas(p => p.map(x => x.id === o.id ? { ...x, rechazado: noPuedo } : x));
    try {
      await sb.rpc(noPuedo ? "rechazar_turno_bolsa" : "deshacer_rechazo_turno_bolsa", { p_id: o.id });
      avisar(noPuedo ? "Gracias por avisar. No te avisaremos más de este turno." : "Vuelve a estar en tu lista.");
    } catch (e) { load(); }
  };

  const soltar = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      const r = await sb.rpc("soltar_turno_bolsa", { p_id: sel.id });
      if (r && r.ok) { cerrar(); avisar("Turno devuelto a la bolsa. Todo vuelve a como estaba."); load(); }
      else { setMot(motivo(r && r.motivo)); setFase("motivo"); }
    } catch (e) { setMot({ titulo: "No se ha podido soltar", texto: "Inténtalo de nuevo." }); setFase("motivo"); }
    setBusy(false);
  };

  const cambiarEmail = async (v) => { setEmailOn(v); try { await sb.rpc("bolsa_set_avisos_email", { p_email: v }); } catch (e) { setEmailOn(!v); } };

  if (!BOLSA_ACTIVA) return <div style={{ padding: 30, fontFamily: F, color: C.mut, textAlign: "center" }}>Esta sección aún no está activa.</div>;

  const opcion = prev && prev.opciones ? prev.opciones.find(o => o.fecha === elegido) : null;

  return (
    <div style={{ padding: "16px 16px 40px", maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 8, padding: 16 }}>
        <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>Turnos de Mañana y Tarde sin cubrir</div>
        <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>
          Solo ves los de <strong style={{ color: C.char }}>los días que libras</strong> y con 12 h de descanso entre turnos. Salen con 3 semanas de antelación: responde lo antes posible. Se lo queda la primera que acepta.
        </div>
        <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>
          {esApoyo
            ? <>Tienes <strong style={{ color: C.char }}>prioridad las primeras 48 h</strong>. A cambio libras uno de tus días de apoyo de esa misma semana y se te apuntan como extra <strong style={{ color: C.char }}>las horas de diferencia</strong> entre los dos turnos.</>
            : <>Trabajas tu día libre y se te pagan <strong style={{ color: C.char }}>8 h extra</strong>. Si esa semana te quedas sin tu descanso, te proponemos otro día para descansar.</>}
        </div>
      </div>

      {pend.map(p => (
        <div key={p.id} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 6, border: "1.5px dashed #E0B94A", background: "#FFFBF0" }}>
          <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>Descanso pendiente · {fechaLarga(p.fecha)}</div>
          <div style={{ fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.45 }}>Tu {p.turno} de ese día está en la bolsa para que puedas descansar. <strong style={{ color: C.char }}>Hasta que alguien lo coja, sigues trabajándolo.</strong></div>
        </div>
      ))}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : pendientes.length === 0 ? (
          <div style={{ ...card, flexDirection: "column", alignItems: "center", textAlign: "center", padding: 22, borderStyle: "dashed" }}>
            <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>Nada pendiente</div>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Te avisaremos si sale algún turno en tus días libres.</div>
          </div>
        ) : pendientes.map(o => {
          const prio = esApoyo && o.prioridad_apoyo_hasta && new Date(o.prioridad_apoyo_hasta) > new Date();
          return (
            <div key={o.id} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 12, border: plazo(o.fecha).urgente ? "1.5px solid #E9B9B0" : card.border }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <DateBlock f={o.fecha} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  <ShiftChip turno={o.turno} />
                  <span style={{ fontFamily: F, fontSize: 16.5, fontWeight: 700, color: C.char }}>{horarioDe(o.turno, o.fecha)}</span>
                  <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>
                    {o.origen === "descanso_comp" ? "Descanso de una compañera · " : ""}{esApoyo ? "cambias un día de apoyo" : `${horasDe(o.turno, o.fecha)} h extra`}
                  </span>
                </div>
                <PlazoChip f={o.fecha} />
              </div>
              {prio && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#8A6410", background: "#FBF0DA", borderRadius: 9, padding: "6px 10px", alignSelf: "flex-start" }}>Prioridad para apoyos hasta el {horaCorta(o.prioridad_apoyo_hasta)}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => responder(o, true)} style={btnNo}>No puedo</button>
                <button onClick={() => abrir(o)} style={btnSi}>Lo cubro</button>
              </div>
            </div>
          );
        })}

      {descartadas.length > 0 && (
        <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, textAlign: "center" }}>
          Has dicho que no puedes a {descartadas.length} turno{descartadas.length > 1 ? "s" : ""}.{" "}
          {descartadas.map(o => <button key={o.id} onClick={() => responder(o, false)} style={{ border: "none", background: "none", color: C.goldSub, fontFamily: F, fontSize: 12.5, fontWeight: 700, textDecoration: "underline", cursor: "pointer", padding: "4px 2px" }}>{fechaCorta(o.fecha)}: al final sí puedo</button>)}
        </div>
      )}

      {mias.length > 0 && <>
        <div style={seccion}>Turnos que estás cubriendo</div>
        {mias.map(m => (
          <div key={m.id} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <DateBlock f={m.fecha} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                <ShiftChip turno={m.turno} />
                <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>
                  {m.cogido_como === "apoyo_cambio" ? `A cambio libras tu ${m.cambio_turno} del ${fechaCorta(m.cambio_fecha)} · +${horasDe(m.turno, m.fecha) - horasDe(m.cambio_turno, m.cambio_fecha)} h` : `+${horasDe(m.turno, m.fecha)} h extra`}
                </span>
              </div>
            </div>
            {diasHasta(m.fecha) >= DIAS_SOLTAR
              ? <button onClick={() => { setSel(m); setFase("soltar"); }} style={{ alignSelf: "flex-start", minHeight: 38, padding: "0 12px", border: `1.5px solid ${C.brd}`, borderRadius: 11, background: "#fff", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>Ya no puedo</button>
              : <a href={`tel:${tel}`} style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: C.goldSub }}>¿No puedes? Llama a dirección · {TELEFONO_DIRECCION}</a>}
          </div>
        ))}
      </>}

      <PreferenciaAvisos email={emailOn} onChange={cambiarEmail} />
      <Toast texto={toast} />

      {fase && sel && (
        <Hoja etiqueta="Cubrir turno">
          {fase === "cargando" && <div style={{ fontFamily: F, fontSize: 14, color: C.mut, textAlign: "center", padding: 20 }}>Comprobando…</div>}

          {fase === "confirmar" && prev && (<>
            <div style={{ fontFamily: SF, fontSize: 23, color: C.char }}>Cubres el {fechaCorta(sel.fecha)}</div>
            <div style={{ background: C.cream, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.char, flex: 1 }}>{fechaLarga(sel.fecha)}</span>
              <ShiftChip turno={sel.turno} /><span style={{ fontFamily: F, fontSize: 13, fontWeight: 600 }}>{horarioDe(sel.turno, sel.fecha)}</span>
            </div>

            {prev.tipo === "apoyo_cambio" && (<>
              <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char }}>¿Qué día de esa semana libras a cambio?</div>
              {(prev.opciones || []).length === 0 && <div style={{ fontFamily: F, fontSize: 13, color: C.red }}>No tienes días de apoyo esa semana para cambiar.</div>}
              {(prev.opciones || []).map(op => {
                const on = elegido === op.fecha;
                return (
                  <button key={op.fecha} onClick={() => setElegido(op.fecha)} aria-pressed={on} style={{ minHeight: 48, padding: "0 14px", borderRadius: 14, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: on ? "#FFF8E6" : "#fff", border: on ? `2px solid ${C.gold}` : `1.5px solid ${C.brd}` }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", boxSizing: "border-box", flexShrink: 0, border: on ? `6px solid ${C.char}` : "2px solid #C9C0B0" }} />
                    <span style={{ flex: 1, textAlign: "left", fontFamily: F, fontSize: 14.5, fontWeight: 600, color: C.char }}>{fechaLarga(op.fecha)}</span>
                    <ShiftChip turno={op.turno} />
                    <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>+{op.extra} h</span>
                  </button>
                );
              })}
              {opcion && (
                <div style={{ background: C.cream, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <Fila etiqueta="Tus días libres">Los mismos, solo cambia cuál</Fila>
                  <Fila etiqueta="Horas extra">+{opcion.extra} h en {mesLargo(sel.fecha)}</Fila>
                  <Fila etiqueta={`Tu ${opcion.turno}`}>Pasa a la bolsa de eventuales</Fila>
                </div>
              )}
            </>)}

            {prev.tipo === "principal_extra" && (<>
              <div style={{ background: C.cream, borderRadius: 14, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                <Fila etiqueta="En tu horario">Descanso → {sel.turno}</Fila>
                <Fila etiqueta="Horas extra">+{prev.horas} h en {mesLargo(sel.fecha)}</Fila>
              </div>
              {prev.descanso && prev.descanso.necesario && (prev.descanso.fecha ? (
                <div style={{ background: "#FFFBF0", border: "1.5px dashed #E0B94A", borderRadius: 14, padding: "12px 14px", fontFamily: F, fontSize: 13, lineHeight: 1.5, color: "#6A4A08" }}>
                  <strong>Esa semana te quedas sin tu descanso.</strong> Te proponemos descansar el <strong>{fechaLarga(prev.descanso.fecha)}</strong>. Tu {prev.descanso.turno} de ese día sale a la bolsa y <strong>sigues trabajándolo hasta que alguien lo coja</strong>.
                </div>
              ) : (
                <div style={{ background: "#FBF0DA", borderRadius: 14, padding: "12px 14px", fontFamily: F, fontSize: 13, lineHeight: 1.5, color: "#6A4A08" }}>
                  <strong>Esa semana te quedas sin tu descanso</strong> y no hemos encontrado un día para compensarlo. Dirección te lo organizará.
                </div>
              ))}
            </>)}

            <button onClick={confirmar} disabled={busy || (esApoyo && !elegido)} style={{ ...btnDark, fontSize: 17, opacity: busy || (esApoyo && !elegido) ? 0.45 : 1 }}>{busy ? "Guardando…" : esApoyo ? "Sí, hago el cambio" : "Sí, lo cubro"}</button>
            <button onClick={cerrar} style={btnTexto}>Ahora no</button>
          </>)}

          {fase === "ok" && (<>
            <span style={{ width: 62, height: 62, borderRadius: "50%", background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}><IcoCheck size={32} color={C.goldDark} sw={2.6} /></span>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: SF, fontSize: 24, color: C.char }}>¡Gracias, {(user.nombre || "").split(" ")[0]}!</div>
              <div style={{ fontFamily: F, fontSize: 14, color: C.mut, lineHeight: 1.5, marginTop: 6 }}>
                {esApoyo && opcion ? `Ya está en tu horario: el ${fechaCorta(sel.fecha)} haces ${sel.turno} y el ${fechaCorta(opcion.fecha)} descansas. +${opcion.extra} h apuntadas.` : `Ya está en tu horario. +${horasDe(sel.turno, sel.fecha)} h extra apuntadas.`}
              </div>
            </div>
            <button onClick={cerrar} style={{ ...btnDark, fontSize: 17 }}>Hecho</button>
          </>)}

          {fase === "soltar" && (<>
            <div style={{ fontFamily: SF, fontSize: 23, color: C.char }}>¿Sueltas este turno?</div>
            <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, lineHeight: 1.5 }}>Todo vuelve a como estaba: el turno regresa a la bolsa{sel.cogido_como === "apoyo_cambio" ? `, recuperas tu ${sel.cambio_turno} del ${fechaCorta(sel.cambio_fecha)}` : ""} y se quitan las horas extra.</div>
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
