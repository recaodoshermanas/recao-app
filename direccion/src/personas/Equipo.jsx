// Personas · Equipo: directorio con ficha por persona, plus del mes, horas extra y cuentas.
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { TURNOS, horasTurno } from "../../../src/lib/turnos.js";
import { resumenCalendario } from "../../../src/lib/vacaciones.js";
import { Panel, Pestanas, useEquipo, avisar, hoyStr, masDias, fechaCorta, Cargando, Avatar, n0 } from "../ui.jsx";
import { eur } from "../fmt.js";
import { telNormalizado, TEL_AYUDA } from "../../../src/views/owner/UsuariosView.jsx";
import { Novedades } from "./Novedades.jsx";
import { PlusFestivo } from "./PlusFestivo.jsx";
import { HorasPorConfirmar, usePorConfirmar } from "./HorasPorConfirmar.jsx"; // #39

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const tipoDe = (u) => (u.rol === "admin" ? "Dirección" : u.eventual ? "Eventual" : (u.tipo_turno || u.jornada) === "principal" ? "Principal" : (u.tipo_turno || u.jornada) === "apoyo" ? "Apoyo" : "Equipo");
const ABREV = { "Mañana": "M", "Tarde": "T", "Apoyo 1": "A1", "Apoyo 2": "A2", "Apoyo 3": "A3", "Descanso": "D", "Vacaciones": "V", "Baja": "B", "Permiso": "P" };
const ultimoDia = (a, m) => new Date(a, m, 0).getDate();
const pctTxt = (v) => (v == null ? "–" : `${Math.round(n0(v) * 100)} %`);

export function Equipo({ user }) {
  const [vista, setVista] = useState("personas");
  const { equipo, recargarEquipo } = useEquipo();
  const [ficha, setFicha] = useState(null);
  const [nueva, setNueva] = useState(false);
  const { lista: porConfirmar, recargar: recargarHoras } = usePorConfirmar(); // #39
  if (!equipo) return <Cargando />;
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={setVista} etiqueta="Equipo" opciones={[{ id: "personas", label: "Personas" }, { id: "plus", label: "Plus del mes" }, { id: "horas", label: "Horas extra", n: (porConfirmar || []).length }, { id: "festivos", label: "Plus festivos" }, { id: "novedades", label: "Novedades" }]} />
        {vista !== "novedades" && <div className="acciones"><button className="btn-p" onClick={() => setNueva(true)}>+ Nueva cuenta</button></div>}
      </div>
      {vista === "personas" && <Directorio equipo={equipo} onFicha={setFicha} />}
      {vista === "plus" && <Plus equipo={equipo} />}
      {vista === "horas" && <><HorasPorConfirmar lista={porConfirmar} onCambio={recargarHoras} /><Horas equipo={equipo} refresco={porConfirmar} /></>}
      {vista === "festivos" && <PlusFestivo equipo={equipo} />}
      {vista === "novedades" && <Novedades />}
      {ficha && <Ficha persona={equipo.find((u) => u.id === ficha) || null} yo={user} onClose={() => setFicha(null)} onCambio={recargarEquipo} />}
      {nueva && <NuevaCuenta onClose={() => setNueva(false)} onCreada={async () => { await recargarEquipo(); setNueva(false); }} />}
    </>
  );
}

