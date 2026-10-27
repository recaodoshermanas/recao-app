// Personas · Seguimiento · Tareas por equipo (#73): % de tareas hechas por turno y por pareja, verificación del turno anterior y calendario del mes.
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, avisar, hoyStr } from "../ui.jsx";
import "./tareasEquipo.css";

const META_HECHAS = 95;
const META_VERIF = 100;
const CATS = { gente: "Mucha gente", nada: "No había nada que hacer", proveedor: "Llegó un proveedor", otros: "Otros" };
const TURNOS = [["mañana", "Mañana", "M"], ["tarde", "Tarde", "T"]];
const DIAS_SEM = ["L", "M", "X", "J", "V", "S", "D"];

const pct = (a, b) => (b > 0 ? (a / b) * 100 : null);
const fmtPct = (v) => (v == null ? "–" : `${v.toFixed(1).replace(".", ",")} %`);
const nomMes = (m) => new Date(`${m}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

function mesesDisponibles() {
  const out = []; const hoy = hoyStr().slice(0, 7);
  let [y, m] = [2026, 8];
  while (`${y}-${String(m).padStart(2, "0")}` <= hoy) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out.reverse();
}

function colorCelda(c) {
  if (!c) return "vacio";
  if (!c.cierre) return c.hay_turno ? "rojo" : "vacio";
  if (c.sin_cuenta === 0) return "verde";
  return c.sin_cuenta === 1 ? "naranja" : "rojo";
}
function resumenCelda(c) {
  if (!c || (!c.cierre && !c.hay_turno)) return "Sin turno en el horario";
  if (!c.cierre) return "Sin cierre";
  if (c.sin_cuenta === 0) return "Todo hecho";
  return c.sin_cuenta === 1 ? "1 tarea sin hacer" : `${c.sin_cuenta} tareas sin hacer`;
}

function Barra({ valor, meta }) {
  const v = valor == null ? 0 : Math.min(100, valor);
  return <div className="eq-barra" role="img" aria-label={`${fmtPct(valor)} frente a una meta del ${meta} %`}><i style={{ width: `${v}%` }} className={valor != null && valor >= meta ? "ok" : "bajo"} /><b style={{ left: `${meta}%` }} /></div>;
}
function Falta({ valor, meta }) {
  if (valor == null) return <span className="eq-falta">Sin datos</span>;
  const f = meta - valor;
  return f <= 0 ? <span className="eq-falta ok">En meta</span> : <span className="eq-falta">Faltan {f.toFixed(1).replace(".", ",")} puntos</span>;
}

export function TareasEquipo() {
  const meses = useMemo(mesesDisponibles, []);
  const [mes, setMes] = useState(meses[0]);
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [dia, setDia] = useState(null);
  const cargar = useCallback(async () => {
    try { const r = await sb.rpc("tareas_equipo_mes", { p_mes: `${mes}-01` }); setD(r); setError(""); } catch (e) { setError(e.message || "No se han podido cargar los datos"); setD({}); }
  }, [mes]);
  useEffect(() => { setD(null); setDia(null); cargar(); }, [cargar]);
  const llamar = async (fn, args, ok) => { try { await sb.rpc(fn, args); if (ok) avisar(ok); await cargar(); } catch (e) { avisar(e.message || "No se ha podido guardar", "error"); } };

  if (!d) return <Cargando />;
  if (error) return <div className="card"><p className="empty">{error}</p></div>;
  const dias = d.dias || [];
  const sinDatos = dias.length === 0;

  const tt = (t) => { const x = (d.turnos || {})[t] || { toca: 0, hechas: 0, sin: 0, descontadas: 0 }; return { ...x, p: pct(x.hechas, x.toca - x.descontadas) }; };
  const v = d.verif || { cierres: 0, verificados: 0, a_tiempo: 0, encontradas: 0 };
  const pv = pct(v.verificados, v.cierres); const pt = pct(v.a_tiempo, v.cierres);
  const diaSel = dias.find((x) => x.fecha === dia);

  // calendario lunes-domingo
  const primero = new Date(`${mes}-01T12:00:00`); const hueco = (primero.getDay() + 6) % 7;
  const celdas = [...Array(hueco).fill(null), ...Array.from({ length: new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate() }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  const porFecha = Object.fromEntries(dias.map((x) => [x.fecha, x]));

  return (
    <div className="eq">
      <div className="filtros-linea">
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">{meses.map((m) => <option key={m} value={m}>{nomMes(m)}</option>)}</select>
        <span className="eq-rango">{sinDatos ? "Todavía no hay días cerrados en este mes" : `Del 1 al ${Number(d.hasta.slice(8))} (hasta ayer)`}</span>
      </div>

      <div className="eq-grid">
        <div className="eq-turnos">
          {TURNOS.map(([id, label]) => { const x = tt(id); return (
            <div className="card eq-kpi" key={id}>
              <p className="sub">Tareas hechas · {label}</p>
              <strong className={`eq-big ${x.p != null && x.p >= META_HECHAS ? "ok" : "bajo"}`}>{fmtPct(x.p)}</strong>
              <Barra valor={x.p} meta={META_HECHAS} />
              <p className="eq-pie"><Falta valor={x.p} meta={META_HECHAS} /> · meta {META_HECHAS} % · {x.hechas} de {x.toca - x.descontadas}</p>
            </div>); })}
        </div>
        <div className="card eq-motivos">
          <h3>Por qué se quedan sin hacer</h3>
          <ul>{Object.entries(CATS).map(([k, l]) => <li key={k}><span>{l}</span><b>{(d.motivos || {})[k] || 0}</b></li>)}</ul>
          <p className="sub">Tareas sin hacer del mes. Las validadas como «No había nada que hacer» no restan al porcentaje; el resto siguen contando.</p>
        </div>
      </div>

      <div className="card">
        <h3>Verificación del turno anterior</h3>
        <div className="eq-verif">
          <div><strong className={`eq-big ${pv != null && pv >= META_VERIF ? "ok" : "bajo"}`}>{fmtPct(pv)}</strong><p className="sub">Cierres verificados · {v.verificados} de {v.cierres} · meta {META_VERIF} %</p></div>
          <div><strong className="eq-big">{fmtPct(pt)}</strong><p className="sub">Verificados a tiempo (en la primera hora del turno) · {v.a_tiempo} de {v.cierres}</p></div>
          <div><strong className="eq-big">{v.encontradas}</strong><p className="sub">Tareas encontradas sin hacer al verificar</p></div>
        </div>
      </div>

      <div className="eq-cal-det">
        <div className="card">
          <h3>Calendario</h3>
          <div className="eq-cal" role="grid">
            {DIAS_SEM.map((s) => <div className="eq-sem" key={s}>{s}</div>)}
            {celdas.map((f, i) => { if (!f) return <div key={`h${i}`} />; const x = porFecha[f]; return (
              <button key={f} className={`eq-dia${dia === f ? " sel" : ""}`} disabled={!x} onClick={() => setDia(f)} aria-label={`Día ${Number(f.slice(8))}`}>
                <span className="eq-n">{Number(f.slice(8))}{x && x.festivo ? " ★" : ""}</span>
                {x && TURNOS.map(([id, , ini]) => { const c = x.turnos[id]; return (
                  <span className="eq-cas" key={id}><i className={`eq-c ${colorCelda(c)}`}>{ini}</i><em>{c && c.eventual ? "E" : ""}{c && c.cubre ? "A" : ""}</em></span>); })}
              </button>); })}
          </div>
          <p className="eq-ley"><i className="eq-c verde" /> todo hecho <i className="eq-c naranja" /> 1 sin hacer <i className="eq-c rojo" /> 2 o más, o sin cierre · <b>E</b> apoyo hecho por una eventual · <b>A</b> la apoyo hizo el turno principal · ★ festivo</p>
        </div>
        <div className="card eq-detalle">
          {!diaSel ? <p className="empty">Pulsa un día para ver el detalle de la mañana y la tarde.</p> : (
            <>
              <h3>{new Date(`${diaSel.fecha}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</h3>
              {TURNOS.map(([id, label]) => { const c = diaSel.turnos[id] || {}; return (
                <section key={id} className="eq-tdet">
                  <h4><i className={`eq-c ${colorCelda(c)}`}>{label[0]}</i> {label}{c.quien ? <small> · {c.quien}</small> : null}</h4>
                  <p className="eq-res">{resumenCelda(c)}</p>
                  <div className="eq-etq">
                    {c.gente && <span>Mucha gente</span>}{c.eventual && <span>Eventual de apoyo</span>}{c.cubre && <span>La apoyo cubre a la principal</span>}{diaSel.festivo && <span>Festivo</span>}
                  </div>
                  {(c.items || []).length > 0 && (
                    <ul className="eq-items">
                      {c.items.map((it) => { const val = it.estado === "validada"; const nada = it.categoria === "nada"; return (
                        <li key={it.id}>
                          <b>{it.tarea}</b>
                          <q>{it.motivo || "Sin motivo escrito"}</q>
                          <div className="eq-fila">
                            <select value={it.categoria} onChange={(e) => llamar("tareas_equipo_set_categoria", { p_item: it.id, p_categoria: e.target.value }, "Categoría cambiada")} aria-label="Categoría del motivo">
                              {Object.entries(CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                            </select>
                            <span className={`eq-est ${val ? "val" : "pen"}`}>
                              {it.excluida ? "No cuenta (tarea excluida)" : val ? (nada ? "Validada · no cuenta" : "Validada · sigue contando") : "Pendiente de validar · cuenta como no hecha"}
                            </span>
                          </div>
                        </li>); })}
                    </ul>)}
                </section>); })}
            </>)}
        </div>
      </div>

      <div className="card">
        <h3>Por pareja</h3>
        <div className="eq-tabla-w">
          <table className="eq-tabla">
            <thead><tr><th>Pareja</th><th>Turnos</th><th>Tareas hechas</th><th>Cierres verificados al entrar</th></tr></thead>
            <tbody>
              {(d.parejas || []).map((p) => { const x = pct(p.hechas, p.toca - p.descontadas); return (
                <tr key={p.id}>
                  <td><b>{p.principal}</b> + {p.apoyo}{!p.activa && <small> (inactiva)</small>}</td>
                  <td>{p.turnos}</td>
                  <td><span className={x != null && x >= META_HECHAS ? "ok" : "bajo"}>{fmtPct(x)}</span><Barra valor={x} meta={META_HECHAS} /></td>
                  <td>{p.hizo} de {p.debia}</td>
                </tr>); })}
              {d.sin_pareja && d.sin_pareja.turnos > 0 && (
                <tr><td><b>Sin pareja asignada</b></td><td>{d.sin_pareja.turnos}</td><td>{fmtPct(pct(d.sin_pareja.hechas, d.sin_pareja.toca - d.sin_pareja.descontadas))}</td><td>{d.sin_pareja.hizo} de {d.sin_pareja.debia}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="sub">Cada turno cuenta para la pareja de quien lo trabajó ese día según el horario. La verificación cuenta para la pareja que debía hacerla.</p>
      </div>

      <div className="eq-ajustes">
        <Parejas d={d} llamar={llamar} />
        <div className="card">
          <h3>Tareas excluidas de la medida</h3>
          <p className="sub">Las tareas marcadas no cuentan ni como hechas ni como sin hacer. Se aplica a todos los días de todos los meses.</p>
          <ul className="eq-lista">
            {(d.tareas || []).map((t) => (
              <li key={t.texto}><label><input type="checkbox" checked={t.excluida} onChange={(e) => llamar("tareas_equipo_set_excluida", { p_texto: t.texto, p_activa: e.target.checked }, e.target.checked ? "Tarea excluida" : "Tarea vuelve a contar")} /> {t.texto}{t.turnos ? <small> · {t.turnos}</small> : null}</label></li>))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Parejas({ d, llamar }) {
  const personas = d.personas || [];
  const [nuevo, setNuevo] = useState({ p: "", a: "" });
  const opciones = (v, set, vacio) => (
    <select value={v} onChange={(e) => set(e.target.value)} aria-label={vacio}><option value="">{vacio}</option>{personas.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>);
  const todas = d.parejas || [];
  return (
    <div className="card">
      <h3>Parejas</h3>
      <p className="sub">Cambia aquí las parejas cuando entre o salga alguien. Los cambios se aplican a todo el histórico, así que revisa los meses anteriores si cambias una pareja con turnos ya hechos.</p>
      <ul className="eq-lista">
        {todas.map((p) => (
          <li key={p.id} className="eq-pareja">
            <select value={p.principal_id} onChange={(e) => llamar("tareas_equipo_set_pareja", { p_id: p.id, p_principal: e.target.value, p_apoyo: p.apoyo_id, p_activa: p.activa }, "Pareja guardada")} aria-label="Principal">
              {[...personas, ...(personas.some((u) => u.id === p.principal_id) ? [] : [{ id: p.principal_id, nombre: p.principal }])].map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
            <span>+</span>
            <select value={p.apoyo_id} onChange={(e) => llamar("tareas_equipo_set_pareja", { p_id: p.id, p_principal: p.principal_id, p_apoyo: e.target.value, p_activa: p.activa }, "Pareja guardada")} aria-label="Apoyo">
              {[...personas, ...(personas.some((u) => u.id === p.apoyo_id) ? [] : [{ id: p.apoyo_id, nombre: p.apoyo }])].map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
            <label><input type="checkbox" checked={p.activa} onChange={(e) => llamar("tareas_equipo_set_pareja", { p_id: p.id, p_principal: p.principal_id, p_apoyo: p.apoyo_id, p_activa: e.target.checked }, "Pareja guardada")} /> activa</label>
          </li>))}
        <li className="eq-pareja">
          {opciones(nuevo.p, (x) => setNuevo({ ...nuevo, p: x }), "Principal")}<span>+</span>{opciones(nuevo.a, (x) => setNuevo({ ...nuevo, a: x }), "Apoyo")}
          <button className="btn-l" disabled={!nuevo.p || !nuevo.a || nuevo.p === nuevo.a} onClick={async () => { await llamar("tareas_equipo_set_pareja", { p_id: null, p_principal: nuevo.p, p_apoyo: nuevo.a, p_activa: true }, "Pareja añadida"); setNuevo({ p: "", a: "" }); }}>Añadir pareja</button>
        </li>
      </ul>
    </div>
  );
}
