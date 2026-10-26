// Personas · Bolsa de turnos (dirección)
// Turnos publicados con sus respuestas, cambios en cadena y descansos compensatorios,
// coberturas (anular). El acceso de las eventuales se gestiona en Personas → Equipo.
// Las reglas viven en la base de datos (migración bolsa_turnos); aquí solo se ven y se gestionan.
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { TURNOS } from "../../../src/lib/turnos.js";
import { TURNOS_BOLSA, DIAS_ANTELACION, destinoDe, horarioDe, horasDe, fechaLarga, hoyYmd, plazo, diasHasta, horaCorta, motivo } from "../../../src/lib/bolsa.js";
import { Panel, Pestanas, Cargando, Avatar, avisar, ir, fechaCorta, useEquipo } from "../ui.jsx";
import "./bolsa.css";

const corto = (n) => {
  const p = (n || "").trim().split(/\s+/);
  const ap = p.slice(1).find((x) => !/^(de|del|la|las|los|y)$/i.test(x));
  return ap ? `${p[0]} ${ap.charAt(0).toUpperCase()}.` : p[0] || "—";
};
const lista = (xs) => (xs && xs.length ? xs.map(corto).join(", ") : null);

const Turno = ({ t }) => <span className="tchip" style={{ background: TURNOS[t]?.bg, color: TURNOS[t]?.fg }}>{t}</span>;
const Destino = ({ t }) => { const pl = destinoDe(t) === "plantilla"; return <span className={`b-dest ${pl ? "pl" : "ev"}`}>{pl ? "Plantilla" : "Eventuales"}</span>; };
function Plazo({ f }) {
  const p = plazo(f);
  return <span className={`b-plazo${p.urgente ? " urg" : ""}`}>{p.dias <= 0 ? "Es hoy" : p.dias === 1 ? "Es mañana" : `Faltan ${p.dias} días`}</span>;
}

