// Personas · Horarios: cuadrante semanal con la cobertura integrada.
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { TURNOS, TURNO_OPCIONES } from "../../../src/lib/turnos.js";
import { TURNOS_REQUERIDOS } from "../../../src/lib/cobertura.js";
import { Panel, useEquipo, avisar, hoyStr, masDias, lunesDe, fechaCorta, Cargando, Avatar } from "../ui.jsx";
import { BOLSA_ACTIVA, DIAS_ANTELACION, destinoDe, diasHasta } from "../../../src/lib/bolsa.js"; // BOLSA
import "./bolsa.css"; // BOLSA

const ABREV = { "Mañana": "M", "Tarde": "T", "Apoyo 1": "A1", "Apoyo 2": "A2", "Apoyo 3": "A3", "Descanso": "D", "Vacaciones": "V", "Baja": "B", "Permiso": "P" };
const LIBRES = new Set(["Descanso", "Vacaciones", "Baja", "Permiso"]);
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function huecosDe(filas) {
  const porDia = {};
  filas.forEach((h) => { (porDia[h.fecha] ||= []).push(h.turno); });
  const out = {};
  Object.entries(porDia).forEach(([f, ts]) => { const faltan = TURNOS_REQUERIDOS.filter((t) => !ts.includes(t)); if (faltan.length) out[f] = faltan; });
  return out;
}

