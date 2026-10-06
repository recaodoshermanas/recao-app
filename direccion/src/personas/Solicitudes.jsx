// Personas · Solicitudes: vacaciones y cambios de turno en una sola bandeja, más saldos y ajustes.
// La lógica de aceptar/rechazar vacaciones es la misma que en la app (guarda y restaura los turnos).
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { resumenCalendario, rangoFechas, diasQueGastan, agruparRangos } from "../../../src/lib/vacaciones.js";
import { VacacionesPicker } from "../../../src/components/VacacionesPicker.jsx";
import { FechasCerradas } from "../../../src/components/FechasCerradas.jsx";
import { VacacionesNormas } from "../../../src/components/VacacionesNormas.jsx";
import { Panel, Pestanas, useEquipo, avisar, hoyStr, fechaCorta, fechaDia, Cargando, Avatar, hace } from "../ui.jsx";

const ESTADOS = { pendiente: "Pendiente", aceptado: "Aceptada", rechazado: "Rechazada" };
const rango = (s) => (s.fecha_inicio === s.fecha_fin ? fechaCorta(s.fecha_inicio) : `${fechaCorta(s.fecha_inicio)} → ${fechaCorta(s.fecha_fin)}`);

export function Solicitudes() {
  const ANIO = new Date().getFullYear();
  const hoy = hoyStr();
  const { equipo } = useEquipo();
  const [vista, setVista] = useState("pendientes");
  const [sols, setSols] = useState(null);
  const [conf, setConf] = useState({});
  const [saldos, setSaldos] = useState({});
  const [vacDias, setVacDias] = useState({});
  const [descansos, setDescansos] = useState({});
  const [cambios, setCambios] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [hist, setHist] = useState(null);
  const [normas, setNormas] = useState(false);
  const [busy, setBusy] = useState(null);

  const trab = useMemo(() => (equipo || []).filter((u) => u.rol === "trabajadora"), [equipo]);
  const trabReg = useMemo(() => trab.filter((u) => !u.eventual && u.activo), [trab]);
  const nombreDe = useMemo(() => Object.fromEntries((equipo || []).map((u) => [u.id, u.nombre])), [equipo]);

  const cargar = useCallback(async () => {
    try {
      const [s, sal, h, rc, cb] = await Promise.all([
        sb.select("vacaciones_solicitudes", "select=*&order=fecha_inicio.desc"),
        sb.select("vacaciones_saldo", `select=usuario_id,dias_totales&anio=eq.${ANIO}`),
        sb.select("horarios", `select=usuario_id,fecha,turno&turno=in.(Vacaciones,Descanso)&fecha=gte.${ANIO}-01-01&fecha=lte.${ANIO}-12-31`),
        sb.fn("vacaciones", { action: "conflictos" }).catch(() => ({})),
        sb.fn("cambios-turno", { action: "pendientes" }).catch(() => ({ cambios: [] })),
      ]);
      setSols(s);
      const sm = {}; sal.forEach((x) => { sm[x.usuario_id] = x.dias_totales; }); setSaldos(sm);
      const vm = {}, dm = {};
      h.forEach((x) => { const dest = x.turno === "Vacaciones" ? vm : dm; (dest[x.usuario_id] ||= []).push(x.fecha); });
      setVacDias(vm); setDescansos(dm);
      setConf(rc.conflictos || {});
      setCambios(cb.cambios || []);
    } catch (e) { avisar("No se han podido cargar las solicitudes", "mal"); setSols((x) => x || []); setCambios((x) => x || []); }
  }, [ANIO]);
  useEffect(() => { cargar(); }, [cargar]);

  // ----- lógica de vacaciones (igual que la app) -----
  const escribirVacFechas = async (uid, fechas) => { if (fechas && fechas.length) await sb.upsert("horarios", fechas.map((f) => ({ usuario_id: uid, fecha: f, turno: "Vacaciones" })), "usuario_id,fecha"); };
  const calcularRango = async (uid, ini, fin) => { const rows = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${uid}&fecha=gte.${ini}&fecha=lte.${fin}`); const m = {}; rows.forEach((r) => { m[r.fecha] = r.turno; }); return diasQueGastan(rangoFechas(ini, fin), m); };
  const capturarPrev = async (uid, fechas) => {
    if (!fechas || !fechas.length) return {};
    try { const rows = await sb.select("horarios", `select=fecha,turno&usuario_id=eq.${uid}&fecha=in.(${fechas.join(",")})`); const m = {}; rows.forEach((r) => { if (r.turno && r.turno !== "Vacaciones") m[r.fecha] = r.turno; }); return m; }
    catch (e) { return {}; }
  };
  const restaurarTurnos = async (uid, fechas, prev) => {
    if (!fechas || !fechas.length) return;
    const p = prev || {};
    const restore = fechas.filter((f) => p[f]).map((f) => ({ usuario_id: uid, fecha: f, turno: p[f] }));
    const borrar = fechas.filter((f) => !p[f]);
    if (restore.length) await sb.upsert("horarios", restore, "usuario_id,fecha");
    if (borrar.length) await sb.delete("horarios", `usuario_id=eq.${uid}&fecha=in.(${borrar.join(",")})&turno=eq.Vacaciones`);
  };
  const cambiarEstado = async (s, estado) => {
    const patch = { estado, actualizado_en: new Date().toISOString() };
    if (estado !== "pendiente") patch.sin_acuerdo = false;
    let fechas = Array.isArray(s.fechas) ? s.fechas : null;
    if (estado === "aceptado") {
      if (!fechas) { fechas = await calcularRango(s.usuario_id, s.fecha_inicio, s.fecha_fin); if (fechas.length) patch.dias = fechas.length; }
      patch.turnos_prev = await capturarPrev(s.usuario_id, fechas);
      await escribirVacFechas(s.usuario_id, fechas);
    } else if (s.estado === "aceptado") {
      await restaurarTurnos(s.usuario_id, fechas || rangoFechas(s.fecha_inicio, s.fecha_fin), s.turnos_prev);
      patch.turnos_prev = null;
    }
    await sb.update("vacaciones_solicitudes", `id=eq.${s.id}`, patch);
  };
  const accion = async (clave, fn, ok) => {
    setBusy(clave);
    try { await fn(); avisar(ok); await cargar(); } catch (e) { avisar(e.message || "No se ha podido hacer", "mal"); }
    setBusy(null);
  };
  const resolverVac = (s, estado) => accion(`v${s.id}`, () => cambiarEstado(s, estado), estado === "aceptado" ? "Vacaciones aceptadas y puestas en el horario" : estado === "rechazado" ? "Solicitud rechazada" : "Solicitud en pendiente");
  const aceptarConflicto = (s) => {
    const c = conf[s.id];
    const nombres = c ? [...new Set(c.con.map((x) => x.nombre))].join(", ") : "";
    if (!window.confirm(`Vas a aceptar esta solicitud y rechazar la de ${nombres}, que se solapa. ¿Seguro?`)) return;
    accion(`v${s.id}`, async () => {
      if (c) for (const x of c.con) { const cs = sols.find((y) => y.id === x.id); if (cs && cs.estado === "pendiente") await cambiarEstado(cs, "rechazado"); }
      await cambiarEstado(s, "aceptado");
    }, "Aceptada; las que se solapaban se han rechazado");
  };
  const eliminarVac = (s) => {
    if (!window.confirm("¿Eliminar esta solicitud? No se puede deshacer.")) return;
    accion(`v${s.id}`, async () => {
      if (s.estado === "aceptado") await restaurarTurnos(s.usuario_id, Array.isArray(s.fechas) ? s.fechas : rangoFechas(s.fecha_inicio, s.fecha_fin), s.turnos_prev);
      await sb.delete("vacaciones_solicitudes", `id=eq.${s.id}`);
    }, "Solicitud eliminada");
  };
  const guardarCobertura = (s, tipo, valor) => accion(`c${s.id}`, () => sb.update("vacaciones_solicitudes", `id=eq.${s.id}`, {
    cobertura_tipo: tipo || null, cobertura_usuario_id: tipo === "interna" ? (valor || null) : null, cobertura_nombre: tipo === "externa" ? (valor || null) : null, actualizado_en: new Date().toISOString(),
  }), "Cobertura guardada");
  const resolverCambio = (c, estado) => accion(`k${c.id}`, async () => {
    const r = await sb.fn("cambios-turno", { action: "resolver", id: c.id, estado });
    if (r && r.ok === false) throw new Error(r.error || "No se ha podido");
  }, estado === "aceptado" ? "Cambio aplicado al horario" : "Cambio rechazado");
  const eliminarCambio = (c) => { if (window.confirm("¿Eliminar este cambio?")) accion(`k${c.id}`, () => sb.fn("cambios-turno", { action: "eliminar", id: c.id }), "Cambio eliminado"); };
  const guardarSaldo = async (uid, dias) => {
    const v = parseInt(dias, 10); if (isNaN(v) || v < 0) return;
    await accion(`s${uid}`, async () => {
      const r = await sb.update("vacaciones_saldo", `usuario_id=eq.${uid}&anio=eq.${ANIO}`, { dias_totales: v });
      if (!r || !r.length) await sb.insert("vacaciones_saldo", { usuario_id: uid, anio: ANIO, dias_totales: v });
    }, "Saldo actualizado");
  };

  if (!sols || !cambios || !equipo) return <Cargando />;

  const vacPend = sols.filter((s) => s.estado === "pendiente");
  const cambPend = cambios.filter((c) => c.estado === "pendiente");
  const resumen = Object.fromEntries(trabReg.map((t) => [t.id, resumenCalendario(saldos[t.id] ?? 22, vacDias[t.id] || [], sols.filter((s) => s.usuario_id === t.id), hoy)]));

  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={setVista} etiqueta="Solicitudes" opciones={[
          { id: "pendientes", label: "Por decidir", n: vacPend.length + cambPend.length },
          { id: "vacaciones", label: "Vacaciones" },
          { id: "saldos", label: `Saldos ${ANIO}` },
          { id: "cambios", label: "Cambios de turno" },
        ]} />
        <div className="acciones">
          <button className="btn-l" onClick={() => setNormas(true)}>Normas</button>
          <button className="btn-p" onClick={() => setNuevo(true)}>+ Añadir vacaciones</button>
        </div>
      </div>

      {vista === "pendientes" && (
        vacPend.length + cambPend.length === 0 ? <div className="card vacio-ok"><b>✓</b> No hay nada por decidir.</div> : (
          <div className="lista-sol">
            {vacPend.map((s) => (
              <TarjetaVac key={s.id} s={s} nombre={nombreDe[s.usuario_id]} conf={conf[s.id]} resumen={resumen[s.usuario_id]} busy={busy === `v${s.id}`}
                onEstado={(e) => resolverVac(s, e)} onConflicto={() => aceptarConflicto(s)} onEliminar={() => eliminarVac(s)} />
            ))}
            {cambPend.map((c) => <TarjetaCambio key={c.id} c={c} busy={busy === `k${c.id}`} onResolver={(e) => resolverCambio(c, e)} onEliminar={() => eliminarCambio(c)} />)}
          </div>
        )
      )}

      {vista === "vacaciones" && <ListaVacaciones sols={sols} nombreDe={nombreDe} conf={conf} resumen={resumen} trabReg={trabReg} busy={busy}
        onEstado={resolverVac} onConflicto={aceptarConflicto} onEliminar={eliminarVac} onCobertura={guardarCobertura} hoy={hoy} />}

      {vista === "saldos" && (
        <>
          <div className="card">
            <h2>Saldos de vacaciones · {ANIO}</h2>
            <p className="sub">Días cogidos según el calendario (lo que manda) y solicitudes pendientes. Pulsa una fila para ver el histórico.</p>
            <div className="tabla-scroll">
              <table className="ranking saldos">
                <thead><tr><th>Persona</th><th className="r">Total</th><th className="r">Cogidos</th><th className="r">Pendientes</th><th className="r">Quedan</th><th /></tr></thead>
                <tbody>
                  {trabReg.map((t) => {
                    const r = resumen[t.id];
                    return (
                      <tr key={t.id}>
                        <td><button className="link-persona" onClick={() => setHist(t)}><Avatar nombre={t.nombre} size={26} />{t.nombre}</button></td>
                        <td className="r"><SaldoEditable valor={saldos[t.id] ?? 22} onGuardar={(v) => guardarSaldo(t.id, v)} /></td>
                        <td className="r">{r.cogidos}</td>
                        <td className="r">{r.pendientes || "–"}</td>
                        <td className={`r b ${r.restantes < 0 ? "down" : ""}`}>{r.restantes}</td>
                        <td><span className="barra-saldo"><i style={{ width: `${Math.min(100, (r.cogidos / (saldos[t.id] ?? 22)) * 100)}%` }} /></span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card legado-dentro"><FechasCerradas /></div>
        </>
      )}

      {vista === "cambios" && (
        <div className="lista-sol">
          {cambios.length === 0 ? <div className="card"><p className="empty">No hay cambios de turno.</p></div>
            : cambios.map((c) => <TarjetaCambio key={c.id} c={c} busy={busy === `k${c.id}`} onResolver={(e) => resolverCambio(c, e)} onEliminar={() => eliminarCambio(c)} />)}
        </div>
      )}

      {nuevo && <NuevoPeriodo trabReg={trabReg} resumen={resumen} onClose={() => setNuevo(false)} onCrear={async (uid, estado, fechas) => {
        await accion("nuevo", async () => {
          let prev = null;
          if (estado === "aceptado") { prev = await capturarPrev(uid, fechas); await escribirVacFechas(uid, fechas); }
          await sb.insert("vacaciones_solicitudes", { usuario_id: uid, fecha_inicio: fechas[0], fecha_fin: fechas[fechas.length - 1], dias: fechas.length, fechas, estado, turnos_prev: prev });
        }, estado === "aceptado" ? "Vacaciones añadidas al horario" : "Solicitud añadida como pendiente");
        setNuevo(false);
      }} />}

      {hist && (
        <Panel titulo={hist.nombre} sub={`Vacaciones ${ANIO}`} onClose={() => setHist(null)}>
          {(() => {
            const bloques = agruparRangos(vacDias[hist.id] || [], descansos[hist.id] || []).reverse();
            return bloques.length === 0 ? <p className="empty">Sin vacaciones en el calendario.</p> : (
              <ul className="pq-l">
                {bloques.map((b) => <li key={b.ini}><span>{b.ini === b.fin ? fechaCorta(b.ini) : `${fechaCorta(b.ini)} → ${fechaCorta(b.fin)}`}<span className="pf">{b.fin <= hoy ? "Disfrutadas" : "Planificadas"}</span></span><b>{b.dias} d</b></li>)}
              </ul>
            );
          })()}
        </Panel>
      )}
      {normas && <VacacionesNormas onClose={() => setNormas(false)} />}
    </>
  );
}

function SaldoEditable({ valor, onGuardar }) {
  const [ed, setEd] = useState(false);
  const [v, setV] = useState(String(valor));
  if (!ed) return <button className="num-ed" onClick={() => { setV(String(valor)); setEd(true); }} title="Cambiar días totales">{valor}</button>;
  return (
    <span className="num-ed-f">
      <input type="number" min="0" value={v} onChange={(e) => setV(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") { onGuardar(v); setEd(false); } if (e.key === "Escape") setEd(false); }} />
      <button className="btn-l" onClick={() => { onGuardar(v); setEd(false); }}>OK</button>
    </span>
  );
}

function Estado({ e }) { return <span className={`estado e-${e}`}>{ESTADOS[e] || e}</span>; }

function TarjetaVac({ s, nombre, conf, resumen, busy, onEstado, onConflicto, onEliminar, compis, onCobertura }) {
  const enConflicto = s.estado === "pendiente" && conf;
  const escalado = conf && (conf.sin_acuerdo || conf.con.some((x) => x.sin_acuerdo));
  return (
    <article className={`card sol ${busy ? "ocupado" : ""}`}>
      <div className="sol-cab">
        <Avatar nombre={nombre} size={36} />
        <div className="sol-t">
          <h3>{nombre || "—"} <small>· vacaciones</small></h3>
          <p>{rango(s)} · <b>{s.dias || "?"} días</b>{resumen && <> · le quedan {resumen.restantes}</>}</p>
        </div>
        <Estado e={s.estado} />
      </div>
      {enConflicto && (
        <p className="sol-alerta">Se solapa con {[...new Set(conf.con.map((x) => x.nombre))].join(", ")}.{escalado && " No llegan a un acuerdo: decides tú."}</p>
      )}
      {s.estado === "aceptado" && compis && <CoberturaEditor s={s} compis={compis.filter((c) => c.id !== s.usuario_id)} onGuardar={(t, v) => onCobertura(s, t, v)} />}
      <div className="sol-acc">
        {s.estado === "pendiente" && !enConflicto && <button className="btn-ok" disabled={busy} onClick={() => onEstado("aceptado")}>Aceptar</button>}
        {enConflicto && <button className="btn-ok" disabled={busy} onClick={onConflicto}>Aceptar de todas formas</button>}
        {s.estado !== "rechazado" && <button className="btn-l" disabled={busy} onClick={() => onEstado("rechazado")}>Rechazar</button>}
        {s.estado === "aceptado" && <button className="btn-l" disabled={busy} onClick={() => onEstado("pendiente")}>Poner pendiente</button>}
        {s.estado === "rechazado" && <button className="btn-l" disabled={busy} onClick={() => onEstado("pendiente")}>Reabrir</button>}
        <button className="btn-txt" disabled={busy} onClick={onEliminar}>Eliminar</button>
      </div>
    </article>
  );
}

function CoberturaEditor({ s, compis, onGuardar }) {
  const [tipo, setTipo] = useState(s.cobertura_tipo || "");
  const [interna, setInterna] = useState(s.cobertura_usuario_id || "");
  const [externa, setExterna] = useState(s.cobertura_nombre || "");
  const cambiado = tipo !== (s.cobertura_tipo || "") || interna !== (s.cobertura_usuario_id || "") || externa !== (s.cobertura_nombre || "");
  return (
    <div className="cobertura-ed">
      <span>Quién cubre</span>
      <select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Sin asignar</option><option value="interna">Una compañera</option><option value="externa">Alguien de fuera</option></select>
      {tipo === "interna" && <select value={interna} onChange={(e) => setInterna(e.target.value)}><option value="">Elegir…</option>{compis.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>}
      {tipo === "externa" && <input value={externa} onChange={(e) => setExterna(e.target.value)} placeholder="Nombre" />}
      {cambiado && <button className="btn-l" onClick={() => onGuardar(tipo, tipo === "interna" ? interna : externa)}>Guardar</button>}
    </div>
  );
}

function TarjetaCambio({ c, busy, onResolver, onEliminar }) {
  return (
    <article className={`card sol ${busy ? "ocupado" : ""}`}>
      <div className="sol-cab">
        <span className="icono-cambio" aria-hidden="true">⇄</span>
        <div className="sol-t">
          <h3>{c.solicitante} <small>· cambio de turno con {c.otra}</small></h3>
          <p><b>{c.solicitante}</b> deja {c.turno_1} del {fechaCorta(c.fecha_1)} · <b>{c.otra}</b> deja {c.turno_2} del {fechaCorta(c.fecha_2)}</p>
        </div>
        <Estado e={c.estado} />
      </div>
      <div className="sol-acc">
        {c.estado === "pendiente" && <>
          <button className="btn-ok" disabled={busy} onClick={() => onResolver("aceptado")}>Aceptar</button>
          <button className="btn-l" disabled={busy} onClick={() => onResolver("rechazado")}>Rechazar</button>
        </>}
        <button className="btn-txt" disabled={busy} onClick={onEliminar}>Eliminar</button>
      </div>
    </article>
  );
}

function ListaVacaciones({ sols, nombreDe, conf, resumen, trabReg, busy, onEstado, onConflicto, onEliminar, onCobertura, hoy }) {
  const [filtro, setFiltro] = useState("proximas");
  const [persona, setPersona] = useState("");
  const lista = sols.filter((s) => (!persona || s.usuario_id === persona) && (
    filtro === "proximas" ? s.fecha_fin >= hoy && s.estado !== "rechazado" :
    filtro === "pasadas" ? s.fecha_fin < hoy : filtro === "rechazadas" ? s.estado === "rechazado" : true))
    .sort((a, b) => (filtro === "pasadas" ? b.fecha_inicio.localeCompare(a.fecha_inicio) : a.fecha_inicio.localeCompare(b.fecha_inicio)));
  return (
    <>
      <div className="filtros-linea">
        <Pestanas valor={filtro} onChange={setFiltro} etiqueta="Qué vacaciones" opciones={[{ id: "proximas", label: "Próximas" }, { id: "pasadas", label: "Pasadas" }, { id: "rechazadas", label: "Rechazadas" }, { id: "todas", label: "Todas" }]} />
        <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Persona"><option value="">Todo el equipo</option>{trabReg.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
      </div>
      <div className="lista-sol">
        {lista.length === 0 ? <div className="card"><p className="empty">No hay vacaciones con este filtro.</p></div> : lista.map((s) => (
          <TarjetaVac key={s.id} s={s} nombre={nombreDe[s.usuario_id]} conf={conf[s.id]} resumen={resumen[s.usuario_id]} busy={busy === `v${s.id}` || busy === `c${s.id}`}
            onEstado={(e) => onEstado(s, e)} onConflicto={() => onConflicto(s)} onEliminar={() => onEliminar(s)} compis={trabReg} onCobertura={onCobertura} />
        ))}
      </div>
    </>
  );
}

function NuevoPeriodo({ trabReg, resumen, onClose, onCrear }) {
  const [uid, setUid] = useState(trabReg[0]?.id || "");
  const [estado, setEstado] = useState("aceptado");
  return (
    <Panel titulo="Añadir vacaciones" sub="Elige la persona y marca los días en su calendario" onClose={onClose} ancho="560px">
      <div className="fila-campos">
        <label className="campo">Persona<select value={uid} onChange={(e) => setUid(e.target.value)}>{trabReg.map((t) => <option key={t.id} value={t.id}>{t.nombre} · quedan {resumen[t.id]?.restantes ?? "?"}</option>)}</select></label>
        <label className="campo">Estado<select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="aceptado">Aceptadas (al horario)</option><option value="pendiente">Pendientes</option></select></label>
      </div>
      {uid && <div className="legado-dentro" key={uid}>
        <VacacionesPicker usuarioId={uid} maxDias={Math.max(0, resumen[uid]?.restantes ?? 0)} submitLabel="Añadir" onSubmit={(fechas) => onCrear(uid, estado, fechas)} onCancel={onClose} />
      </div>}
    </Panel>
  );
}