export function Bolsa() {
  const { equipo } = useEquipo();
  const [ofertas, setOfertas] = useState(null);
  const [resp, setResp] = useState({});
  const [tab, setTab] = useState("abiertos");
  const [publicando, setPublicando] = useState(false);
  const [cobertura, setCobertura] = useState([]);
  const [encargado, setEncargado] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([
        sb.select("bolsa_turnos", `select=*&estado=in.(abierto,cubierto)&fecha=gte.${hoyYmd()}&order=fecha.asc,turno.asc`),
        sb.rpc("bolsa_resumen_admin"),
      ]);
      setOfertas(o || []);
      setResp(Object.fromEntries((r || []).map((x) => [x.id, x])));
      const [c, e] = await Promise.all([sb.rpc("bolsa_cobertura_meses").catch(() => []), sb.rpc("bolsa_encargado_leer").catch(() => null)]);
      setCobertura(c || []);
      setEncargado(typeof e === "string" ? e : "");
    } catch (e) { setOfertas((x) => x || []); avisar("No se ha podido cargar la bolsa", "mal"); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const nombreDe = useMemo(() => Object.fromEntries((equipo || []).map((u) => [u.id, u.nombre])), [equipo]);
  const porId = useMemo(() => Object.fromEntries((ofertas || []).map((o) => [o.id, o])), [ofertas]);
  if (!ofertas || !equipo) return <Cargando />;

  const abiertas = ofertas.filter((o) => o.estado === "abierto");
  const urgentes = abiertas.filter((o) => plazo(o.fecha).urgente);
  const cubiertas = ofertas.filter((o) => o.estado === "cubierto");
  const cadenas = cubiertas.filter((o) => o.cadena_bolsa_id);
  const descansos = abiertas.filter((o) => o.origen === "descanso_comp");

  const retirar = async (o) => {
    if (!window.confirm(`¿Retirar de la bolsa el ${o.turno} del ${fechaLarga(o.fecha)}?`)) return;
    try { await sb.update("bolsa_turnos", `id=eq.${o.id}`, { estado: "retirado", cerrado_motivo: "retirado_por_direccion" }); avisar("Retirado de la bolsa"); cargar(); }
    catch (e) { avisar("No se ha podido retirar", "mal"); }
  };
  const elegirEncargado = async (id) => {
    try { const r = await sb.rpc("bolsa_encargado_fijar", { p_id: id }); if (r?.ok) { setEncargado(id); avisar("Encargado de la bolsa guardado"); } else avisar("No se ha podido guardar", "mal"); }
    catch (e) { avisar("No se ha podido guardar", "mal"); }
  };
  const anular = async (o) => {
    if (!window.confirm(`Se deshace la cobertura de ${nombreDe[o.cogido_por] || "esta persona"} (horario, cambio de día y horas extra) y el turno vuelve a la bolsa. ¿Seguir?`)) return;
    try { const r = await sb.rpc("reabrir_turno_bolsa", { p_id: o.id }); if (r?.ok) { avisar("Anulado: el turno vuelve a la bolsa"); cargar(); } else avisar(motivo(r?.motivo).texto, "mal"); }
    catch (e) { avisar("No se ha podido anular", "mal"); }
  };
  const origen = (o) => {
    if (o.origen === "cadena") { const p = porId[o.origen_bolsa_id]; return p ? `Hueco por el cambio de día de ${corto(nombreDe[p.cogido_por])}` : "Hueco por un cambio de día"; }
    if (o.origen === "descanso_comp") return `Descanso compensatorio de ${corto(nombreDe[o.descanso_de])}${o.limite_descanso ? ` · límite ${fechaCorta(o.limite_descanso)}` : ""}`;
    return null;
  };

  return (
    <>
      <div className="grid sin-margen">
        <div className="card c3 fkpi2"><h2>Publicados</h2><p className="num">{abiertas.length}</p><p className="sub">esperando a que alguien los coja</p></div>
        <div className="card c3 fkpi2"><h2>Urgentes</h2><p className={`num${urgentes.length ? " down" : ""}`}>{urgentes.length}</p><p className="sub">a 10 días o menos sin cubrir</p></div>
        <div className="card c3 fkpi2"><h2>Cubiertos</h2><p className="num">{cubiertas.length}</p><p className="sub">desde la bolsa, por venir</p></div>
        <div className="card c3 fkpi2"><h2>Descansos pendientes</h2><p className="num">{descansos.length}</p><p className="sub">compensatorios aún sin cubrir</p></div>
      </div>

      <div className="card">
        <div className="head">
          <div><h2>Cobertura a tiempo</h2><p className="sub">Turnos del mes cubiertos con 10 días o más de antelación. Meta: 90 %. Con pocos turnos un solo hueco mueve mucho el %: mira la tendencia.</p></div>
          <label className="sub">Encargado de la bolsa{" "}
            <select value={encargado} onChange={(e) => e.target.value && elegirEncargado(e.target.value)}>
              {!encargado && <option value="">Elegir…</option>}
              {(equipo || []).filter((u) => u.rol === "admin" && u.activo !== false).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </label>
        </div>
        <div className="grid sin-margen">
          {cobertura.map((c, i) => (
            <div key={c.mes} className="card c3 fkpi2">
              <h2>{new Date(c.mes + "T12:00:00").toLocaleDateString("es-ES", { month: "long" })}{i === 0 ? " (este mes)" : ""}</h2>
              <p className={`num${c.pct != null && c.pct < 90 ? " down" : ""}`}>{c.pct == null ? "—" : `${c.pct} %`}</p>
              <p className="sub">{c.total ? `${c.a_tiempo} de ${c.total} turnos a tiempo` : "sin turnos"}</p>
            </div>
          ))}
        </div>
        <p className="sub">Cuentan todos los turnos de la bolsa del mes (también descansos compensatorios y huecos por cambio de día). Los retirados o cubiertos a mano no cuentan como a tiempo; los que aún tienen más de 10 días por delante se esperan.</p>
      </div>

      <AsignadosApp />

      <div className="card b-reglas">
        <div className="head">
          <div><h2>Cómo funciona</h2><p className="sub">Cada turno va solo a quien puede cubrirlo. Se publica con 3 semanas y los avisos salen en un resumen cada mañana.</p></div>
          <button className="btn-p" onClick={() => setPublicando(true)}>+ Publicar un turno</button>
        </div>
        <ul>
          <li><Destino t="Mañana" /><span><b>Mañana y Tarde</b>: quien libra ese día. Las primeras 48 h solo las de apoyo (cambian un día de esa semana, +2 h o +3 h); después, también las principales (+8 h y descanso compensatorio si hace falta).</span></li>
          <li><Destino t="Apoyo 1" /><span><b>Apoyo 1, 2 y 3</b>: bolsa de eventuales.</span></li>
          <li><span className="b-dest neutro">Avisos</span><span>A 10 días sin cubrir: recordatorio a quien puede y no ha respondido (WhatsApp y app). Si sigue sin cubrir 2 días después, aviso a dirección. Si 2 turnos llegan a 10 días sin cubrir en 30 días, alerta al encargado.</span></li>
          <li><span className="b-dest neutro">30 días</span><span>La app publica sola los huecos a 30 días (y al momento si se marcan vacaciones, baja o permiso con menos). Un hueco de Mañana o Tarde pasa directamente a su apoyo (Mañana → Apoyo 1, Tarde → Apoyo 2) con las horas complementarias apuntadas, y su apoyo sale a la bolsa de eventuales. Si no se puede (12 h, menos de 3 días, apoyo ausente o eventual), avisa a dirección y sale a la bolsa de la plantilla. Si se anula la ausencia, se deshace todo.</span></li>
          <li><span className="b-dest neutro">12 h</span><span>Nunca se ofrece un turno si no quedan 12 h de descanso con el anterior o el siguiente.</span></li>
        </ul>
      </div>

      <div className="card">
        <div className="head">
          <div><h2>{tab === "abiertos" ? "Turnos en la bolsa" : tab === "cubiertos" ? "Cubiertos desde la bolsa" : ""}</h2>
            <p className="sub">{tab === "abiertos" ? "Quién puede, quién ha dicho que no y quién no ha contestado" : "Cambios en cadena, descansos y coberturas. «Anular» lo deshace todo y devuelve el turno a la bolsa."}</p></div>
          <Pestanas valor={tab} onChange={setTab} etiqueta="Bolsa" opciones={[{ id: "abiertos", label: "En la bolsa", n: abiertas.length }, { id: "cubiertos", label: "Cubiertos", n: cubiertas.length }] } />
        </div>

        {tab === "abiertos" && (abiertas.length === 0 ? <p className="empty">No hay turnos publicados ahora mismo.</p> : (
          <div className="b-lista">
            {[...urgentes, ...abiertas.filter((o) => !plazo(o.fecha).urgente)].map((o) => {
              const r = resp[o.id] || { pueden: [], no_pueden: [], sin_responder: [] };
              const prio = destinoDe(o.turno) === "plantilla" && o.prioridad_apoyo_hasta && new Date(o.prioridad_apoyo_hasta) > new Date();
              const ot = origen(o);
              const nadie = (r.sin_responder || []).length === 0 && (r.pueden || []).length === 0;
              return (
                <article key={o.id} className={`b-oferta${plazo(o.fecha).urgente ? " urg" : ""}`}>
                  <header>
                    <div>
                      <b className="b-f">{fechaLarga(o.fecha)}</b>
                      <div className="b-chips"><Turno t={o.turno} /><small>{horarioDe(o.turno, o.fecha)}</small><Destino t={o.turno} /></div>
                    </div>
                    <Plazo f={o.fecha} />
                  </header>
                  {ot && <p className="b-origen">{ot}</p>}
                  {prio && <p className="b-nota">Solo apoyos hasta el {horaCorta(o.prioridad_apoyo_hasta)}; después, también principales.</p>}
                  {o.nota && o.origen === "hueco" && <p className="b-nota">{o.nota}</p>}
                  <dl className="b-resp">
                    <div><dt>Pueden</dt><dd>{lista(r.pueden) || "Nadie libre ese día"}</dd></div>
                    <div><dt>No pueden</dt><dd>{lista(r.no_pueden) || "—"}</dd></div>
                    <div><dt>Sin responder</dt><dd>{lista(r.sin_responder) || "—"}</dd></div>
                  </dl>
                  {o.aviso_10d_en && <p className="b-nota">Aviso a dirección enviado el {fechaCorta(o.aviso_10d_en)}.</p>}
                  {nadie && <p className="b-alerta">Nadie más puede cogerlo: cúbrelo desde Horarios.</p>}
                  <footer>
                    <button className="btn-l" onClick={() => ir("personas/horarios")}>Cubrir en Horarios</button>
                    <button className="btn-txt" onClick={() => retirar(o)}>Retirar de la bolsa</button>
                  </footer>
                </article>
              );
            })}
          </div>
        ))}

        {tab === "cubiertos" && (cubiertas.length === 0 ? <p className="empty">Todavía nadie ha cubierto turnos desde la bolsa.</p> : (
          <>
            {cadenas.length > 0 && (
              <>
                <h3 className="b-sec">Cambios en cadena y descansos</h3>
                <ul className="b-cadenas">
                  {cadenas.map((o) => {
                    const h = porId[o.cadena_bolsa_id];
                    const ok = !h || h.estado === "cubierto";
                    const esDescanso = o.cogido_como === "principal_extra";
                    return (
                      <li key={o.id}>
                        <div className="b-paso"><Avatar nombre={nombreDe[o.cogido_por]} size={24} /><b>{corto(nombreDe[o.cogido_por])}</b><span>cubre</span><Turno t={o.turno} /><b>{fechaCorta(o.fecha)}</b></div>
                        <div className="b-paso hijo">
                          <span>{esDescanso ? "y su descanso" : "y libra su"}</span>{h && <Turno t={h.turno} />}<b>{fechaCorta(h ? h.fecha : o.cambio_fecha || o.fecha)}</b>
                          <span className={`b-est ${ok ? "ok" : "mal"}`}>{!h ? "resuelto" : h.estado === "cubierto" ? `cubierto por ${corto(nombreDe[h.cogido_por])}` : "en la bolsa, sin cubrir"}</span>
                          {h && !ok && <Plazo f={h.fecha} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <h3 className="b-sec">Todas las coberturas</h3>
            <div className="tabla-scroll">
              <table className="ranking b-tabla">
                <thead><tr><th>Día</th><th>Turno</th><th>Quién</th><th>Cómo</th><th /></tr></thead>
                <tbody>
                  {cubiertas.map((o) => (
                    <tr key={o.id}>
                      <td className="b-cap">{fechaCorta(o.fecha)}</td>
                      <td><Turno t={o.turno} /></td>
                      <td><span className="b-quien"><Avatar nombre={nombreDe[o.cogido_por] || "?"} size={22} />{corto(nombreDe[o.cogido_por])}</span></td>
                      <td className="b-como">{o.cogido_como === "apoyo_cambio" ? `cambio de día · +${horasDe(o.turno, o.fecha) - horasDe(o.cambio_turno, o.cambio_fecha)} h` : o.cogido_como === "principal_extra" ? `día libre · +${horasDe(o.turno, o.fecha)} h extra` : "eventual"}</td>
                      <td className="r"><button className="btn-txt peligro" onClick={() => anular(o)}>Anular</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}

      </div>

      {publicando && <Publicar onClose={() => setPublicando(false)} onHecho={() => { setPublicando(false); cargar(); }} />}
    </>
  );
}

function Publicar({ onClose, onHecho }) {
  const [f, setF] = useState({ fecha: "", turno: "Mañana", nota: "" });
  const [busy, setBusy] = useState(false);
  const d = f.fecha ? diasHasta(f.fecha) : null;
  async function publicar() {
    if (!f.fecha) return avisar("Elige la fecha", "mal");
    setBusy(true);
    try { await sb.insert("bolsa_turnos", { fecha: f.fecha, turno: f.turno, nota: f.nota.trim() || null }); avisar("Publicado: sale en el resumen de mañana a quien pueda cubrirlo"); onHecho(); }
    catch (e) { avisar(/409|23505/.test(String(e.message)) ? "Ese turno ya está en la bolsa" : "No se ha podido publicar", "mal"); }
    finally { setBusy(false); }
  }
  return (
    <Panel titulo="Publicar un turno" sub="Normalmente se publica desde la fila Cobertura de Horarios" onClose={onClose} ancho="460px"
      pie={<button className="btn-p" disabled={busy || !f.fecha} onClick={publicar}>{busy ? "Publicando…" : "Publicar en la bolsa"}</button>}>
      <div className="fila-campos">
        <label className="campo">Fecha<input type="date" min={hoyYmd()} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
        <label className="campo">Turno<select value={f.turno} onChange={(e) => setF({ ...f, turno: e.target.value })}>{TURNOS_BOLSA.map((t) => <option key={t} value={t}>{t} · {horarioDe(t, f.fecha)}</option>)}</select></label>
      </div>
      <p className="b-va">Lo verán: <Destino t={f.turno} /></p>
      {d != null && d < DIAS_ANTELACION && <p className="b-aviso">Faltan {d} días: menos de las 3 semanas habituales.{d <= 10 ? " Saldrá ya como urgente." : ""}</p>}
      <label className="campo">Nota (opcional)<input value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="p. ej. hay que recibir al proveedor de fruta" /></label>
    </Panel>
  );
}

// #57 · Lo que ha hecho la app sola con los huecos a 30 días
const ACCION = { asignado: "Pasado a su apoyo", bolsa_plantilla: "No se pudo pasar: bolsa de plantilla", bolsa_eventuales: "Publicado a eventuales" };
function AsignadosApp() {
  const [l, setL] = useState(null);
  useEffect(() => { sb.rpc("huecos_auto_lista", {}).then((r) => setL(Array.isArray(r) ? r : [])).catch(() => setL([])); }, []);
  if (!l || !l.length) return null;
  return (
    <div className="card">
      <div className="head"><div><h2>Asignados por la app</h2><p className="sub">Huecos que la app ha tratado sola (últimas 2 semanas y los que vienen)</p></div></div>
      <ul className="b-auto">
        {l.map((a) => (
          <li key={a.id} className={a.estado === "deshecho" ? "deshecho" : a.accion === "bolsa_plantilla" ? "aviso" : ""}>
            <span className="b-auto-f">{fechaLarga(a.fecha)}</span>
            <span className="b-auto-t"><Turno t={a.turno} /></span>
            <span className="b-auto-d">
              <b>{a.estado === "deshecho" ? "Deshecho (se anuló la ausencia)" : ACCION[a.accion] || a.accion}</b>
              {a.accion === "asignado" && <> · {a.apoyo} deja su {a.apoyo_turno}{a.horas ? ` (+${Number(a.horas).toLocaleString("es-ES")} h complementarias)` : ""}</>}
              {a.motivo && <> · {a.motivo}</>}
              {a.bolsa_turno && a.estado !== "deshecho" && <> · {a.bolsa_turno} en la bolsa: {a.bolsa_estado === "cubierto" ? `lo cubre ${a.cubierto_por || "—"}` : a.bolsa_estado === "abierto" ? "sin coger" : a.bolsa_estado}</>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