function Directorio({ equipo, onFicha }) {
  const hoy = hoyStr();
  const [hor, setHor] = useState({});
  const [verInactivos, setVerInactivos] = useState(false);
  useEffect(() => {
    sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${hoy}&fecha=lte.${masDias(hoy, 6)}`)
      .then((r) => { const m = {}; r.forEach((h) => { (m[h.usuario_id] ||= {})[h.fecha] = h.turno; }); setHor(m); }).catch(() => {});
  }, [hoy]);
  const grupos = [
    { id: "Principal", t: "Principales" }, { id: "Apoyo", t: "Apoyos" }, { id: "Equipo", t: "Equipo" }, { id: "Eventual", t: "Eventuales" }, { id: "Dirección", t: "Dirección" },
  ];
  const visibles = equipo.filter((u) => verInactivos || u.activo);
  const dias = Array.from({ length: 7 }, (_, i) => masDias(hoy, i));
  return (
    <>
      {grupos.map((g) => {
        const ps = visibles.filter((u) => tipoDe(u) === g.id);
        if (!ps.length) return null;
        return (
          <section key={g.id} className="grupo-eq">
            <h2 className="h-grupo">{g.t} <small>{ps.length}</small></h2>
            <div className="tarjetas-eq">
              {ps.map((u) => {
                const t = hor[u.id]?.[hoy];
                return (
                  <button key={u.id} className={`card tarjeta-eq ${u.activo ? "" : "inactiva"}`} onClick={() => onFicha(u.id)}>
                    <div className="te-cab"><Avatar nombre={u.nombre} size={40} /><div><b>{u.nombre}</b><span>{u.activo ? (u.rol === "admin" ? "Dirección" : u.eventual ? `Eventual · ${u.auth_id ? "con acceso a la app" : "sin acceso a la app"}` : tipoDe(u)) : "Desactivada"}</span></div></div>
                    {u.rol !== "admin" && (
                      <div className="te-sem" aria-label="Turnos de los próximos 7 días">
                        {dias.map((f) => { const tt = hor[u.id]?.[f]; const inf = tt && TURNOS[tt]; return <span key={f} className={`ts ${f === hoy ? "hoy" : ""}`} style={inf ? { background: inf.bg, color: inf.fg } : undefined} title={`${fechaCorta(f)}: ${tt || "sin turno"}`}>{tt ? ABREV[tt] : "·"}</span>; })}
                      </div>
                    )}
                    {u.rol !== "admin" && <p className="te-hoy">{t ? `Hoy: ${t}${TURNOS[t]?.horas ? " · " + horasTurno(t, hoy) : ""}` : "Hoy no trabaja"}</p>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <label className="chk"><input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} /> Ver también las cuentas desactivadas</label>
    </>
  );
}

function Ficha({ persona, yo, onClose, onCambio }) {
  const hoy = hoyStr(); const anio = Number(hoy.slice(0, 4)); const mes = Number(hoy.slice(5, 7));
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialogo, setDialogo] = useState(null); // #49: desactivar / borrar con turnos futuros
  const [acceso, setAcceso] = useState(false);
  const cargar = useCallback(async () => {
    if (!persona) return;
    const uid = persona.id;
    const [hor, vac, sal, sols, horas, f30, s90, plus] = await Promise.all([
      sb.select("horarios", `select=fecha,turno&usuario_id=eq.${uid}&fecha=gte.${hoy}&fecha=lte.${masDias(hoy, 13)}&order=fecha.asc`).catch(() => []),
      sb.select("horarios", `select=fecha&usuario_id=eq.${uid}&turno=eq.Vacaciones&fecha=gte.${anio}-01-01&fecha=lte.${anio}-12-31`).catch(() => []),
      sb.select("vacaciones_saldo", `select=dias_totales&usuario_id=eq.${uid}&anio=eq.${anio}`).catch(() => []),
      sb.select("vacaciones_solicitudes", `select=*&usuario_id=eq.${uid}&order=fecha_inicio.desc`).catch(() => []),
      sb.select("horas_extras", `select=*&usuario_id=eq.${uid}&fecha=gte.${anio}-${String(mes).padStart(2, "0")}-01&order=fecha.desc`).catch(() => []),
      persona.eventual || persona.rol === "admin" ? null : sb.rpc("disc_fallos_30", { p_uid: uid }).catch(() => null),
      persona.eventual || persona.rol === "admin" ? null : sb.rpc("disc_falsedades_90", { p_uid: uid }).catch(() => null),
      persona.eventual || persona.rol === "admin" ? null : sb.rpc("plus_calculo", { p_uid: uid, p_anio: anio, p_mes: mes }).catch(() => null),
    ]);
    setD({ hor, vac: resumenCalendario(sal[0]?.dias_totales ?? 22, vac.map((x) => x.fecha), sols, hoy), horas, f30, s90, plus: Array.isArray(plus) ? plus[0] : plus, proxVac: sols.filter((s) => s.estado === "aceptado" && s.fecha_fin >= hoy).sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))[0] });
  }, [persona, hoy, anio, mes]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  if (!persona) return null;
  const esYo = yo && yo.id === persona.id;
  const cuenta = async (body, ok) => {
    setBusy(true);
    try { const r = await sb.fn("gestion-usuarios", body); if (r && r.ok === false) throw new Error(r.error); avisar(ok); await onCambio(); setBusy(false); return true; }
    catch (e) { avisar(e.message || "No se ha podido", "mal"); setBusy(false); return false; }
  };
  const guardarDatos = async (cambios, aviso) => {
    if (aviso && !window.confirm(aviso)) return false;
    return cuenta({ action: "actualizar", id: persona.id, ...cambios }, "Datos guardados");
  };
  const turnosFuturos = async () => { try { return (await sb.rpc("turnos_futuros_persona", { p_uid: persona.id })) || []; } catch (e) { return []; } };
  const pedirDesactivar = async () => { setBusy(true); const t = await turnosFuturos(); setBusy(false); setDialogo({ tipo: "desactivar", turnos: t }); };
  const pedirBorrar = async () => { setBusy(true); const t = await turnosFuturos(); setBusy(false); setDialogo({ tipo: "borrar", turnos: t }); };
  return (
    <>
    <Panel titulo={persona.nombre} sub={`${tipoDe(persona)}${persona.email ? " · " + persona.email : ""}${persona.telefono ? " · " + persona.telefono : ""}`} onClose={onClose} ancho="560px">
      {!d ? <p className="empty">Cargando…</p> : (
        <>
          {persona.rol !== "admin" && (
            <section className="ficha-sec">
              <h3>Próximos 14 días</h3>
              <div className="te-sem grande">
                {Array.from({ length: 14 }, (_, i) => masDias(hoy, i)).map((f) => {
                  const t = d.hor.find((h) => h.fecha === f)?.turno; const inf = t && TURNOS[t];
                  return <span key={f} className={`ts ${f === hoy ? "hoy" : ""}`} style={inf ? { background: inf.bg, color: inf.fg } : undefined} title={`${fechaCorta(f)}: ${t || "sin turno"}`}><small>{fechaCorta(f).split(" ")[0]}</small>{t ? ABREV[t] : "·"}</span>;
                })}
              </div>
            </section>
          )}
          {!persona.eventual && persona.rol !== "admin" && (
            <div className="ficha-kpis">
              <div><span>Vacaciones que le quedan</span><b>{d.vac.restantes}</b><small>de {d.vac.total} · {d.vac.cogidos} cogidas{d.vac.pendientes ? ` · ${d.vac.pendientes} pendientes` : ""}</small></div>
              <div className={n0(d.f30) >= 3 ? "mal" : ""}><span>Fallos · 30 días</span><b>{d.f30 ?? "–"}<small>/4</small></b><small>{n0(d.s90)} de 3 falsedades en 90 días</small></div>
              <div><span>Plus de {MESES[mes - 1]}</span><b>{d.plus ? eur(d.plus.total, 2) : "–"}</b><small>{d.plus ? `mensual ${pctTxt(d.plus.pct_mensual)} · trayectoria ${pctTxt(d.plus.pct_tray)}` : ""}</small></div>
            </div>
          )}
          {d.proxVac && <p className="sub">Próximas vacaciones: {fechaCorta(d.proxVac.fecha_inicio)} → {fechaCorta(d.proxVac.fecha_fin)} ({d.proxVac.dias} días)</p>}
          {persona.rol !== "admin" && (
            <section className="ficha-sec">
              <h3>Horas extra de {MESES[mes - 1]} <small>{d.horas.reduce((s, h) => s + n0(h.horas), 0).toLocaleString("es-ES")} h</small></h3>
              {d.horas.length === 0 ? <p className="empty">Ninguna.</p> : <ul className="pq-l">{d.horas.map((h) => <li key={h.id}><span>{fechaCorta(h.fecha)}{h.nota && <span className="pf">{h.nota}</span>}</span><b>{n0(h.horas).toLocaleString("es-ES")} h</b></li>)}</ul>}
            </section>
          )}
          <DatosPersona persona={persona} busy={busy} onGuardar={guardarDatos} />
          <section className="ficha-sec">
            <h3>Cuenta</h3>
            {esYo ? <p className="sub">Es tu cuenta: no puedes desactivarla ni quitarte el acceso de dirección.</p> : null}
            <div className="acc-cuenta">
              {persona.eventual && !persona.auth_id && <button className="btn-p" disabled={busy} onClick={() => setAcceso(true)}>Dar acceso a la app</button>}
              {!esYo && <button className="btn-l" disabled={busy} onClick={() => cuenta({ action: "actualizar", id: persona.id, rol: persona.rol === "admin" ? "trabajadora" : "admin" }, "Rol cambiado")}>{persona.rol === "admin" ? "Pasar a trabajadora" : "Dar acceso de dirección"}</button>}
              {!esYo && <button className="btn-l" disabled={busy} onClick={() => (persona.activo ? pedirDesactivar() : cuenta({ action: "actualizar", id: persona.id, activo: true }, "Cuenta activada"))}>{persona.activo ? "Desactivar cuenta" : "Activar cuenta"}</button>}
              {persona.auth_id && <button className="btn-l" disabled={busy} onClick={() => { const p = window.prompt(`Nueva contraseña para ${persona.nombre} (mínimo 8 caracteres)`); if (p && p.length >= 8) cuenta({ action: "resetear_password", id: persona.id, password: p }, "Contraseña cambiada"); else if (p) avisar("Mínimo 8 caracteres", "mal"); }}>Cambiar contraseña</button>}
              {persona.eventual && !esYo && <button className="btn-txt peligro" disabled={busy} onClick={pedirBorrar}>Borrar persona</button>}
            </div>
            {!persona.eventual && persona.rol !== "admin" && <p className="sub">Las trabajadoras de plantilla no se borran, solo se desactivan: así se conserva su historial.</p>}
            {persona.rol === "admin" && <p className="sub">Las personas de dirección no se borran, solo se desactivan.</p>}
          </section>
        </>
      )}
    </Panel>
    {dialogo && <ConfirmarTurnos persona={persona} dialogo={dialogo} busy={busy} onClose={() => setDialogo(null)}
      onHecho={async (turnos) => {
        const ok = dialogo.tipo === "borrar"
          ? await cuenta({ action: "eliminar_eventual", id: persona.id }, "Persona borrada")
          : await cuenta({ action: "actualizar", id: persona.id, activo: false, turnos }, turnos === "bolsa" ? "Cuenta desactivada: sus turnos han salido a la bolsa" : "Cuenta desactivada");
        setDialogo(null); if (ok && dialogo.tipo === "borrar") onClose();
      }} />}
    {acceso && <DarAcceso persona={persona} onClose={() => setAcceso(false)} onHecho={async () => { setAcceso(false); await onCambio(); }} />}
    </>
  );
}

// #49: datos de la persona editables desde su perfil
const TIPOS = [{ id: "principal", t: "Principal" }, { id: "apoyo", t: "Apoyo" }, { id: "eventual", t: "Eventual" }];
const tipoId = (p) => (p.eventual ? "eventual" : (p.tipo_turno || p.jornada) === "apoyo" ? "apoyo" : (p.tipo_turno || p.jornada) === "principal" ? "principal" : "");
function DatosPersona({ persona, busy, onGuardar }) {
  const [edit, setEdit] = useState(false);
  const base = () => ({ nombre: persona.nombre || "", email: persona.email || "", tel: persona.telefono || "", tipo: tipoId(persona) });
  const [f, setF] = useState(base);
  useEffect(() => { setF(base()); setEdit(false); }, [persona.id, persona.nombre, persona.email, persona.telefono, persona.eventual, persona.tipo_turno, persona.jornada]); // eslint-disable-line
  const esAdmin = persona.rol === "admin";
  const telN = f.tel.trim() ? telNormalizado(f.tel) : "";
  const ok = f.nombre.trim() && telN !== null && (!persona.auth_id || /\S+@\S+\.\S+/.test(f.email));
  const guardar = async () => {
    const c = { nombre: f.nombre.trim(), telefono: telN || "" };
    const avisos = [];
    if (persona.auth_id && f.email.trim().toLowerCase() !== (persona.email || "").toLowerCase()) { c.email = f.email.trim(); avisos.push(`${persona.nombre} entrará en la app con el nuevo email (${c.email}). Díselo.`); }
    if (!esAdmin && f.tipo && f.tipo !== tipoId(persona)) { c.tipo = f.tipo; avisos.push("Cambiar el tipo de puesto cambia lo que ve en la app (eventuales o plantilla) y si entra en el plus."); }
    if (await onGuardar(c, avisos.length ? avisos.join("\n\n") + "\n\n¿Guardar?" : null)) setEdit(false);
  };
  return (
    <section className="ficha-sec">
      <h3>Datos {!edit && <button className="btn-l" onClick={() => setEdit(true)}>Editar</button>}</h3>
      {!edit ? (
        <ul className="pq-l">
          <li><span>Nombre</span><b>{persona.nombre}</b></li>
          <li><span>{persona.auth_id ? "Email (con el que entra)" : "Email"}</span><b>{persona.email || (persona.eventual ? "Sin acceso a la app" : "–")}</b></li>
          <li><span>Móvil</span><b>{persona.telefono || "–"}</b></li>
          <li><span>Puesto</span><b>{tipoDe(persona)}</b></li>
        </ul>
      ) : (
        <>
          <label className="campo">Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
          {persona.auth_id && <label className="campo">Email (con el que entra en la app)<input type="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>}
          <label className="campo">Móvil (avisos por WhatsApp)<input type="tel" inputMode="tel" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} placeholder="612 345 678" /></label>
          <p className="sub" style={f.tel && telN === null ? { color: "var(--down)" } : undefined}>{f.tel && telN === null ? "Formato no válido. " : ""}{TEL_AYUDA}</p>
          {!esAdmin && <div className="campo">Tipo de puesto
            <div className="seg">{TIPOS.map((t) => <button key={t.id} aria-pressed={f.tipo === t.id} onClick={() => setF({ ...f, tipo: t.id })}>{t.t}</button>)}</div>
          </div>}
          <div className="acc-cuenta">
            <button className="btn-p" disabled={!ok || busy} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>
            <button className="btn-l" disabled={busy} onClick={() => { setF(base()); setEdit(false); }}>Cancelar</button>
          </div>
        </>
      )}
    </section>
  );
}

// #49: desactivar o borrar con los turnos futuros a la vista
function ConfirmarTurnos({ persona, dialogo, busy, onClose, onHecho }) {
  const borrar = dialogo.tipo === "borrar";
  const t = dialogo.turnos;
  const [que, setQue] = useState("mantener");
  return (
    <Panel titulo={borrar ? `Borrar a ${persona.nombre}` : `Desactivar a ${persona.nombre}`} onClose={onClose} ancho="460px"
      pie={<button className={borrar ? "btn-l peligro" : "btn-p"} disabled={busy} onClick={() => onHecho(borrar ? "bolsa" : t.length ? que : "mantener")}>{busy ? "Un momento…" : borrar ? "Borrar para siempre" : "Desactivar cuenta"}</button>}>
      {borrar && <p className="sub"><b>Se borra para siempre</b>{persona.auth_id ? ", también su cuenta de acceso" : ""}. No se puede deshacer.</p>}
      {t.length > 0 ? (
        <>
          <p>Tiene {t.length} {t.length === 1 ? "turno" : "turnos"} de trabajo desde hoy:</p>
          <ul className="pq-l" style={{ maxHeight: 200, overflow: "auto" }}>{t.map((x) => <li key={x.fecha}><span>{fechaCorta(x.fecha)}</span><b>{x.turno} · {horasTurno(x.turno, x.fecha)}</b></li>)}</ul>
          {borrar ? <p className="sub">Al confirmar, esos turnos salen a la bolsa.</p> : (
            <div className="campo">¿Qué hacemos con ellos?
              <div className="seg"><button aria-pressed={que === "mantener"} onClick={() => setQue("mantener")}>Mantener los turnos</button><button aria-pressed={que === "bolsa"} onClick={() => setQue("bolsa")}>Lanzarlos a la bolsa</button></div>
              <small>{que === "bolsa" ? "Se le quitan del horario y salen a la bolsa con las reglas de siempre (Apoyos a eventuales; Mañana y Tarde a la plantilla)." : "Se quedan asignados a esta persona."}</small>
            </div>
          )}
        </>
      ) : <p className="sub">No tiene turnos de trabajo desde hoy.</p>}
      {!borrar && <p className="sub">Desactivada no puede entrar en la app, no recibe avisos ni ofertas de la bolsa y no aparece entre quienes pueden cubrir un turno. Se puede volver a activar.</p>}
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
    try { const r = await sb.fn("gestion-usuarios", { action: "dar_acceso_eventual", id: persona.id, email: email.trim(), password: pass, telefono: telN }); if (r && r.ok === false) throw new Error(r.error); avisar("Acceso creado: pásale su email y contraseña"); await onHecho(); }
    catch (e) { avisar(e.message || "No se ha podido crear el acceso", "mal"); }
    setBusy(false);
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

function NuevaCuenta({ onClose, onCreada }) {
  const [f, setF] = useState({ nombre: "", email: "", password: "", tel: "", tipo: "principal", acceso: false });
  const [busy, setBusy] = useState(false);
  const ev = f.tipo === "eventual";
  const pideCuenta = !ev || f.acceso;
  const telN = telNormalizado(f.tel);
  const ok = f.nombre.trim() && (!pideCuenta || (/\S+@\S+\.\S+/.test(f.email) && f.password.length >= 8 && !!telN));
  const crear = async () => {
    setBusy(true);
    try {
      const r = ev
        ? await sb.fn("gestion-usuarios", { action: "crear_eventual", nombre: f.nombre.trim(), telefono: telN || undefined, acceso: f.acceso, email: f.email.trim().toLowerCase(), password: f.password })
        : await sb.fn("gestion-usuarios", { action: "crear", tipo: f.tipo === "direccion" ? "admin" : f.tipo, email: f.email.trim().toLowerCase(), nombre: f.nombre.trim(), password: f.password, telefono: telN });
      if (r && r.ok === false) throw new Error(r.error);
      avisar(ev && !f.acceso ? "Persona creada sin acceso a la app" : "Cuenta creada"); await onCreada();
    } catch (e) { avisar(e.message || "No se ha podido crear", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Nueva cuenta" sub="Elige el tipo de persona. Las eventuales pueden crearse sin acceso a la app." onClose={onClose}
      pie={<button className="btn-p" disabled={!ok || busy} onClick={crear}>{busy ? "Creando…" : "Crear"}</button>}>
      <div className="campo">Tipo
        <div className="seg">{[...TIPOS, { id: "direccion", t: "Dirección" }].map((t) => <button key={t.id} aria-pressed={f.tipo === t.id} onClick={() => setF({ ...f, tipo: t.id })}>{t.t}</button>)}</div>
      </div>
      <label className="campo">Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
      {ev && <label className="chk"><input type="checkbox" checked={f.acceso} onChange={(e) => setF({ ...f, acceso: e.target.checked })} /> Darle acceso a la app ahora</label>}
      {pideCuenta && (
        <>
          <label className="campo">Email<input type="email" autoCapitalize="none" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="campo">{ev ? "Contraseña temporal" : "Contraseña inicial"}<input type="text" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" /></label>
        </>
      )}
      <label className="campo">Móvil (avisos por WhatsApp){pideCuenta ? "" : " · opcional"}<input type="tel" inputMode="tel" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} placeholder="612 345 678" /></label>
      <p className="sub" style={f.tel && telN === null ? { color: "var(--down)" } : undefined}>{f.tel && telN === null ? "Formato no válido. " : ""}{TEL_AYUDA}</p>
    </Panel>
  );
}

function SelMes({ anio, mes, onChange }) {
  const mover = (k) => { let m = mes + k, a = anio; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } onChange(a, m); };
  return <div className="nav-sem"><button className="btn-l" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button><b className="mes-txt">{MESES[mes - 1]} {anio}</b><button className="btn-l" onClick={() => mover(1)} aria-label="Mes siguiente">›</button></div>;
}

function Plus({ equipo }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear()); const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [filas, setFilas] = useState(null);
  const trab = useMemo(() => equipo.filter((u) => u.rol === "trabajadora" && u.activo && !u.eventual), [equipo]);
  useEffect(() => {
    let vivo = true; setFilas(null);
    Promise.all(trab.map((t) => sb.rpc("plus_calculo", { p_uid: t.id, p_anio: anio, p_mes: mes }).then((r) => ({ t, c: Array.isArray(r) ? r[0] : r })).catch(() => ({ t, c: null }))))
      .then((r) => { if (vivo) setFilas(r); });
    return () => { vivo = false; };
  }, [trab, anio, mes]);
  const total = (filas || []).reduce((s, f) => s + n0(f.c?.total), 0);
  const exportar = () => {
    const pct = (v) => (v == null ? "" : Math.round(v * 100) + "%");
    // BOLSA: si plus_calculo devuelve los días como apoyo y como principal, van también al CSV con las bases
    const conDias = filas.some((f) => f.c && f.c.dias_apoyo != null);
    const nu = (v) => String(v ?? "").replace(".", ",");
    const cab = ["Trabajadora", "Turnos programados", "Turnos computables", ...(conDias ? ["Días apoyo", "Días principal", "Base mensual", "Base trayectoria"] : []), "Fallos mes", "Fallos trayectoria", "% mensual", "Importe mensual", "% trayectoria", "Importe trayectoria", "Total"];
    const rows = filas.map((f) => { const c = f.c || {}; return [f.t.nombre, c.turnos_prog ?? "", c.turnos_comp ?? "", ...(conDias ? [c.dias_apoyo ?? "", c.dias_principal ?? "", nu(c.base_mensual), nu(c.base_tray)] : []), c.fallos_mes ?? "", c.fallos_tray ?? "", pct(c.pct_mensual), nu(c.importe_mensual), pct(c.pct_tray), nu(c.importe_tray), nu(c.total)]; });
    const csv = [cab, ...rows].map((r) => r.map((x) => `"${String(x)}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a"); a.href = url; a.download = `plus_${anio}_${String(mes).padStart(2, "0")}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="card">
      <div className="head">
        <div><h2>Plus de {MESES[mes - 1]} · {filas ? eur(total, 2) : "…"}</h2><p className="sub">Base × porcentaje según turnos y fallos (mensual) y trayectoria. Lo calcula la base de datos.</p></div>
        <div className="nav-sem"><SelMes anio={anio} mes={mes} onChange={(a, m) => { setAnio(a); setMes(m); }} />{filas && <button className="btn-l" onClick={exportar}>Descargar CSV</button>}</div>
      </div>
      {!filas ? <p className="empty">Calculando…</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Persona</th><th className="r">Turnos</th><th className="r">Fallos mes</th><th className="r">Mensual</th><th className="r">Fallos tray.</th><th className="r">Trayectoria</th><th className="r">Total</th></tr></thead>
            <tbody>
              {filas.map(({ t, c }) => (
                <tr key={t.id}>
                  <td><span className="pn">{t.nombre}</span>{n0(c?.dias_apoyo) > 0 && n0(c?.dias_principal) > 0 && <span className="pf">base proporcional: {c.dias_apoyo} días de apoyo y {c.dias_principal} de principal</span>}</td>
                  <td className="r">{c ? `${c.turnos_comp ?? "–"}/${c.turnos_prog ?? "–"}` : "–"}</td>
                  <td className={`r ${n0(c?.fallos_mes) ? "down" : ""}`}>{c?.fallos_mes ?? "–"}</td>
                  <td className="r">{c ? <>{eur(c.importe_mensual, 2)}<span className="pf">{eur(c.base_mensual, 0)} × {pctTxt(c.pct_mensual)}</span></> : "–"}</td>
                  <td className="r">{c?.fallos_tray ?? "–"}</td>
                  <td className="r">{c ? <>{eur(c.importe_tray, 2)}<span className="pf">{eur(c.base_tray, 0)} × {pctTxt(c.pct_tray)}</span></> : "–"}</td>
                  <td className="r b">{c ? eur(c.total, 2) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sub fuera">Prorrateo al 100 % (mes completo). Falta afinar el prorrateo de meses parciales y la media en vacaciones.</p>
    </div>
  );
}

function Horas({ equipo, refresco }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear()); const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [filas, setFilas] = useState(null);
  const [nueva, setNueva] = useState(false);
  const trab = useMemo(() => equipo.filter((u) => u.rol === "trabajadora" && u.activo), [equipo]);
  const nombreDe = useMemo(() => Object.fromEntries(equipo.map((u) => [u.id, u.nombre])), [equipo]);
  const mm = String(mes).padStart(2, "0");
  const cargar = useCallback(async () => {
    setFilas(null);
    try { setFilas(await sb.select("horas_extras", `select=*&fecha=gte.${anio}-${mm}-01&fecha=lte.${anio}-${mm}-${ultimoDia(anio, mes)}&order=fecha.asc`)); } catch (e) { setFilas([]); }
  }, [anio, mes, mm]);
  useEffect(() => { cargar(); }, [cargar, refresco]);
  const porPersona = Object.entries((filas || []).reduce((a, h) => { (a[h.usuario_id] ||= []).push(h); return a; }, {})).sort((a, b) => (nombreDe[a[0]] || "").localeCompare(nombreDe[b[0]] || ""));
  const total = (filas || []).reduce((s, h) => s + n0(h.horas), 0);
  const borrar = async (h) => { if (!window.confirm("¿Borrar estas horas?")) return; try { await sb.delete("horas_extras", `id=eq.${h.id}`); avisar("Horas borradas"); cargar(); } catch (e) { avisar("No se ha podido", "mal"); } };
  return (
    <div className="card">
      <div className="head">
        <div><h2>Horas extra de {MESES[mes - 1]} · {total.toLocaleString("es-ES")} h</h2><p className="sub">Registro manual por persona.</p></div>
        <div className="nav-sem"><SelMes anio={anio} mes={mes} onChange={(a, m) => { setAnio(a); setMes(m); }} /><button className="btn-p" onClick={() => setNueva(true)}>+ Añadir</button></div>
      </div>
      {!filas ? <p className="empty">Cargando…</p> : porPersona.length === 0 ? <p className="empty">No hay horas extra este mes.</p> : (
        <div className="horas-grid">
          {porPersona.map(([uid, hs]) => (
            <div key={uid} className="horas-p">
              <h3><Avatar nombre={nombreDe[uid]} size={26} />{nombreDe[uid] || "—"}<b>{hs.reduce((s, h) => s + n0(h.horas), 0).toLocaleString("es-ES")} h</b></h3>
              <ul className="pq-l">{hs.map((h) => <li key={h.id}><span>{fechaCorta(h.fecha)}{h.nota && <span className="pf">{h.nota}</span>}</span><span className="der"><b>{n0(h.horas).toLocaleString("es-ES")} h</b><button className="x" onClick={() => borrar(h)} aria-label="Borrar">×</button></span></li>)}</ul>
            </div>
          ))}
        </div>
      )}
      {nueva && <NuevasHoras trab={trab} anio={anio} mes={mes} onClose={() => setNueva(false)} onGuardar={async (row) => {
        try { await sb.insert("horas_extras", row); avisar("Horas añadidas"); setNueva(false); cargar(); } catch (e) { avisar("No se ha podido guardar", "mal"); }
      }} />}
    </div>
  );
}

function NuevasHoras({ trab, anio, mes, onClose, onGuardar }) {
  const mm = String(mes).padStart(2, "0");
  const hoy = hoyStr();
  const def = hoy.startsWith(`${anio}-${mm}`) ? hoy : `${anio}-${mm}-01`;
  const [uid, setUid] = useState(""); const [fecha, setFecha] = useState(def); const [horas, setHoras] = useState(""); const [nota, setNota] = useState("");
  const h = parseFloat(String(horas).replace(",", "."));
  return (
    <Panel titulo="Añadir horas extra" onClose={onClose}
      pie={<button className="btn-p" disabled={!uid || !(h > 0) || !fecha} onClick={() => onGuardar({ usuario_id: uid, fecha, horas: h, nota: nota.trim() || null })}>Guardar</button>}>
      <label className="campo">Persona<select value={uid} onChange={(e) => setUid(e.target.value)}><option value="">Elegir…</option>{trab.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
      <div className="fila-campos">
        <label className="campo">Fecha<input type="date" value={fecha} min={`${anio}-${mm}-01`} max={`${anio}-${mm}-${ultimoDia(anio, mes)}`} onChange={(e) => setFecha(e.target.value)} /></label>
        <label className="campo">Horas<input type="number" step="0.5" min="0" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="2" /></label>
      </div>
      <label className="campo">Motivo<input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" /></label>
    </Panel>
  );
}
