// Personas · Bolsa de turnos (dirección)
// Turnos publicados con sus respuestas, cambios en cadena y descansos compensatorios,
// coberturas (anular) y acceso de las eventuales a la app.
// Las reglas viven en la base de datos (migración bolsa_turnos); aquí solo se ven y se gestionan.
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { TURNOS } from "../../../src/lib/turnos.js";
import { TURNOS_BOLSA, DIAS_ANTELACION, destinoDe, horarioDe, horasDe, fechaLarga, hoyYmd, plazo, diasHasta, horaCorta, motivo } from "../../../src/lib/bolsa.js";
import { Panel, Pestanas, Cargando, Avatar, avisar, ir, fechaCorta, useEquipo } from "../ui.jsx";
import "./bolsa.css";
import { telNormalizado, TEL_AYUDA } from "../../../src/views/owner/UsuariosView.jsx";

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
  const { equipo, recargarEquipo } = useEquipo();
  const [ofertas, setOfertas] = useState(null);
  const [resp, setResp] = useState({});
  const [tab, setTab] = useState("abiertos");
  const [publicando, setPublicando] = useState(false);
  const [acceso, setAcceso] = useState(null); // persona eventual a la que se da acceso

  const cargar = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([
        sb.select("bolsa_turnos", `select=*&estado=in.(abierto,cubierto)&fecha=gte.${hoyYmd()}&order=fecha.asc,turno.asc`),
        sb.rpc("bolsa_resumen_admin"),
      ]);
      setOfertas(o || []);
      setResp(Object.fromEntries((r || []).map((x) => [x.id, x])));
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
  const eventuales = equipo.filter((u) => u.eventual && u.activo);
  const descansos = abiertas.filter((o) => o.origen === "descanso_comp");

  const retirar = async (o) => {
    if (!window.confirm(`¿Retirar de la bolsa el ${o.turno} del ${fechaLarga(o.fecha)}?`)) return;
    try { await sb.update("bolsa_turnos", `id=eq.${o.id}`, { estado: "retirado", cerrado_motivo: "retirado_por_direccion" }); avisar("Retirado de la bolsa"); cargar(); }
    catch (e) { avisar("No se ha podido retirar", "mal"); }
  };
  const anular = async (o) => {
    if (!window.confirm(`Se deshace la cobertura de ${nombreDe[o.cogido_por] || "esta persona"} (horario, cambio de día y horas extra) y el turno vuelve a la bolsa. ¿Seguir?`)) return;
    try { const r = await sb.rpc("reabrir_turno_bolsa", { p_id: o.id }); if (r?.ok) { avisar("Anulado: el turno vuelve a la bolsa"); cargar(); } else avisar(motivo(r?.motivo).texto, "mal"); }
    catch (e) { avisar("No se ha podido anular", "mal"); }
  };
  const quitarAcceso = async (u) => {
    if (!window.confirm(`¿Quitar el acceso a ${u.nombre}? Sus turnos asignados se mantienen.`)) return;
    try { await sb.fn("gestion-usuarios", { action: "quitar_acceso_eventual", id: u.id }); avisar("Acceso quitado"); recargarEquipo(); }
    catch (e) { avisar(e.message || "No se ha podido quitar el acceso", "mal"); }
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

      <div className="card b-reglas">
        <div className="head">
          <div><h2>Cómo funciona</h2><p className="sub">Cada turno va solo a quien puede cubrirlo. Se publica con 3 semanas y los avisos salen en un resumen cada mañana.</p></div>
          <button className="btn-p" onClick={() => setPublicando(true)}>+ Publicar un turno</button>
        </div>
        <ul>
          <li><Destino t="Mañana" /><span><b>Mañana y Tarde</b>: quien libra ese día. Las primeras 48 h solo las de apoyo (cambian un día de esa semana, +2 h o +3 h); después, también las principales (+8 h y descanso compensatorio si hace falta).</span></li>
          <li><Destino t="Apoyo 1" /><span><b>Apoyo 1, 2 y 3</b>: bolsa de eventuales.</span></li>
          <li><span className="b-dest neutro">12 h</span><span>Nunca se ofrece un turno si no quedan 12 h de descanso con el anterior o el siguiente.</span></li>
        </ul>
      </div>

      <div className="card">
        <div className="head">
          <div><h2>{tab === "abiertos" ? "Turnos en la bolsa" : tab === "cubiertos" ? "Cubiertos desde la bolsa" : "Eventuales"}</h2>
            <p className="sub">{tab === "abiertos" ? "Quién puede, quién ha dicho que no y quién no ha contestado" : tab === "cubiertos" ? "Cambios en cadena, descansos y coberturas. «Anular» lo deshace todo y devuelve el turno a la bolsa." : "Quién tiene acceso a la app para ver y coger apoyos"}</p></div>
          <Pestanas valor={tab} onChange={setTab} etiqueta="Bolsa" opciones={[{ id: "abiertos", label: "En la bolsa", n: abiertas.length }, { id: "cubiertos", label: "Cubiertos", n: cubiertas.length }, { id: "eventuales", label: "Eventuales" }]} />
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
                      <div className="b-chips"><Turno t={o.turno} /><small>{horarioDe(o.turno)}</small><Destino t={o.turno} /></div>
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
                  {o.aviso_10d_en && <p className="b-nota">Aviso de urgencia enviado el {fechaCorta(o.aviso_10d_en)}.</p>}
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
                      <td className="b-como">{o.cogido_como === "apoyo_cambio" ? `cambio de día · +${horasDe(o.turno) - horasDe(o.cambio_turno)} h` : o.cogido_como === "principal_extra" ? `día libre · +${horasDe(o.turno)} h extra` : "eventual"}</td>
                      <td className="r"><button className="btn-txt peligro" onClick={() => anular(o)}>Anular</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ))}

        {tab === "eventuales" && (
          <>
            {eventuales.length === 0 ? <p className="empty">Aún no hay personas eventuales. Se añaden desde Horarios con «+ Eventual».</p> : (
              <ul className="b-evs">
                {eventuales.map((u) => (
                  <li key={u.id}>
                    <Avatar nombre={u.nombre} size={30} />
                    <div><b>{u.nombre}</b><small className={u.auth_id ? "ok" : ""}>{u.auth_id ? `Con acceso · ${u.email || ""}` : "Sin acceso a la app"}</small></div>
                    {u.auth_id ? <button className="btn-txt peligro" onClick={() => quitarAcceso(u)}>Quitar acceso</button>
                      : <button className="btn-l" onClick={() => setAcceso(u)}>Dar acceso</button>}
                  </li>
                ))}
              </ul>
            )}
            <p className="sub fuera">Con acceso, la eventual entra en app.elrecao.com y solo ve los turnos de apoyo que puede coger. No ve facturas, proveedores ni datos internos.</p>
          </>
        )}
      </div>

      {publicando && <Publicar onClose={() => setPublicando(false)} onHecho={() => { setPublicando(false); cargar(); }} />}
      {acceso && <DarAcceso persona={acceso} onClose={() => setAcceso(null)} onHecho={() => { setAcceso(null); recargarEquipo(); }} />}
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
        <label className="campo">Turno<select value={f.turno} onChange={(e) => setF({ ...f, turno: e.target.value })}>{TURNOS_BOLSA.map((t) => <option key={t} value={t}>{t} · {horarioDe(t)}</option>)}</select></label>
      </div>
      <p className="b-va">Lo verán: <Destino t={f.turno} /></p>
      {d != null && d < DIAS_ANTELACION && <p className="b-aviso">Faltan {d} días: menos de las 3 semanas habituales.{d <= 10 ? " Saldrá ya como urgente." : ""}</p>}
      <label className="campo">Nota (opcional)<input value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} placeholder="p. ej. hay que recibir al proveedor de fruta" /></label>
    </Panel>
  );
}

