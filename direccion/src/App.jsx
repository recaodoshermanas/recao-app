import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../src/hooks/useAuth.js";
import { useRecaoData } from "../../src/hooks/useRecaoData.js";
import { NotificacionesBell } from "../../src/components/NotificacionesBell.jsx";
import { AREAS, DESTINOS, FIN_PESTANAS, leerRuta } from "./areas.js";
import { Pulso } from "./Pulso.jsx";
import { PersonasResumen } from "./PersonasResumen.jsx";
import { Legado } from "./Legado.jsx";
import { FinanzasResumen, FinanzasResultados, FinanzasCaja, FinanzasCompras } from "./Finanzas.jsx";
import { EfectivoSobres } from "./EfectivoSobres.jsx"; // #14
import { Bancos } from "./finanzas/Bancos.jsx"; // #23
import { PagosPendientes } from "./finanzas/PagosPendientes.jsx"; // #27
import { Inversiones } from "./finanzas/Inversiones.jsx"; // #40
import { Mantenimiento } from "./finanzas/Mantenimiento.jsx"; // #42
import { Horarios } from "./personas/Horarios.jsx";
import { Solicitudes } from "./personas/Solicitudes.jsx";
import { Seguimiento } from "./personas/Seguimiento.jsx";
import { Equipo } from "./personas/Equipo.jsx";
import { Bolsa } from "./personas/Bolsa.jsx";
import { Fichajes } from "./personas/Fichajes.jsx";
import { Documentos } from "./personas/Documentos.jsx";
import { PlanResumen, Proyectos, PlanTareas, PlanCalendario } from "./plan/Plan.jsx";
import { ProductoResumen, Catalogo, Familias, Proveedores, Salud } from "./producto/Producto.jsx";
import { Recepcion } from "./producto/Recepcion.jsx";
import { ProductosRevisar } from "./producto/Revisar.jsx";
import { AppTienda } from "./producto/AppTienda.jsx";
import { MarketingResumen, MarketingClientes, MarketingCaptacion, MarketingCampanas, MarketingReputacion } from "./marketing/Marketing.jsx";
import { TecSolicitudes } from "./tecnologia/Solicitudes.jsx";
import { TecGuia } from "./tecnologia/Guia.jsx";
import { Avisos, Pestanas } from "./ui.jsx";
import { tokenRecuperar, limpiarTokenRecuperar, pedirRecuperacion, cambiarConToken } from "../../src/lib/recuperar.js";

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
  const [token] = useState(() => tokenRecuperar());
  const [modo, setModo] = useState(token ? "nueva" : "entrar"); // entrar | olvido | enviado | nueva
  const [correo, setCorreo] = useState("");
  const [msg, setMsg] = useState(aviso || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (aviso) setMsg(aviso); }, [aviso]);
  const cambiarModo = (m) => { setModo(m); setMsg(""); if (m === "entrar" && token) limpiarTokenRecuperar(); };
  const enviar = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setBusy(true); setMsg("");
    if (modo === "olvido") {
      const em = String(f.get("email") || "").trim();
      try { await pedirRecuperacion(em, "direccion"); setCorreo(em); setModo("enviado"); }
      catch (er) { setMsg(er.message || "No se ha podido enviar."); }
      setBusy(false); return;
    }
    if (modo === "nueva") {
      const p1 = String(f.get("pass") || ""), p2 = String(f.get("pass2") || "");
      if (p1.length < 8) { setMsg("Mínimo 8 caracteres."); setBusy(false); return; }
      if (p1 !== p2) { setMsg("Las contraseñas no coinciden."); setBusy(false); return; }
      try {
        const r = await cambiarConToken(token, p1);
        limpiarTokenRecuperar();
        const l = await onLogin(r.email, p1);
        if (!l?.ok) { setModo("entrar"); setMsg("Contraseña cambiada. Entra con la nueva."); }
      } catch (er) { setMsg(er.message || "No se ha podido cambiar."); }
      setBusy(false); return;
    }
    const r = await onLogin(String(f.get("email")), String(f.get("pass")));
    setBusy(false);
    if (!r?.ok) setMsg(r?.error === "Email o contrasena incorrectos" ? "Email o contraseña incorrectos." : (r?.error || "No se ha podido entrar."));
  };
  return (
    <div className="login">
      <form onSubmit={enviar} key={modo}>
        <img src={ICONO} alt="Recao" />
        <h1>Dirección</h1>
        {modo === "entrar" && <>
          <p>Entra con tu cuenta de la app de Recao.</p>
          <label>Email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Contraseña<input name="pass" type="password" autoComplete="current-password" required /></label>
          <div className="err" role="alert">{msg}</div>
          <button type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
          <button type="button" className="link" onClick={() => cambiarModo("olvido")}>¿Has olvidado tu contraseña?</button>
        </>}
        {modo === "olvido" && <>
          <p>Escribe tu correo y te mandamos un enlace para elegir una contraseña nueva.</p>
          <label>Email<input name="email" type="email" autoComplete="username" required autoFocus /></label>
          <div className="err" role="alert">{msg}</div>
          <button type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviarme el enlace"}</button>
          <button type="button" className="link" onClick={() => cambiarModo("entrar")}>Volver a entrar</button>
        </>}
        {modo === "enviado" && <>
          <p>Si <b>{correo}</b> tiene cuenta en Recao, en unos minutos te llega un correo con el enlace. Mira también en spam. El enlace caduca en 1 hora.</p>
          <button type="button" className="link" onClick={() => cambiarModo("entrar")}>Volver a entrar</button>
        </>}
        {modo === "nueva" && <>
          <p>Elige tu contraseña nueva (mínimo 8 caracteres).</p>
          <label>Contraseña nueva<input name="pass" type="password" autoComplete="new-password" required minLength={8} autoFocus /></label>
          <label>Repite la contraseña<input name="pass2" type="password" autoComplete="new-password" required minLength={8} /></label>
          <div className="err" role="alert">{msg}</div>
          <button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar y entrar"}</button>
          <button type="button" className="link" onClick={() => cambiarModo("entrar")}>Volver a entrar</button>
        </>}
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
    const h = (e) => { const d = e.detail && DESTINOS[e.detail.destino]; if (d) ir(e.detail.ref ? `${d}/${e.detail.ref}` : d); };
    window.addEventListener("recao-nav", h);
    return () => window.removeEventListener("recao-nav", h);
  }, []);

  const editarMes = useCallback((mk) => { setMesFoco(mk); ir("finanzas/resultados/cierre"); }, []);

  if (checking) return <div className="state">Cargando…</div>;
  if (!esAdmin || tokenRecuperar()) return <Login onLogin={async (e, p) => { setAviso(""); return login(e, p); }} aviso={aviso} />;

  let contenido;
  if (area.id === "pulso") contenido = <Pulso />;
  else if (area.id === "personas" && sub.id === "resumen") contenido = <PersonasResumen />;
  else if (area.id === "personas" && sub.id === "horarios") contenido = <Horarios />;
  else if (area.id === "personas" && sub.id === "bolsa") contenido = <Bolsa />;
  else if (area.id === "personas" && sub.id === "fichajes") contenido = <Fichajes />;
  else if (area.id === "personas" && sub.id === "documentos") contenido = <Documentos />;
  else if (area.id === "personas" && sub.id === "solicitudes") contenido = <Solicitudes />;
  else if (area.id === "personas" && sub.id === "seguimiento") contenido = <Seguimiento sub={extra} />;
  else if (area.id === "personas" && sub.id === "equipo") contenido = <Equipo user={user} />;
  else if (area.id === "producto" && sub.id === "resumen") contenido = <ProductoResumen />;
  else if (area.id === "producto" && sub.id === "catalogo") contenido = <Catalogo extra={extra} />;
  else if (area.id === "producto" && sub.id === "recepcion") contenido = <Recepcion />;
  else if (area.id === "producto" && sub.id === "revisar") contenido = <ProductosRevisar />;
  else if (area.id === "producto" && sub.id === "app") contenido = <AppTienda />;
  else if (area.id === "producto" && sub.id === "familias") contenido = <Familias />;
  else if (area.id === "producto" && sub.id === "proveedores") contenido = <Proveedores />;
  else if (area.id === "producto" && sub.id === "salud") contenido = <Salud extra={extra} />;
  else if (area.id === "marketing" && sub.id === "resumen") contenido = <MarketingResumen />;
  else if (area.id === "marketing" && sub.id === "clientes") contenido = <MarketingClientes />;
  else if (area.id === "marketing" && sub.id === "captacion") contenido = <MarketingCaptacion />;
  else if (area.id === "marketing" && sub.id === "campanas") contenido = <MarketingCampanas />;
  else if (area.id === "marketing" && sub.id === "reputacion") contenido = <MarketingReputacion />;
  else if (area.id === "plan" && sub.id === "resumen") contenido = <PlanResumen user={user} />;
  else if (area.id === "plan" && sub.id === "proyectos") contenido = <Proyectos user={user} extra={extra} />;
  else if (area.id === "plan" && sub.id === "tareas") contenido = <PlanTareas user={user} />;
  else if (area.id === "plan" && sub.id === "calendario") contenido = <PlanCalendario user={user} />;
  else if (area.id === "tecnologia" && sub.id === "como-pedir") contenido = <TecGuia />;
  else if (area.id === "tecnologia") contenido = <TecSolicitudes key={extra || "lista"} user={user} extra={extra} />;
  else if (area.id === "finanzas" && sub.id === "resumen") contenido = <FinanzasResumen />;
  else if (area.id === "finanzas") {
    const pantalla = {
      resultados: <FinanzasResultados onEditMonth={editarMes} />, caja: <FinanzasCaja />, sobres: <EfectivoSobres />, compras: <FinanzasCompras />,
      bancos: <Bancos />, pagos: <PagosPendientes />, inversiones: <Inversiones />, mantenimiento: <Mantenimiento />,
    }[extra] || <Legado area={area.id} sub={extra} datos={datos} user={user} mesFoco={mesFoco} onEditMonth={editarMes} />;
    contenido = (
      <>
        <div className="barra-sec">
          <Pestanas valor={extra} etiqueta={sub.label} opciones={FIN_PESTANAS[sub.id]} onChange={(t) => ir(`finanzas/${sub.id}/${t}`)} />
        </div>
        {pantalla}
      </>
    );
  }
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
