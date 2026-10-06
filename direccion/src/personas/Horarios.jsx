// Personas · Horarios: cuadrante semanal con la cobertura integrada.
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { TURNOS, TURNO_OPCIONES } from "../../../src/lib/turnos.js";
import { TURNOS_REQUERIDOS } from "../../../src/lib/cobertura.js";
import { Panel, useEquipo, avisar, hoyStr, masDias, lunesDe, fechaCorta, Cargando, Avatar } from "../ui.jsx";

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
    } catch (e) { avisar("No se ha podido guardar el turno", "mal"); cargarSemana(); }
  };

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

  return (
    <>
      <div className="card horarios">
        <div className="head">
          <div>
            <h2>Semana del {fechaCorta(lunes)}</h2>
            <p className="sub">Pulsa una casilla para poner o cambiar el turno.</p>
          </div>
          <div className="nav-sem">
            <button className="btn-l" onClick={() => setLunes(masDias(lunes, -7))} aria-label="Semana anterior">‹</button>
            {lunes !== lunesDe(hoy) && <button className="btn-l" onClick={() => setLunes(lunesDe(hoy))}>Esta semana</button>}
            <button className="btn-l" onClick={() => setLunes(masDias(lunes, 7))} aria-label="Semana siguiente">›</button>
            <button className="btn-l" onClick={() => setNuevoEv({})}>+ Eventual</button>
          </div>
        </div>
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
                <GrupoFilas key={g.id} g={g} dias={dias} mapa={mapa} hoy={hoy} onCelda={setCelda} />
              ))}
              <tr className="cobertura">
                <th>Cobertura</th>
                {dias.map((f) => {
                  const falta = huecosSemana[f];
                  return (
                    <td key={f} className={f === hoy ? "hoy" : ""}>
                      {falta ? falta.map((t) => <button key={t} className="falta" onClick={() => setHueco({ fecha: f, turno: t })} title="Asignar a alguien">Falta {ABREV[t]}</button>)
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
          <p className="sub">Días con algún turno imprescindible ({TURNOS_REQUERIDOS.join(", ")}) sin nadie asignado.</p>
          {!prox ? <p className="empty">Cargando…</p> : huecosProx.length === 0 ? <p className="empty">Todo cubierto ✓</p> : (
            <ul className="huecos">
              {huecosProx.map((h) => (
                <li key={h.fecha + h.turno}>
                  <span className="f">{fechaCorta(h.fecha)}</span>
                  <span className="tchip" style={{ background: TURNOS[h.turno].bg, color: TURNOS[h.turno].fg }}>{h.turno}</span>
                  <button className="btn-l" onClick={() => setHueco(h)}>Asignar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {celda && (
        <Panel titulo={celda.persona.nombre} sub={fechaCorta(celda.fecha)} onClose={() => setCelda(null)}>
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

function GrupoFilas({ g, dias, mapa, hoy, onCelda }) {
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
                <button className={`celda ${t ? "" : "vacia"}`} onClick={() => onCelda({ persona: p, fecha: f })}
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

function AsignarHueco({ hueco, trab, prox, mapa, onClose, onAsignar, onNuevo }) {
  const turnoDe = {};
  prox.forEach((h) => { turnoDe[`${h.usuario_id}|${h.fecha}`] = h.turno; });
  Object.entries(mapa).forEach(([k, t]) => { turnoDe[k] = t; });
  const libres = trab.filter((u) => { const t = turnoDe[`${u.id}|${hueco.fecha}`]; return !(t && (TURNOS_REQUERIDOS.includes(t) || t === "Vacaciones")); });
  return (
    <Panel titulo={`Cubrir ${hueco.turno}`} sub={`${fechaCorta(hueco.fecha)} · ${TURNOS[hueco.turno].horas}`} onClose={onClose}>
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