function DarAcceso({ persona, onClose, onHecho }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [tel, setTel] = useState(persona.telefono || "");
  const [busy, setBusy] = useState(false);
  const telN = telNormalizado(tel);
  const valido = /\S+@\S+\.\S+/.test(email) && pass.length >= 8 && !!telN;
  async function crear() {
    setBusy(true);
    try { await sb.fn("gestion-usuarios", { action: "dar_acceso_eventual", id: persona.id, email: email.trim(), password: pass, telefono: telN }); avisar("Acceso creado: pásale su email y contraseña"); onHecho(); }
    catch (e) { avisar(e.message || "No se ha podido crear el acceso", "mal"); }
    finally { setBusy(false); }
  }
  return (
    <Panel titulo={`Acceso para ${persona.nombre}`} sub="Entrará en app.elrecao.com y solo verá los apoyos que puede coger" onClose={onClose} ancho="460px"
      pie={<button className="btn-p" disabled={!valido || busy} onClick={crear}>{busy ? "Creando…" : "Crear acceso"}</button>}>
      <label className="campo">Email<input type="email" autoCapitalize="none" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" /></label>
      <label className="campo">Contraseña temporal<input autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Mínimo 8 caracteres" /></label>
      <label className="campo">Móvil (avisos por WhatsApp)<input type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="612 345 678" /></label>
      <p className="sub" style={tel && telN === null ? { color: "var(--down)" } : undefined}>{tel && telN === null ? "Formato no válido. " : ""}{TEL_AYUDA}</p>
      <p className="sub">Pásale el email y la contraseña en persona o por teléfono, no por escrito en un grupo.</p>
    </Panel>
  );
}
