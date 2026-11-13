// Personas · Horarios: cuadrante semanal con la cobertura integrada.
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { TURNOS, TURNO_OPCIONES, horasTurno, NOTA_FINDE, HORAS_FORMACION, PRECIO_HORA_FORMACION } from "../../../src/lib/turnos.js";
import { requeridosDe, TURNOS_TRABAJO, REGLA_COBERTURA } from "../../../src/lib/cobertura.js";
import { Panel, useEquipo, avisar, hoyStr, masDias, lunesDe, fechaCorta, Cargando, Avatar } from "../ui.jsx";
import { BOLSA_ACTIVA, DIAS_ANTELACION, destinoDe, diasHasta } from "../../../src/lib/bolsa.js"; // BOLSA
import "./bolsa.css"; // BOLSA
import { cargarFestivos } from "../../../src/lib/festivos.js"; // FESTIVOS
import { FestivosPanel } from "./Festivos.jsx"; // FESTIVOS

const ABREV = { "Mañana": "M", "Tarde": "T", "Apoyo 1": "A1", "Apoyo 2": "A2", "Apoyo 3": "A3", "Descanso": "D", "Vacaciones": "V", "Baja": "B", "Permiso": "P", "Formación": "F", "Libre (debe)": "LD" };
const LIBRES = new Set(["Descanso", "Vacaciones", "Baja", "Permiso", "Formación", "Libre (debe)"]);
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// #197: «vie 20 nov, 13:00» en hora de España
const fechaHora = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");

function huecosDe(filas) {
  const porDia = {};
  filas.forEach((h) => { (porDia[h.fecha] ||= []).push(h.turno); });
  const out = {};
  Object.entries(porDia).forEach(([f, ts]) => { const faltan = requeridosDe(f).filter((t) => !ts.includes(t)); if (faltan.length) out[f] = faltan; });
  return out;
}