export function Horarios() {
  const hoy = hoyStr();
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const { equipo, recargarEquipo } = useEquipo();
  const [mapa, setMapa] = useState(null);
  const [prox, setProx] = useState(null); // horarios 60 días para la cobertura
  const [celda, setCelda] = useState(null); // {persona, fecha}
  const [hueco, setHueco] = useState(null); // {fecha, turno}
  const [nuevoEv, setNuevoEv] = useState(null); // {fecha?, turno?}
  const [bolsa, setBolsa] = useState({}); // BOLSA: "fecha|turno" → oferta abierta (próximos 60 días)

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => masDias(lunes, i)), [lunes]);

  const cargarSemana = useCallback(async () => {
    const r = await sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${lunes}&fecha=lte.${masDias(lunes, 6)}`);
    const m = {}; r.forEach((h) => { m[`${h.usuario_id}|${h.fecha}`] = h.turno; }); setMapa(m);
  }, [lunes]);
  const cargarProx = useCallback(async () => {
    const r = await sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${hoy}&fecha=lte.${masDias(hoy, 60)}`);
    setProx(r);
  }, [hoy]);
  useEffect(() => { setMapa(null); cargarSemana().catch(() => setMapa({})); }, [cargarSemana]);
  useEffect(() => { cargarProx().catch(() => setProx([])); }, [cargarProx]);
  // BOLSA: turnos abiertos en la bolsa (huecos publicados y descansos compensatorios pendientes)
  const cargarBolsa = useCallback(async () => {
    if (!BOLSA_ACTIVA) return;
    const r = await sb.select("bolsa_turnos", `select=id,fecha,turno,origen,descanso_de,publicado_en&estado=eq.abierto&fecha=gte.${hoy}&fecha=lte.${masDias(hoy, 60)}`);
    setBolsa(Object.fromEntries(r.map((b) => [`${b.fecha}|${b.turno}`, b])));
  }, [hoy]);
  useEffect(() => { cargarBolsa().catch(() => setBolsa({})); }, [cargarBolsa]);
  const pendiente = useMemo(() => { const m = {}; Object.values(bolsa).forEach((b) => { if (b.origen === "descanso_comp" && b.descanso_de) m[`${b.descanso_de}|${b.fecha}`] = true; }); return m; }, [bolsa]);

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

  const guardar = async (uid, fecha, turno) => {
    const k = `${uid}|${fecha}`;
    setMapa((m) => { const n = { ...m }; if (turno) n[k] = turno; else delete n[k]; return n; });
    try {
      if (turno) await sb.upsert("horarios", { usuario_id: uid, fecha, turno }, "usuario_id,fecha");
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
  const tocaPublicar = (fecha, turno) => BOLSA_ACTIVA && !bolsa[`${fecha}|${turno}`] && diasHasta(fecha) <= DIAS_ANTELACION;

  const crearEventual = async (nombre, asignar) => {
    try {
      const r = await sb.fn("gestion-usuarios", { action: "crear_eventual", nombre });
      if (asignar && r?.usuario?.id) await sb.upsert("horarios", { usuario_id: r.usuario.id, fecha: asignar.fecha, turno: asignar.turno }, "usuario_id,fecha");
      await recargarEquipo(); await cargarSemana(); await cargarProx();
      avisar(asignar ? "Persona añadida y turno asignado" : "Persona añadida");
    } catch (e) { avisar("No se ha podido crear la persona", "mal"); }
  };

  if (!equipo || !mapa) return <Cargando />;
  const turnosDia = (f) => trab.filter((u) => mapa[`${u.id}|${f}`] && !LIBRES.has(mapa[`${u.id}|${f}`])).length;
  const hayPend = BOLSA_ACTIVA && dias.some((f) => trab.some((u) => pendiente[`${u.id}|${f}`])); // BOLSA

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
            <button className="btn-l" onClick={() => setNuevoEv({})}>+ Eventual</button>
          </div>
        </div>
        {hayPend && <p className="b-leyenda-pend"><b>Borde discontinuo dorado</b><span>= descanso compensatorio pendiente. Esa persona libra en cuanto alguien coja su turno en la bolsa; hasta entonces sigue apuntada.</span></p>}
        <div className="tabla-scroll">
          <table className="cuadrante">
            <thead>
              <tr>
                <th />
                {dias.map((f, i) => (
                  <th key={f} className={f === hoy ? "hoy" : ""}>
                    <span className="d">{DIAS[i]}</span><span className="n">{Number(f.slice(8))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <GrupoFilas key={g.id} g={g} dias={dias} mapa={mapa} hoy={hoy} onCelda={setCelda} pendiente={pendiente} />
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
        </ul>
      </div>

      <div className="grid">
        <div className="card c12">
          <h2>Turnos sin cubrir · próximos 60 días</h2>
          <p className="sub">Días con algún turno imprescindible ({TURNOS_REQUERIDOS.join(", ")}) sin nadie asignado.{BOLSA_ACTIVA ? ` Los que faltan ${DIAS_ANTELACION} días o menos y no están en la bolsa, toca publicarlos.` : ""}</p>
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
        <Panel titulo={celda.persona.nombre} sub={fechaCorta(celda.fecha)} onClose={() => setCelda(null)}>
          {pendiente[`${celda.persona.id}|${celda.fecha}`] && <p className="b-leyenda-pend">Este día es su descanso compensatorio pendiente. Si le cambias el turno a mano, la oferta se retira de la bolsa.</p>}
          <div className="opciones-turno">
            {TURNO_OPCIONES.map((t) => {
              const sel = mapa[`${celda.persona.id}|${celda.fecha}`] === t;
              return (
                <button key={t} className={sel ? "sel" : ""} style={{ background: TURNOS[t].bg, color: TURNOS[t].fg }}
                  onClick={() => { guardar(celda.persona.id, celda.fecha, t); setCelda(null); }}>
                  <b>{t}</b>{TURNOS[t].horas && <small>{TURNOS[t].horas}</small>}
                </button>
              );
            })}
          </div>
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
          onAsignar={async (uid) => { await guardar(uid, hueco.fecha, hueco.turno); setHueco(null); avisar("Turno asignado"); }}
          onNuevo={() => { setNuevoEv(hueco); setHueco(null); }} />
      )}

      {nuevoEv && (
        <NuevoEventual destino={nuevoEv.fecha ? nuevoEv : null} onClose={() => setNuevoEv(null)}
          onCrear={async (nombre) => { await crearEventual(nombre, nuevoEv.fecha ? nuevoEv : null); setNuevoEv(null); }} />
      )}
    </>
  );
}

function GrupoFilas({ g, dias, mapa, hoy, onCelda, pendiente = {} }) {
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
                <button className={`celda ${t ? "" : "vacia"}${pendiente[`${p.id}|${f}`] ? " pend" : ""}`} onClick={() => onCelda({ persona: p, fecha: f })}
                  style={info ? { background: info.bg, color: info.fg } : undefined}
                  aria-label={`${p.nombre}, ${fechaCorta(f)}: ${t || "sin turno"}`} title={t ? `${t}${info?.horas ? " · " + info.horas : ""}` : "Sin turno"}>
                  {t ? ABREV[t] || t : "+"}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function AsignarHueco({ hueco, trab, prox, mapa, enBolsa, onPublicar, onRetirar, onClose, onAsignar, onNuevo }) {
  const turnoDe = {};
  prox.forEach((h) => { turnoDe[`${h.usuario_id}|${h.fecha}`] = h.turno; });
  Object.entries(mapa).forEach(([k, t]) => { turnoDe[k] = t; });
  const libres = trab.filter((u) => { const t = turnoDe[`${u.id}|${hueco.fecha}`]; return !(t && (TURNOS_REQUERIDOS.includes(t) || t === "Vacaciones")); });
  return (
    <Panel titulo={`Cubrir ${hueco.turno}`} sub={`${fechaCorta(hueco.fecha)} · ${TURNOS[hueco.turno].horas}`} onClose={onClose}>
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
      <button className="btn-l" onClick={onNuevo}>+ Persona eventual nueva</button>
    </Panel>
  );
}

function NuevoEventual({ destino, onClose, onCrear }) {
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Panel titulo="Persona eventual" sub={destino ? `Para ${destino.turno} · ${fechaCorta(destino.fecha)}` : "Sin cuenta en la app; solo aparece en los horarios"} onClose={onClose}
      pie={<button className="btn-p" disabled={!nombre.trim() || busy} onClick={async () => { setBusy(true); await onCrear(nombre.trim()); setBusy(false); }}>{busy ? "Creando…" : destino ? "Crear y asignar" : "Crear"}</button>}>
      <label className="campo">Nombre<input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></label>
    </Panel>
  );
}
