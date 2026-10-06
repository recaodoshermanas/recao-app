// Personas · Equipo: directorio con ficha por persona, plus del mes, horas extra y cuentas.
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { TURNOS } from "../../../src/lib/turnos.js";
import { resumenCalendario } from "../../../src/lib/vacaciones.js";
import { Panel, Pestanas, useEquipo, avisar, hoyStr, masDias, fechaCorta, Cargando, Avatar, n0 } from "../ui.jsx";
import { eur } from "../fmt.js";

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
  if (!equipo) return <Cargando />;
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={setVista} etiqueta="Equipo" opciones={[{ id: "personas", label: "Personas" }, { id: "plus", label: "Plus del mes" }, { id: "horas", label: "Horas extra" }]} />
        <div className="acciones"><button className="btn-p" onClick={() => setNueva(true)}>+ Nueva cuenta</button></div>
      </div>
      {vista === "personas" && <Directorio equipo={equipo} onFicha={setFicha} />}
      {vista === "plus" && <Plus equipo={equipo} />}
      {vista === "horas" && <Horas equipo={equipo} />}
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
    { id: "Principal", t: "Principales" }, { id: "Apoyo", t: "Apoyos" }, { id: "Equipo", t: "Equipo" }, { id: "Eventual", t: "Eventuales (sin cuenta)" }, { id: "Dirección", t: "Dirección" },
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
                    <div className="te-cab"><Avatar nombre={u.nombre} size={40} /><div><b>{u.nombre}</b><span>{u.activo ? (u.rol === "admin" ? "Dirección" : tipoDe(u)) : "Desactivada"}</span></div></div>
                    {u.rol !== "admin" && (
                      <div className="te-sem" aria-label="Turnos de los próximos 7 días">
                        {dias.map((f) => { const tt = hor[u.id]?.[f]; const inf = tt && TURNOS[tt]; return <span key={f} className={`ts ${f === hoy ? "hoy" : ""}`} style={inf ? { background: inf.bg, color: inf.fg } : undefined} title={`${fechaCorta(f)}: ${tt || "sin turno"}`}>{tt ? ABREV[tt] : "·"}</span>; })}
                      </div>
                    )}
                    {u.rol !== "admin" && <p className="te-hoy">{t ? `Hoy: ${t}${TURNOS[t]?.horas ? " · " + TURNOS[t].horas : ""}` : "Hoy no trabaja"}</p>}
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
    try { const r = await sb.fn("gestion-usuarios", body); if (r && r.ok === false) throw new Error(r.error); avisar(ok); await onCambio(); }
    catch (e) { avisar(e.message || "No se ha podido", "mal"); }
    setBusy(false);
  };
  return (
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
          <section className="ficha-sec">
            <h3>Cuenta</h3>
            {persona.eventual ? (
              <div className="acc-cuenta">
                <p className="sub">Persona eventual: sin acceso a la app, solo aparece en los horarios.</p>
                <button className="btn-txt peligro" disabled={busy} onClick={() => { if (window.confirm(`¿Eliminar a ${persona.nombre}? Se borran también sus turnos.`)) cuenta({ action: "eliminar_eventual", id: persona.id }, "Persona eliminada").then(onClose); }}>Eliminar persona</button>
              </div>
            ) : esYo ? <p className="sub">Es tu cuenta.</p> : (
              <div className="acc-cuenta">
                <button className="btn-l" disabled={busy} onClick={() => cuenta({ action: "actualizar", id: persona.id, rol: persona.rol === "admin" ? "trabajadora" : "admin" }, "Rol cambiado")}>{persona.rol === "admin" ? "Pasar a trabajadora" : "Dar acceso de dirección"}</button>
                <button className="btn-l" disabled={busy} onClick={() => cuenta({ action: "actualizar", id: persona.id, activo: !persona.activo }, persona.activo ? "Cuenta desactivada" : "Cuenta activada")}>{persona.activo ? "Desactivar cuenta" : "Activar cuenta"}</button>
                <button className="btn-l" disabled={busy} onClick={() => { const p = window.prompt(`Nueva contraseña para ${persona.nombre} (mínimo 8 caracteres)`); if (p && p.length >= 8) cuenta({ action: "resetear_password", id: persona.id, password: p }, "Contraseña cambiada"); else if (p) avisar("Mínimo 8 caracteres", "mal"); }}>Cambiar contraseña</button>
              </div>
            )}
          </section>
        </>
      )}
    </Panel>
  );
}

function NuevaCuenta({ onClose, onCreada }) {
  const [f, setF] = useState({ nombre: "", email: "", password: "", rol: "trabajadora" });
  const [busy, setBusy] = useState(false);
  const ok = f.nombre.trim() && f.email.trim() && f.password.length >= 8;
  const crear = async () => {
    setBusy(true);
    try { const r = await sb.fn("gestion-usuarios", { action: "crear", email: f.email.trim().toLowerCase(), nombre: f.nombre.trim(), rol: f.rol, password: f.password }); if (r && r.ok === false) throw new Error(r.error); avisar("Cuenta creada"); await onCreada(); }
    catch (e) { avisar(e.message || "No se ha podido crear", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Nueva cuenta" sub="Para entrar en la app. Las personas eventuales se añaden desde Horarios." onClose={onClose}
      pie={<button className="btn-p" disabled={!ok || busy} onClick={crear}>{busy ? "Creando…" : "Crear cuenta"}</button>}>
      <label className="campo">Nombre<input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
      <label className="campo">Email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <label className="campo">Contraseña inicial<input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" /></label>
      <div className="campo">Rol
        <div className="seg"><button aria-pressed={f.rol === "trabajadora"} onClick={() => setF({ ...f, rol: "trabajadora" })}>Trabajadora</button><button aria-pressed={f.rol === "admin"} onClick={() => setF({ ...f, rol: "admin" })}>Dirección</button></div>
      </div>
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
    const cab = ["Trabajadora", "Turnos programados", "Turnos computables", "Fallos mes", "Fallos trayectoria", "% mensual", "Importe mensual", "% trayectoria", "Importe trayectoria", "Total"];
    const rows = filas.map((f) => { const c = f.c || {}; return [f.t.nombre, c.turnos_prog ?? "", c.turnos_comp ?? "", c.fallos_mes ?? "", c.fallos_tray ?? "", pct(c.pct_mensual), String(c.importe_mensual ?? "").replace(".", ","), pct(c.pct_tray), String(c.importe_tray ?? "").replace(".", ","), String(c.total ?? "").replace(".", ",")]; });
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
                  <td><span className="pn">{t.nombre}</span></td>
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

function Horas({ equipo }) {
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
  useEffect(() => { cargar(); }, [cargar]);
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