export function Horarios({ extra }) {
  const hoy = hoyStr();
  // #112: desde Equipo se llega con "AAAA-MM-DD:<id de la persona>": abre esa semana y el turno de ese día
  const [fechaIn, uidIn] = String(extra || "").split(":");
  const fechaOk = /^\d{4}-\d{2}-\d{2}$/.test(fechaIn || "") ? fechaIn : null;
  const [lunes, setLunes] = useState(lunesDe(fechaOk || hoy));
  const { equipo } = useEquipo();
  const [mapa, setMapa] = useState(null);
  const [prox, setProx] = useState(null); // horarios 60 días para la cobertura
  const [celda, setCelda] = useState(null); // {persona, fecha}
  const [hueco, setHueco] = useState(null); // {fecha, turno}
  const [bolsa, setBolsa] = useState({}); // BOLSA: "fecha|turno" → oferta abierta (próximos 60 días)
  const [festivos, setFestivos] = useState({}); // FESTIVOS: fecha → { nombre, ambito }
  const [verFestivos, setVerFestivos] = useState(false);
  const [horasFor, setHorasFor] = useState({}); // #138: horas de cada formación de la semana ("uid|fecha" → horas)
  const [formando, setFormando] = useState(null); // #138: {horas} mientras se elige la duración de una formación
  const [deb, setDeb] = useState({ nomina: [], saldos: {}, marcas: [] }); // #197: días que debe cada persona de nómina
  const [sacando, setSacando] = useState(false);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => masDias(lunes, i)), [lunes]);
  const abierto = useRef(false);
  useEffect(() => {
    if (abierto.current || !fechaOk || !uidIn || !equipo || !mapa) return;
    const p = equipo.find((u) => u.id === uidIn);
    abierto.current = true;
    if (p) setCelda({ persona: p, fecha: fechaOk });
  }, [fechaOk, uidIn, equipo, mapa]);

  const cargarSemana = useCallback(async () => {
    const r = await sb.select("horarios", `select=usuario_id,fecha,turno,horas_formacion&fecha=gte.${lunes}&fecha=lte.${masDias(lunes, 6)}`);
    const m = {}, hf = {}; r.forEach((h) => { m[`${h.usuario_id}|${h.fecha}`] = h.turno; if (h.turno === "Formación") hf[`${h.usuario_id}|${h.fecha}`] = h.horas_formacion ?? HORAS_FORMACION; }); setMapa(m); setHorasFor(hf);
  }, [lunes]);
  const cargarProx = useCallback(async () => {
    const r = await sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${hoy}&fecha=lte.${masDias(hoy, 60)}`);
    setProx(r);
  }, [hoy]);
  useEffect(() => { setMapa(null); cargarSemana().catch(() => setMapa({})); }, [cargarSemana]);
  useEffect(() => { cargarProx().catch(() => setProx([])); }, [cargarProx]);
  // #197: quién cobra nómina, cuántos días debe y qué días están marcados («Libre (debe)» / «Devolución»)
  const cargarDeb = useCallback(async () => {
    const r = await sb.rpc("dias_debidos_resumen", { p_desde: lunes, p_hasta: masDias(lunes, 6) });
    setDeb(r && typeof r === "object" ? { nomina: r.nomina || [], saldos: r.saldos || {}, marcas: r.marcas || [] } : { nomina: [], saldos: {}, marcas: [] });
  }, [lunes]);
  useEffect(() => { cargarDeb().catch(() => {}); }, [cargarDeb]);
  const devol = useMemo(() => { const m = {}; deb.marcas.forEach((x) => { if (x.tipo === "devolucion") m[`${x.usuario_id}|${x.fecha}`] = true; }); return m; }, [deb]);
  const cargarFest = useCallback(() => cargarFestivos(lunes, masDias(lunes, 6)).then(setFestivos).catch(() => setFestivos({})), [lunes]);
  useEffect(() => { cargarFest(); }, [cargarFest]);
  // BOLSA: turnos abiertos en la bolsa (huecos publicados y descansos compensatorios pendientes)
  const cargarBolsa = useCallback(async () => {
    if (!BOLSA_ACTIVA) return;
    const r = await sb.select("bolsa_turnos", `select=id,fecha,turno,origen,descanso_de,publicado_en,sin_quitar,limite_en&estado=eq.abierto&fecha=gte.${hoy}&fecha=lte.${masDias(hoy, 60)}`);
    setBolsa(Object.fromEntries(r.map((b) => [`${b.fecha}|${b.turno}`, b])));
  }, [hoy]);
  useEffect(() => { cargarBolsa().catch(() => setBolsa({})); }, [cargarBolsa]);
  const pendiente = useMemo(() => { const m = {}; Object.values(bolsa).forEach((b) => { if (b.origen === "descanso_comp" && b.descanso_de && !b.sin_quitar) m[`${b.descanso_de}|${b.fecha}`] = true; }); return m; }, [bolsa]);
  // #197: turnos sacados a la bolsa sin quitar a la titular ("uid|fecha" → oferta)
  const sinQuitar = useMemo(() => { const m = {}; Object.values(bolsa).forEach((b) => { if (b.sin_quitar && b.descanso_de) m[`${b.descanso_de}|${b.fecha}`] = b; }); return m; }, [bolsa]);

  const trab = useMemo(() => (equipo || []).filter((u) => u.rol === "trabajadora" && u.activo), [equipo]);
  const grupos = useMemo(() => {
    const fijos = trab.filter((u) => !u.eventual);
    const tipo = (u) => u.tipo_turno || u.jornada || "";
    const ev = trab.filter((u) => u.eventual && dias.some((f) => mapa && mapa[`${u.id}|${f}`]));
    return [
      { id: "principal", label: "Principales", personas: fijos.filter((u) => tipo(u) === "principal") },
      { id: "apoyo", label: "Apoyos", personas: fijos.filter((u) => tipo(u) === "apoyo") },
      { id: "otros", label: "Equipo", personas: fijos.filter((u) => !["principal", "apoyo"].includes(tipo(u))) },
      { id: "eventual", label: "Eventuales esta semana", personas: ev },
    ].filter((g) => g.personas.length);
  }, [trab, dias, mapa]);

  const huecosSemana = useMemo(() => {
    if (!mapa) return {};
    const filas = Object.entries(mapa).map(([k, turno]) => ({ fecha: k.split("|")[1], turno }));
    return huecosDe(filas);
  }, [mapa]);
  const huecosProx = useMemo(() => {
    if (!prox) return [];
    const h = huecosDe(prox);
    return Object.keys(h).sort().flatMap((f) => h[f].map((t) => ({ fecha: f, turno: t })));
  }, [prox]);

  const guardar = async (uid, fecha, turno, horas) => {
    const k = `${uid}|${fecha}`;
    setMapa((m) => { const n = { ...m }; if (turno) n[k] = turno; else delete n[k]; return n; });
    setHorasFor((m) => { const n = { ...m }; if (turno === "Formación") n[k] = horas; else delete n[k]; return n; });
    try {
      if (turno) await sb.upsert("horarios", { usuario_id: uid, fecha, turno, horas_formacion: turno === "Formación" ? horas : null }, "usuario_id,fecha");
      else await sb.delete("horarios", `usuario_id=eq.${uid}&fecha=eq.${fecha}`);
      cargarProx();
      if (BOLSA_ACTIVA) setTimeout(() => cargarBolsa().catch(() => {}), 400); // si cubría un turno de la bolsa, la base de datos lo retira sola
    } catch (e) { avisar("No se ha podido guardar el turno", "mal"); cargarSemana(); }
  };

  // BOLSA: publicar un hueco o retirarlo
  const publicar = async (fecha, turno) => {
    try {
      const r = await sb.insert("bolsa_turnos", { fecha, turno });
      const b = Array.isArray(r) ? r[0] : r;
      setBolsa((m) => ({ ...m, [`${fecha}|${turno}`]: b || { fecha, turno, origen: "hueco" } }));
      avisar(destinoDe(turno) === "plantilla" ? "Publicado para la plantilla: sale en el resumen de mañana" : "Publicado para las eventuales: sale en el resumen de mañana");
      cargarBolsa().catch(() => {});
    } catch (e) { avisar(/409|23505/.test(String(e.message)) ? "Ya estaba en la bolsa" : "No se ha podido publicar", "mal"); cargarBolsa().catch(() => {}); }
  };
  const retirar = async (fecha, turno) => {
    const b = bolsa[`${fecha}|${turno}`]; if (!b?.id) return;
    if (!window.confirm(`¿Retirar de la bolsa el ${turno} del ${fechaCorta(fecha)}?`)) return;
    try {
      await sb.update("bolsa_turnos", `id=eq.${b.id}`, { estado: "retirado", cerrado_motivo: "retirado_por_direccion" });
      setBolsa((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== `${fecha}|${turno}`)));
      avisar("Retirado de la bolsa");
    } catch (e) { avisar("No se ha podido retirar", "mal"); }
  };
  // #197: sacar a la bolsa sin quitar a la titular, y marcar «Devolución»
  const MOT_SQ = { no_trabaja: "Ese día no tiene un turno de trabajo", eventual: "Las eventuales no pueden sacar su turno así", empezado: "El turno ya ha empezado (hay fichaje o cierre)", sin_tiempo: "Ya no da tiempo: la oferta se cerraría antes de poder avisarla", ya_en_bolsa: "Ese turno ya está en la bolsa", solo_direccion: "Solo dirección puede hacerlo" };
  const sacarSinQuitar = async (uid, fecha) => {
    setSacando(true);
    try {
      const r = await sb.rpc("bolsa_sacar_sin_quitar", { p_uid: uid, p_fecha: fecha });
      if (r?.ok) { avisar(`En la bolsa. Sigue apuntada hasta que alguien lo coja (se cierra ${fechaHora(r.limite)})`); await cargarBolsa(); setCelda(null); }
      else avisar(MOT_SQ[r?.motivo] || "No se ha podido sacar a la bolsa", "mal");
    } catch (e) { avisar("No se ha podido sacar a la bolsa", "mal"); }
    setSacando(false);
  };
  const retirarSinQuitar = async (b) => {
    if (!b?.id || !window.confirm(`¿Retirar de la bolsa el ${b.turno} del ${fechaCorta(b.fecha)}? Sigue con su turno.`)) return;
    try {
      await sb.update("bolsa_turnos", `id=eq.${b.id}`, { estado: "retirado", cerrado_motivo: "retirado_por_direccion" });
      avisar("Retirado de la bolsa: sigue con su turno"); await cargarBolsa(); setCelda(null);
    } catch (e) { avisar("No se ha podido retirar", "mal"); }
  };
  const marcarDevolucion = async (uid, fecha, marcar) => {
    try {
      const r = await sb.rpc("dias_debidos_devolucion", { p_uid: uid, p_fecha: fecha, p_marcar: marcar });
      if (r?.ok) { avisar(marcar ? `Marcado como «Devolución». Días que debe: ${r.saldo}` : `Quitada la «Devolución». Días que debe: ${r.saldo}`); await cargarDeb(); }
      else avisar(r?.motivo === "no_debe" ? "No debe ningún día" : r?.motivo === "no_trabaja" ? "Ese día no tiene un turno de trabajo" : "No se ha podido guardar", "mal");
    } catch (e) { avisar("No se ha podido guardar", "mal"); }
  };
  const tocaPublicar = (fecha, turno) => BOLSA_ACTIVA && !bolsa[`${fecha}|${turno}`] && diasHasta(fecha) <= DIAS_ANTELACION;

  if (!equipo || !mapa) return <Cargando />;
  const turnosDia = (f) => trab.filter((u) => mapa[`${u.id}|${f}`] && !LIBRES.has(mapa[`${u.id}|${f}`])).length;
  const hayPend = BOLSA_ACTIVA && dias.some((f) => trab.some((u) => pendiente[`${u.id}|${f}`])); // BOLSA
  const haySq = BOLSA_ACTIVA && dias.some((f) => trab.some((u) => sinQuitar[`${u.id}|${f}`])); // #197

  return (
    <>
      <div className="card horarios">
        <div className="head">
          <div>
            <h2>Semana del {fechaCorta(lunes)}</h2>
            <p className="sub">Pulsa una casilla para poner o cambiar el turno.{BOLSA_ACTIVA ? " En la fila Cobertura, pulsa un hueco para asignarlo o publicarlo en la bolsa." : ""}</p>
          </div>
          <div className="nav-sem">
            <button className="btn-l" onClick={() => setLunes(masDias(lunes, -7))} aria-label="Semana anterior">‹</button>
            {lunes !== lunesDe(hoy) && <button className="btn-l" onClick={() => setLunes(lunesDe(hoy))}>Esta semana</button>}
            <button className="btn-l" onClick={() => setLunes(masDias(lunes, 7))} aria-label="Semana siguiente">›</button>
            <button className="btn-l" onClick={() => setVerFestivos(true)}>Festivos</button>
          </div>
        </div>
        {hayPend && <p className="b-leyenda-pend"><b>Borde discontinuo dorado</b><span>= descanso compensatorio pendiente. Esa persona libra en cuanto alguien coja su turno en la bolsa; hasta entonces sigue apuntada.</span></p>}
        {haySq && <p className="b-leyenda-sq"><b>En bolsa</b><span>= turno sacado a la bolsa sin quitarla. Si alguien lo coge, se le quita; si no, lo trabaja ella.</span></p>}
        <div className="tabla-scroll">
          <table className="cuadrante">
            <thead>
              <tr>
                <th />
                {dias.map((f, i) => (
                  <th key={f} className={`${f === hoy ? "hoy" : ""}${festivos[f] ? " festivo" : ""}`} title={festivos[f] ? `Festivo: ${festivos[f].nombre}` : undefined}>
                    <span className="d">{DIAS[i]}</span><span className="n">{Number(f.slice(8))}</span>
                    {festivos[f] && <span className="fest">Festivo</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <GrupoFilas key={g.id} g={g} dias={dias} mapa={mapa} hoy={hoy} onCelda={setCelda} pendiente={pendiente} horasFor={horasFor} sinQuitar={sinQuitar} devol={devol} />
              ))}
              <tr className="cobertura">
                <th>Cobertura</th>
                {dias.map((f) => {
                  const falta = huecosSemana[f];
                  return (
                    <td key={f} className={f === hoy ? "hoy" : ""}>
                      {falta ? falta.map((t) => bolsa[`${f}|${t}`]
                        ? <button key={t} className="en-bolsa" onClick={() => setHueco({ fecha: f, turno: t })} title="Publicado en la bolsa: asignar a mano o retirar">En bolsa · {ABREV[t]}</button>
                        : <button key={t} className={`falta${tocaPublicar(f, t) ? " publicar" : ""}`} onClick={() => setHueco({ fecha: f, turno: t })} title={tocaPublicar(f, t) ? "Toca publicarlo en la bolsa" : "Asignar a alguien"}>Falta {ABREV[t]}</button>)
                        : <span className="ok" title={`${turnosDia(f)} personas trabajando`}>✓ {turnosDia(f)}</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="leyenda-turnos">
          {TURNO_OPCIONES.map((t) => <li key={t}><span className="tchip" style={{ background: TURNOS[t].bg, color: TURNOS[t].fg }}>{ABREV[t]}</span>{t}{TURNOS[t].horas && <small> {TURNOS[t].horas}</small>}</li>)}
          <li><small>{NOTA_FINDE}</small></li>
          {dias.some((f) => festivos[f]) && <li><span className="tchip fest-t">F</span><small>{dias.filter((f) => festivos[f]).map((f) => `${festivos[f].nombre} (${Number(f.slice(8))})`).join(" · ")}: plus festivo para quien trabaje</small></li>}
        </ul>
      </div>

      <div className="grid">
        <div className="card c12">
          <h2>Turnos sin cubrir · próximos 60 días</h2>
          <p className="sub">Días con algún turno imprescindible sin nadie asignado ({REGLA_COBERTURA}).{BOLSA_ACTIVA ? ` Los que faltan ${DIAS_ANTELACION} días o menos y no están en la bolsa, toca publicarlos.` : ""}</p>
          {!prox ? <p className="empty">Cargando…</p> : huecosProx.length === 0 ? <p className="empty">Todo cubierto ✓</p> : (
            <ul className="huecos">
              {huecosProx.map((h) => (
                <li key={h.fecha + h.turno}>
                  <span className="f">{fechaCorta(h.fecha)}{BOLSA_ACTIVA && (bolsa[`${h.fecha}|${h.turno}`] ? <small className="en-b">En la bolsa</small> : tocaPublicar(h.fecha, h.turno) && <small className="en-b toca">Toca publicar</small>)}</span>
                  <span className="tchip" style={{ background: TURNOS[h.turno].bg, color: TURNOS[h.turno].fg }}>{h.turno}</span>
                  <button className="btn-l" onClick={() => setHueco(h)}>{BOLSA_ACTIVA ? "Gestionar" : "Asignar"}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {celda && (
        <Panel titulo={celda.persona.nombre} sub={fechaCorta(celda.fecha)} onClose={() => { setCelda(null); setFormando(null); }}>
          {pendiente[`${celda.persona.id}|${celda.fecha}`] && <p className="b-leyenda-pend">Este día es su descanso compensatorio pendiente. Si le cambias el turno a mano, la oferta se retira de la bolsa.</p>}
          <div className="opciones-turno">
            {TURNO_OPCIONES.map((t) => {
              const sel = mapa[`${celda.persona.id}|${celda.fecha}`] === t;
              return (
                <button key={t} className={sel ? "sel" : ""} style={{ background: TURNOS[t].bg, color: TURNOS[t].fg }}
                  onClick={() => { if (t === "Formación") { setFormando({ horas: String(horasFor[`${celda.persona.id}|${celda.fecha}`] ?? HORAS_FORMACION) }); return; } guardar(celda.persona.id, celda.fecha, t); setCelda(null); }}>
                  <b>{t}</b>{TURNOS[t].horas && <small>{horasTurno(t, celda.fecha)}</small>}
                </button>
              );
            })}
          </div>
          {formando && (() => {
            const h = Number(String(formando.horas).replace(",", "."));
            const ok = Number.isFinite(h) && h > 0 && h <= 12;
            return (
              <div className="hueco-acc">
                <span><b>Formación</b>: se paga a {PRECIO_HORA_FORMACION} € la hora en el sobre. Horas de esta sesión:</span>
                <input type="text" inputMode="decimal" value={formando.horas} onChange={(e) => setFormando({ horas: e.target.value })} style={{ width: 70 }} aria-label="Horas de formación" />
                <span>{ok ? `${(h * PRECIO_HORA_FORMACION).toFixed(2).replace(".", ",")} €` : "Pon entre 0,5 y 12 horas"}</span>
                <button className="btn-p" disabled={!ok} onClick={() => { guardar(celda.persona.id, celda.fecha, "Formación", Math.round(h * 100) / 100); setFormando(null); setCelda(null); }}>Guardar formación</button>
              </div>
            );
          })()}
          {BOLSA_ACTIVA && (() => { // #197
            const uid = celda.persona.id, f = celda.fecha, t = mapa[`${uid}|${f}`];
            const sq = sinQuitar[`${uid}|${f}`];
            const esNom = deb.nomina.includes(uid); const saldo = Number(deb.saldos[uid] || 0);
            const trabajo = TURNOS_TRABAJO.includes(t);
            return (
              <>
                {sq ? (
                  <div className="hueco-acc">
                    <span><b>En la bolsa sin quitarla.</b> Si alguien lo coge, se le quita y queda en {esNom ? "«Libre (debe)»" : "«Descanso»"}. Si nadie lo coge, se cierra el {fechaHora(sq.limite_en)} y lo trabaja ella.</span>
                    <button className="btn-l" onClick={() => retirarSinQuitar(sq)}>Retirar de la bolsa</button>
                  </div>
                ) : trabajo && f >= hoy && !celda.persona.eventual && !bolsa[`${f}|${t}`] && (
                  <div className="hueco-acc">
                    <span>¿Pide cambiar este turno? Sale a la bolsa y ella sigue apuntada hasta que alguien lo coja. {esNom ? "Cobra nómina: si se lo cogen, debe el día." : "Cobra por horas: si se lo cogen, ese día no cobra."}</span>
                    <button className="btn-p" disabled={sacando} onClick={() => sacarSinQuitar(uid, f)}>Sacar a la bolsa sin quitarla</button>
                  </div>
                )}
                {esNom && (saldo > 0 || devol[`${uid}|${f}`] || t === "Libre (debe)") && (
                  <div className="hueco-acc">
                    <span>Días que debe: <b>{saldo}</b>{t === "Libre (debe)" ? ". Este día se lo cubrieron desde la bolsa." : ""}</span>
                    {trabajo && (devol[`${uid}|${f}`]
                      ? <button className="btn-l" onClick={() => marcarDevolucion(uid, f, false)}>Quitar «Devolución»</button>
                      : saldo > 0 && <button className="btn-p" onClick={() => marcarDevolucion(uid, f, true)}>Marcar como «Devolución»</button>)}
                  </div>
                )}
              </>
            );
          })()}
          {mapa[`${celda.persona.id}|${celda.fecha}`] && (
            <button className="btn-l quitar" onClick={() => { guardar(celda.persona.id, celda.fecha, null); setCelda(null); }}>Quitar turno</button>
          )}
        </Panel>
      )}

      {hueco && (
        <AsignarHueco hueco={hueco} trab={trab} prox={prox || []} mapa={mapa}
          enBolsa={bolsa[`${hueco.fecha}|${hueco.turno}`]}
          onPublicar={async () => { await publicar(hueco.fecha, hueco.turno); setHueco(null); }}
          onRetirar={async () => { await retirar(hueco.fecha, hueco.turno); setHueco(null); }}
          onClose={() => setHueco(null)}
          onAsignar={async (uid) => { await guardar(uid, hueco.fecha, hueco.turno); setHueco(null); avisar("Turno asignado"); }} />
      )}

      {verFestivos && <FestivosPanel onClose={() => setVerFestivos(false)} onCambio={cargarFest} />}
    </>
  );
}

function GrupoFilas({ g, dias, mapa, hoy, onCelda, pendiente = {}, horasFor = {}, sinQuitar = {}, devol = {} }) {
  return (
    <>
      <tr className="grupo"><th colSpan={8}>{g.label}</th></tr>
      {g.personas.map((p) => (
        <tr key={p.id}>
          <th className="persona"><Avatar nombre={p.nombre} size={26} /><span>{p.nombre}</span></th>
          {dias.map((f) => {
            const t = mapa[`${p.id}|${f}`];
            const info = t && TURNOS[t];
            return (
              <td key={f} className={`${f === hoy ? "hoy" : ""}${f < hoy ? " pasado" : ""}`}>
                <button className={`celda ${t ? "" : "vacia"}${pendiente[`${p.id}|${f}`] ? " pend" : ""}${sinQuitar[`${p.id}|${f}`] ? " sq" : ""}${devol[`${p.id}|${f}`] ? " dev" : ""}`} onClick={() => onCelda({ persona: p, fecha: f })}
                  style={info ? { background: info.bg, color: info.fg } : undefined}
                  aria-label={`${p.nombre}, ${fechaCorta(f)}: ${t || "sin turno"}${sinQuitar[`${p.id}|${f}`] ? " (en bolsa)" : ""}${devol[`${p.id}|${f}`] ? " (devolución)" : ""}`} title={t ? `${t}${info?.horas ? " · " + horasTurno(t, f) : ""}${sinQuitar[`${p.id}|${f}`] ? " · en bolsa" : ""}${devol[`${p.id}|${f}`] ? " · devolución" : ""}` : "Sin turno"}>
                  {t ? (t === "Formación" ? `F ${horasFor[`${p.id}|${f}`] ?? HORAS_FORMACION}h` : ABREV[t] || t) : "+"}
                  {sinQuitar[`${p.id}|${f}`] && <small className="celda-tag">en bolsa</small>}
                  {devol[`${p.id}|${f}`] && <small className="celda-tag">devolución</small>}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function AsignarHueco({ hueco, trab, prox, mapa, enBolsa, onPublicar, onRetirar, onClose, onAsignar }) {
  const turnoDe = {};
  prox.forEach((h) => { turnoDe[`${h.usuario_id}|${h.fecha}`] = h.turno; });
  Object.entries(mapa).forEach(([k, t]) => { turnoDe[k] = t; });
  const libres = trab.filter((u) => { const t = turnoDe[`${u.id}|${hueco.fecha}`]; return !(t && (TURNOS_TRABAJO.includes(t) || t === "Vacaciones")); });
  return (
    <Panel titulo={`Cubrir ${hueco.turno}`} sub={`${fechaCorta(hueco.fecha)} · ${horasTurno(hueco.turno, hueco.fecha)}`} onClose={onClose}>
      {BOLSA_ACTIVA && (enBolsa ? (
        <div className="hueco-acc">
          <span><b>Está en la bolsa</b>{enBolsa.origen === "descanso_comp" ? " como descanso compensatorio" : enBolsa.origen === "cadena" ? " por un cambio de día" : ""}. Si se lo asignas a alguien aquí, se retira de la bolsa solo.</span>
          <button className="btn-l" onClick={onRetirar}>Retirar de la bolsa</button>
        </div>
      ) : (
        <div className="hueco-acc">
          <span>Publícalo y lo verán {destinoDe(hueco.turno) === "plantilla" ? "las compañeras de plantilla que libran ese día (48 h primero las de apoyo)" : "las eventuales con acceso a la app"}. O asígnalo tú abajo.</span>
          <button className="btn-p" onClick={onPublicar}>Publicar en la bolsa</button>
        </div>
      ))}
      {libres.length === 0 ? <p className="empty">Nadie libre este día.</p> : (
        <ul className="lista-personas">
          {libres.map((u) => {
            const t = turnoDe[`${u.id}|${hueco.fecha}`];
            return (
              <li key={u.id}>
                <button onClick={() => onAsignar(u.id)}>
                  <Avatar nombre={u.nombre} size={30} />
                  <span className="n">{u.nombre}{u.eventual && <small> · eventual</small>}</span>
                  <span className="t">{t ? `Tenía: ${t}` : "Sin turno"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
