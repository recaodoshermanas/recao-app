// Personas · Fichajes (dirección)
// Los fichajes salen del reloj de la caja (Epos) cada 30 minutos y se comparan con el horario.
// Dirección corrige lo mal registrado con un motivo; lo que dijo Epos y cada cambio quedan guardados (registro de jornada).
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Panel, Pestanas, Cargando, avisar, fechaCorta, hace } from "../ui.jsx";

const fn = (accion, datos = {}) => sb.fn("fichajes", { accion, ...datos });
const INC = {
  sin_fichaje: { t: "Sin fichar", c: "var(--down)" },
  sin_salida: { t: "Sin salida", c: "var(--down)" },
  cero: { t: "Fichaje de 0 min", c: "#8A5A0B" },
  larga: { t: "Más de 13 h", c: "var(--down)" },
  tarde: { t: "Entrada tarde", c: "#8A5A0B" },
  exceso: { t: "Salida tarde (¿extra?)", c: "#2F5C8F" },
  sin_turno: { t: "Fichó sin turno", c: "#2F5C8F" },
};
const hora = (t) => (t ? String(t).slice(11, 16) : "—");
const h2 = (n) => { const m = Math.round(Number(n || 0) * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`; };
const mesActual = () => new Date().toISOString().slice(0, 7);
const rangoMes = (m) => { const [y, mm] = m.split("-").map(Number); const fin = new Date(y, mm, 0).getDate(); return { desde: `${m}-01`, hasta: `${m}-${String(fin).padStart(2, "0")}` }; };

function Chips({ lista }) {
  return <>{(lista || []).filter((i) => INC[i]).map((i) => <span key={i} className="pf" style={{ display: "inline-block", marginRight: 8, color: INC[i].c, fontWeight: 700 }}>{INC[i].t}</span>)}</>;
}

export function Fichajes() {
  const [tab, setTab] = useState("revisar");
  const [d, setD] = useState(null);
  const [mes, setMes] = useState(mesActual());
  const [dm, setDm] = useState(null);
  const [editar, setEditar] = useState(null);
  const [sinc, setSinc] = useState(false);

  const cargar = useCallback(async () => { try { setD(await fn("panel")); } catch (e) { avisar(e.message || "No se han podido cargar los fichajes", "mal"); setD((x) => x || { dias: [], solicitudes: [], usuarios: [] }); } }, []);
  const cargarMes = useCallback(async () => { try { setDm(await fn("panel", rangoMes(mes))); } catch (e) { avisar(e.message, "mal"); } }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (tab === "mes") cargarMes(); }, [tab, cargarMes]);

  const sincronizar = async () => { setSinc(true); try { const r = await fn("sincronizar"); avisar(`Traídos de Epos: ${r.nuevos} nuevos, ${r.actualizados} actualizados`); await cargar(); if (tab === "mes") await cargarMes(); } catch (e) { avisar(e.message, "mal"); } setSinc(false); };

  if (!d) return <Cargando texto="Cargando fichajes…" />;
  const revisar = d.dias.filter((x) => (x.incidencias || []).some((i) => INC[i]));
  const pendientes = d.solicitudes.filter((s) => s.estado === "pendiente");
  const sinEpos = d.usuarios.filter((u) => !u.epos_staff_id);
  const opciones = [
    { id: "revisar", label: "Por revisar", n: revisar.length },
    { id: "peticiones", label: "Peticiones", n: pendientes.length },
    { id: "mes", label: "Horas del mes" },
    { id: "usuarios", label: "Usuarios de Epos", n: sinEpos.length },
  ];
  const recargarTodo = async () => { await cargar(); if (tab === "mes") await cargarMes(); };

  return (
    <>
      <div className="head" style={{ alignItems: "center" }}>
        <p className="sub" style={{ margin: 0 }}>Fichajes del reloj de la caja. Última lectura de Epos: {d.sincronizado_en ? hace(d.sincronizado_en) : "nunca"} (se leen solos cada 30 min).</p>
        <button className="btn-l" disabled={sinc} onClick={sincronizar}>{sinc ? "Leyendo Epos…" : "Leer ahora"}</button>
      </div>
      {sinEpos.length > 0 && <p className="b-nota">{sinEpos.length} trabajadora{sinEpos.length > 1 ? "s" : ""} sin usuario en la caja: sus horas no quedan registradas. Dadlas de alta en Epos (cada una con su PIN) y vinculadlas en «Usuarios de Epos».</p>}
      <Pestanas valor={tab} opciones={opciones} onChange={setTab} etiqueta="Secciones de fichajes" />
      <div className="card mt">
        {tab === "revisar" && <Revisar dias={revisar} onEditar={setEditar} />}
        {tab === "peticiones" && <Peticiones lista={d.solicitudes} onCambio={recargarTodo} />}
        {tab === "mes" && <Mes mes={mes} setMes={setMes} d={dm} onEditar={setEditar} />}
        {tab === "usuarios" && <Usuarios usuarios={d.usuarios} onCambio={recargarTodo} />}
      </div>
      {editar && <EditarDia dia={editar} onClose={() => setEditar(null)} onHecho={() => { setEditar(null); recargarTodo(); }} />}
    </>
  );
}

function Revisar({ dias, onEditar }) {
  if (!dias.length) return <p className="empty">Nada que revisar en los últimos 30 días.</p>;
  return (
    <>
      <div className="head"><div><h2>Por revisar · últimos 30 días</h2><p className="sub">Días en los que el fichaje no cuadra con el horario. Corrige lo que esté mal; lo que esté bien (por ejemplo, una hora extra real) puedes dejarlo.</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Día</th><th>Persona</th><th>Turno</th><th>Fichado</th><th>Qué pasa</th><th></th></tr></thead>
          <tbody>
            {dias.map((x) => (
              <tr key={`${x.usuario_id}-${x.fecha}`}>
                <td>{fechaCorta(x.fecha)}</td>
                <td><span className="pn">{x.nombre}</span></td>
                <td>{x.turno ? <>{x.turno}<span className="pf">{String(x.ini).slice(0, 5)}–{String(x.fin).slice(0, 5)}</span></> : "—"}</td>
                <td>{(x.fichajes || []).map((f) => <span key={f.id} className="pf" style={{ color: "inherit" }}>{hora(f.entrada)}–{hora(f.salida)}{f.corregido ? " ✎" : ""}</span>)}{!x.fichajes && "—"}</td>
                <td><Chips lista={x.incidencias} /></td>
                <td className="r"><button className="btn-l" onClick={() => onEditar(x)}>Corregir</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EditarDia({ dia, onClose, onHecho }) {
  const [filas, setFilas] = useState(() => (dia.fichajes || []).map((f) => ({ id: f.id, entrada: hora(f.entrada), salida: f.salida ? hora(f.salida) : "", anular: false, orig: f })));
  const [nuevo, setNuevo] = useState(!dia.fichajes ? { entrada: dia.ini ? String(dia.ini).slice(0, 5) : "", salida: dia.fin ? String(dia.fin).slice(0, 5) : "" } : null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [historial, setHistorial] = useState(null);
  const cambiar = (i, c) => setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...c } : f)));
  const guardar = async () => {
    if (motivo.trim().length < 3) { avisar("Escribe el motivo", "mal"); return; }
    setBusy(true);
    try {
      for (const f of filas) {
        const salidaOrig = f.orig.salida ? hora(f.orig.salida) : "";
        if (!f.anular && f.entrada === hora(f.orig.entrada) && f.salida === salidaOrig) continue;
        const pasaMedianoche = f.salida && f.salida < f.entrada;
        await fn("corregir", { fichaje_id: f.id, entrada: f.entrada, salida: f.salida || null, anular: f.anular, motivo, fecha_salida: pasaMedianoche ? siguiente(dia.fecha) : undefined });
      }
      if (nuevo && nuevo.entrada && nuevo.salida) await fn("corregir", { usuario_id: dia.usuario_id, fecha: dia.fecha, entrada: nuevo.entrada, salida: nuevo.salida, motivo });
      avisar("Fichaje corregido"); onHecho();
    } catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  const verHistorial = async (id) => { try { const r = await fn("historial", { fichaje_id: id }); setHistorial(r.cambios); } catch (e) { avisar(e.message, "mal"); } };
  return (
    <Panel titulo={`${dia.nombre} · ${fechaCorta(dia.fecha)}`} sub={dia.turno ? `Turno ${dia.turno} (${String(dia.ini).slice(0, 5)}–${String(dia.fin).slice(0, 5)})` : "Sin turno ese día"} onClose={onClose}
      pie={<button className="btn-p" disabled={busy} onClick={guardar}>{busy ? "Guardando…" : "Guardar corrección"}</button>}>
      <Chips lista={dia.incidencias} />
      {filas.map((f, i) => (
        <div key={f.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, margin: "12px 0", opacity: f.anular ? 0.5 : 1 }}>
          <div className="pf" style={{ marginBottom: 8 }}>Epos: {hora(f.orig.entrada)}–{hora(f.orig.salida)}{f.orig.corregido ? " · ya corregido antes" : ""} · <button className="btn-txt" onClick={() => verHistorial(f.id)}>historial</button></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label className="campo" style={{ marginBottom: 0 }}>Entrada<input type="time" value={f.entrada} onChange={(e) => cambiar(i, { entrada: e.target.value })} /></label>
            <label className="campo" style={{ marginBottom: 0 }}>Salida<input type="time" value={f.salida} onChange={(e) => cambiar(i, { salida: e.target.value })} /></label>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, fontSize: 13 }}><input type="checkbox" checked={f.anular} onChange={(e) => cambiar(i, { anular: e.target.checked })} /> Anular este fichaje (fichado por error)</label>
        </div>
      ))}
      {nuevo ? (
        <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: 12, margin: "12px 0" }}>
          <div className="pf" style={{ marginBottom: 8 }}>Fichaje que falta</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label className="campo" style={{ marginBottom: 0 }}>Entrada<input type="time" value={nuevo.entrada} onChange={(e) => setNuevo({ ...nuevo, entrada: e.target.value })} /></label>
            <label className="campo" style={{ marginBottom: 0 }}>Salida<input type="time" value={nuevo.salida} onChange={(e) => setNuevo({ ...nuevo, salida: e.target.value })} /></label>
          </div>
        </div>
      ) : <button className="btn-l" style={{ marginBottom: 12 }} onClick={() => setNuevo({ entrada: "", salida: "" })}>+ Añadir un fichaje que falta</button>}
      <label className="campo">Motivo (queda guardado)<textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="p. ej. Se le olvidó fichar la salida; cerró a las 23:05 según el cierre de caja" /></label>
      {historial && (
        <div className="pf" style={{ marginTop: 8 }}>
          {historial.length === 0 ? "Sin cambios: es el fichaje original de Epos." : historial.map((c) => <div key={c.id}>{hace(c.hecho_en)} · {c.usuarios?.nombre || "sistema"}: {c.antes ? `${hora(c.antes.entrada)}–${hora(c.antes.salida)}` : "nuevo"} → {c.despues?.anulado ? "anulado" : `${hora(c.despues?.entrada)}–${hora(c.despues?.salida)}`} · {c.motivo}</div>)}
        </div>
      )}
    </Panel>
  );
}
function siguiente(fecha) { const d = new Date(`${fecha}T12:00:00`); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

function Peticiones({ lista, onCambio }) {
  const [horas, setHoras] = useState({});
  if (!lista.length) return <p className="empty">Las trabajadoras pueden pedir desde la app que se corrija un fichaje (por ejemplo, si se les olvidó fichar la salida). Aparecerán aquí.</p>;
  const resolver = async (s, aceptar) => {
    const h = horas[s.id] || {};
    let respuesta = null;
    if (!aceptar) { respuesta = window.prompt("¿Por qué no se acepta? (lo verá la trabajadora)") || null; }
    try { await fn("resolver_solicitud", { id: s.id, aceptar, entrada: h.entrada || undefined, salida: h.salida || undefined, respuesta }); avisar(aceptar ? "Corregido y avisada" : "Rechazada y avisada"); onCambio(); }
    catch (e) { avisar(e.message, "mal"); }
  };
  return (
    <>
      <div className="head"><div><h2>Peticiones de corrección</h2><p className="sub">Al aceptar, se corrige el fichaje con las horas que indica (puedes ajustarlas) y se le avisa.</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Persona</th><th>Día</th><th>Pide</th><th>Motivo</th><th></th></tr></thead>
          <tbody>
            {lista.map((s) => (
              <tr key={s.id}>
                <td><span className="pn">{s.usuarios?.nombre}</span><span className="pf">{hace(s.creado_en)}</span></td>
                <td>{fechaCorta(s.fecha)}</td>
                <td>{s.estado === "pendiente" ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input className="mini-input" type="time" aria-label="Entrada" defaultValue={s.entrada ? String(s.entrada).slice(0, 5) : ""} onChange={(e) => setHoras({ ...horas, [s.id]: { ...(horas[s.id] || {}), entrada: e.target.value } })} />
                    <input className="mini-input" type="time" aria-label="Salida" defaultValue={s.salida ? String(s.salida).slice(0, 5) : ""} onChange={(e) => setHoras({ ...horas, [s.id]: { ...(horas[s.id] || {}), salida: e.target.value } })} />
                  </div>
                ) : <span className="pf">{s.entrada ? `entrada ${String(s.entrada).slice(0, 5)} ` : ""}{s.salida ? `salida ${String(s.salida).slice(0, 5)}` : ""}</span>}</td>
                <td><span className="pf" style={{ color: "inherit" }}>{s.motivo}</span>{s.respuesta && <span className="pf">Respuesta: {s.respuesta}</span>}</td>
                <td className="r" style={{ whiteSpace: "nowrap" }}>{s.estado === "pendiente" ? <><button className="btn-p" onClick={() => resolver(s, true)}>Aceptar</button> <button className="btn-txt" onClick={() => resolver(s, false)}>No</button></> : <span className="pf">{s.estado === "aceptada" ? "Aceptada" : "Rechazada"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Mes({ mes, setMes, d, onEditar }) {
  const [abierta, setAbierta] = useState(null);
  const filas = useMemo(() => {
    const m = new Map();
    for (const x of d?.dias || []) {
      const p = m.get(x.usuario_id) || { id: x.usuario_id, nombre: x.nombre, turno: 0, fichado: 0, dias: [], inc: 0 };
      p.turno += Number(x.horas_turno || 0); p.fichado += Number(x.horas_fichadas || 0); p.dias.push(x);
      if ((x.incidencias || []).some((i) => INC[i])) p.inc++;
      m.set(x.usuario_id, p);
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [d]);
  const sinEpos = new Set((d?.usuarios || []).filter((u) => !u.epos_staff_id).map((u) => u.id));
  return (
    <>
      <div className="head">
        <div><h2>Horas del mes</h2><p className="sub">Horas fichadas frente a las horas de sus turnos. Las de más pueden ser horas extra; revísalas antes de pagarlas.</p></div>
        <label className="campo" style={{ marginBottom: 0 }}>Mes<input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /></label>
      </div>
      {!d ? <Cargando /> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Persona</th><th className="r">Horas de turno</th><th className="r">Fichadas</th><th className="r">Diferencia</th><th className="r">Por revisar</th><th></th></tr></thead>
            <tbody>
              {filas.map((p) => { const dif = p.fichado - p.turno; return (
                <Fragment key={p.id}>
                  <tr>
                    <td><span className="pn">{p.nombre}</span>{sinEpos.has(p.id) && <span className="pf" style={{ color: "var(--down)" }}>Sin usuario en la caja</span>}</td>
                    <td className="r">{h2(p.turno)}</td>
                    <td className="r">{sinEpos.has(p.id) ? "—" : h2(p.fichado)}</td>
                    <td className="r b" style={{ color: dif < -0.5 ? "var(--down)" : undefined }}>{sinEpos.has(p.id) ? "—" : `${dif >= 0 ? "+" : "−"}${h2(Math.abs(dif))}`}</td>
                    <td className="r">{p.inc || ""}</td>
                    <td className="r"><button className="btn-txt" onClick={() => setAbierta(abierta === p.id ? null : p.id)}>{abierta === p.id ? "Ocultar" : "Ver días"}</button></td>
                  </tr>
                  {abierta === p.id && p.dias.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((x) => (
                    <tr key={`${p.id}-${x.fecha}`} style={{ background: "var(--bg)" }}>
                      <td><span className="pf">{fechaCorta(x.fecha)} · {x.turno || "sin turno"}</span></td>
                      <td className="r">{h2(x.horas_turno)}</td>
                      <td className="r">{(x.fichajes || []).map((f) => `${hora(f.entrada)}–${hora(f.salida)}`).join(", ") || "—"}</td>
                      <td className="r">{h2(x.horas_fichadas)}</td>
                      <td className="r"><Chips lista={x.incidencias} /></td>
                      <td className="r"><button className="btn-txt" onClick={() => onEditar(x)}>Corregir</button></td>
                    </tr>
                  ))}
                </Fragment>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Usuarios({ usuarios, onCambio }) {
  const [staff, setStaff] = useState(null);
  useEffect(() => { fn("staff_epos").then((r) => setStaff(r.staff)).catch((e) => { avisar(e.message, "mal"); setStaff([]); }); }, []);
  const vincular = async (u, sid) => { try { await fn("vincular", { usuario_id: u.id, epos_staff_id: sid || null }); avisar(sid ? "Vinculada" : "Desvinculada"); onCambio(); } catch (e) { avisar(e.message, "mal"); } };
  if (!staff) return <Cargando />;
  return (
    <>
      <div className="head"><div><h2>Usuarios de Epos</h2><p className="sub">Qué usuario de la caja es cada trabajadora. Las que no tienen usuario no dejan registro de horas: hay que darlas de alta en el back office de Epos (Staff), cada una con su PIN, y elegirlas aquí.</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Trabajadora</th><th>Usuario de la caja</th></tr></thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td><span className="pn">{u.nombre}</span><span className="pf">{u.eventual ? "Eventual" : u.jornada === "apoyo" ? "Apoyo" : "Principal"}</span></td>
                <td>
                  <label style={{ position: "absolute", left: -9999 }} htmlFor={`epos-${u.id}`}>Usuario de Epos de {u.nombre}</label>
                  <select id={`epos-${u.id}`} className="mini-input" value={u.epos_staff_id || ""} onChange={(e) => vincular(u, e.target.value)}>
                    <option value="">Sin usuario en la caja</option>
                    {staff.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
