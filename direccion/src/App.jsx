import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../src/hooks/useAuth.js";
import { useRecaoData } from "../../src/hooks/useRecaoData.js";
import { NotificacionesBell } from "../../src/components/NotificacionesBell.jsx";
import { AREAS, DESTINOS, leerRuta } from "./areas.js";
import { Pulso } from "./Pulso.jsx";
import { PersonasResumen } from "./PersonasResumen.jsx";
import { Legado } from "./Legado.jsx";
import { FinanzasResumen, FinanzasResultados, FinanzasCaja, FinanzasCompras } from "./Finanzas.jsx";
import { Horarios } from "./personas/Horarios.jsx";
import { Solicitudes } from "./personas/Solicitudes.jsx";
import { Seguimiento } from "./personas/Seguimiento.jsx";
import { Equipo } from "./personas/Equipo.jsx";
import { PlanResumen, Proyectos, PlanTareas, PlanCalendario } from "./plan/Plan.jsx";
import { Avisos } from "./ui.jsx";

const ICONO = "/icono.png";

function usarRuta() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const h = () => { setHash(window.location.hash); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return leerRuta(hash);
}
export const ir = (ruta) => { window.location.hash = `#/${ruta}`; };

function Login({ onLogin, aviso }) {
  const [msg, setMsg] = useState(aviso || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (aviso) setMsg(aviso); }, [aviso]);
  const enviar = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setBusy(true); setMsg("");
    const r = await onLogin(String(f.get("email")), String(f.get("pass")));
    setBusy(false);
    if (!r?.ok) setMsg(r?.error === "Email o contrasena incorrectos" ? "Email o contraseña incorrectos." : (r?.error || "No se ha podido entrar."));
  };
  return (
    <div className="login">
      <form onSubmit={enviar}>
        <img src={ICONO} alt="Recao" />
        <h1>Dirección</h1>
        <p>Entra con tu cuenta de la app de Recao.</p>
        <label>Email<input name="email" type="email" autoComplete="username" required /></label>
        <label>Contraseña<input name="pass" type="password" autoComplete="current-password" required /></label>
        <div className="err" role="alert">{msg}</div>
        <button type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}

function Cabecera({ user, area, onSalir }) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  useEffect(() => setAbierto(false), [area.id]);
  return (
    <header className="top">
      <a className="brand" href="#/pulso" aria-label="Recao Dirección, inicio"><img src={ICONO} alt="" /><b>Recao</b><span>Dirección</span></a>
      <button className="burger" aria-label={abierto ? "Cerrar menú" : "Abrir menú"} aria-expanded={abierto} aria-controls="menu" onClick={() => setAbierto(!abierto)}>
        <span /><span /><span />
      </button>
      <div className={`menu${abierto ? " open" : ""}`} id="menu">
        <nav className="nav" aria-label="Áreas">
          {AREAS.filter((a) => !a.oculto).map((a) => (
            <button key={a.id} aria-current={a.id === area.id ? "page" : undefined} disabled={a.pronto}
              title={a.pronto ? "Más adelante" : undefined} onClick={() => { ir(a.id); setAbierto(false); }}>
              {a.label}{a.pronto && <small>pronto</small>}
            </button>
          ))}
        </nav>
        <div className="user">
          <span>{user.nombre}</span>
          <button aria-current={area.id === "ajustes" ? "page" : undefined} onClick={() => ir("ajustes")}>Ajustes</button>
          <button onClick={onSalir}>Salir</button>
        </div>
      </div>
      <div className="campana"><NotificacionesBell user={user} /></div>
    </header>
  );
}

function Subnav({ area, sub }) {
  if (!area.subs) return null;
  const varias = area.subs.length > 1;
  return (
    <div className="subnav">
      <div className="subnav-t">
        <h1>{area.label}</h1>
        {area.quien && <span>Lleva {area.quien}</span>}
      </div>
      {varias && <nav className="pills" aria-label={`Secciones de ${area.label}`}>
        {area.subs.map((s) => (
          <a key={s.id} href={`#/${area.id}/${s.id}`} aria-current={s.id === sub.id ? "page" : undefined}>{s.label}</a>
        ))}
      </nav>}
      {varias && <label className="pills-movil">
        <span className="sr">Sección</span>
        <select value={sub.id} onChange={(e) => ir(`${area.id}/${e.target.value}`)}>
          {area.subs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>}
    </div>
  );
}

export default function App() {
  const { user, checking, login, logout } = useAuth();
  const esAdmin = user && user.rol === "admin";
  const datos = useRecaoData(esAdmin ? user : null);
  const { area, sub, extra } = usarRuta();
  const [aviso, setAviso] = useState("");
  const [mesFoco, setMesFoco] = useState(null);

  // Solo dirección: si entra otra cuenta, se cierra la sesión aquí (en la app sigue funcionando)
  useEffect(() => {
    if (user && user.rol !== "admin") { setAviso("Esta zona es solo para dirección."); logout(); }
  }, [user, logout]);

  // Notificaciones: llevan a la pantalla que toca
  useEffect(() => {
    const h = (e) => { const d = e.detail && DESTINOS[e.detail.destino]; if (d) ir(d); };
    window.addEventListener("recao-nav", h);
    return () => window.removeEventListener("recao-nav", h);
  }, []);

  const editarMes = useCallback((mk) => { setMesFoco(mk); ir("finanzas/cierre"); }, []);

  if (checking) return <div className="state">Cargando…</div>;
  if (!esAdmin) return <Login onLogin={async (e, p) => { setAviso(""); return login(e, p); }} aviso={aviso} />;

  let contenido;
  if (area.id === "pulso") contenido = <Pulso />;
  else if (area.id === "personas" && sub.id === "resumen") contenido = <PersonasResumen />;
  else if (area.id === "personas" && sub.id === "horarios") contenido = <Horarios />;
  else if (area.id === "personas" && sub.id === "solicitudes") contenido = <Solicitudes />;
  else if (area.id === "personas" && sub.id === "seguimiento") contenido = <Seguimiento sub={extra} />;
  else if (area.id === "personas" && sub.id === "equipo") contenido = <Equipo user={user} />;
  else if (area.id === "plan" && sub.id === "resumen") contenido = <PlanResumen user={user} />;
  else if (area.id === "plan" && sub.id === "proyectos") contenido = <Proyectos user={user} extra={extra} />;
  else if (area.id === "plan" && sub.id === "tareas") contenido = <PlanTareas user={user} />;
  else if (area.id === "plan" && sub.id === "calendario") contenido = <PlanCalendario user={user} />;
  else if (area.id === "finanzas" && sub.id === "resumen") contenido = <FinanzasResumen />;
  else if (area.id === "finanzas" && sub.id === "resultados") contenido = <FinanzasResultados onEditMonth={editarMes} />;
  else if (area.id === "finanzas" && sub.id === "caja") contenido = <FinanzasCaja />;
  else if (area.id === "finanzas" && sub.id === "compras") contenido = <FinanzasCompras />;
  else contenido = <Legado area={area.id} sub={sub.id} datos={datos} user={user} mesFoco={mesFoco} onEditMonth={editarMes} />;

  return (
    <div className="wrap">
      <Cabecera user={user} area={area} onSalir={logout} />
      <Subnav area={area} sub={sub} />
      <main id="main" key={`${area.id}/${sub ? sub.id : ""}/${extra || ""}`}>{contenido}</main>
      <Avisos />
    </div>
  );
}
