import { renderPulso, drawCharts } from "./pulso.js";
import { initTips } from "./charts.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const app = document.getElementById("app");
// el icono "R" de Recao que ya publica la app
const LOGO = "https://app.elrecao.com/apple-touch-icon.png";
const logoTag = (alt = "") => `<img src="${LOGO}" alt="${alt}" />`;
const AREAS = [
  { id: "pulso", label: "Pulso" },
  { id: "producto", label: "Producto", soon: true },
  { id: "personas", label: "Personas", soon: true },
  { id: "finanzas", label: "Finanzas", soon: true },
  { id: "clientes", label: "Clientes", soon: true },
  { id: "plan", label: "Plan", soon: true },
];
const REFRESCO_MS = 2 * 60 * 1000;
let data = null, timer = null, resizeT = null, tipsOn = false;

function shell(user) {
  app.innerHTML = `
  <div class="wrap">
    <header class="top">
      <a class="brand" href="./" aria-label="Recao Dirección, inicio">${logoTag()}<b>Recao</b><span>Dirección</span></a>
      <nav class="nav" aria-label="Áreas">
        ${AREAS.map((a) => `<button ${a.id === "pulso" ? 'aria-current="page"' : ""} ${a.soon ? 'disabled title="En construcción"' : ""}>${a.label}${a.soon ? "<small>pronto</small>" : ""}</button>`).join("")}
      </nav>
      <div class="user">${user ? `<span>${user.nombre || ""}</span><button id="salir">Salir</button>` : ""}</div>
    </header>
    ${window.__RECAO_DEMO__ ? `<p class="demo-note">Vista previa con una foto fija de los datos de hoy a las ${String(window.__RECAO_DEMO__.ahora).slice(11, 16)}. La versión real se actualiza sola y pide login de dirección.</p>` : ""}
    <main id="main"><div class="state">Cargando…</div></main>
  </div>`;
  if (!tipsOn) { initTips(app); tipsOn = true; }
}

window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => data && drawCharts(document.getElementById("main"), data), 120);
});

function pintar(d) {
  data = { ...d, __logo: LOGO };
  renderPulso(document.getElementById("main"), data);
}

// ---------- sesión de Supabase (mismas cuentas que la app), sin librerías ----------
const KEY = "recao-direccion-sesion";
const leer = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const guardar = (s) => { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } };
let sesion = leer();

async function auth(grant, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in - 60) * 1000, user_id: j.user?.id };
}
async function token() {
  if (!sesion) return null;
  if (Date.now() > sesion.expires_at) { sesion = await auth("refresh_token", { refresh_token: sesion.refresh_token }); guardar(sesion); }
  return sesion?.access_token || null;
}
async function api(path, opts = {}) {
  const t = await token(); if (!t) throw Object.assign(new Error("sin sesión"), { status: 401 });
  const r = await fetch(`${SUPABASE_URL}${path}`, { ...opts, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(opts.headers || {}) } });
  if (!r.ok) throw Object.assign(new Error((await r.text()).slice(0, 200)), { status: r.status });
  return r.json();
}
async function salir() {
  try { const t = sesion?.access_token; if (t) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}` } }); } catch { /* da igual */ }
  sesion = null; guardar(null); login();
}

async function cargar() {
  try { pintar(await api("/rest/v1/rpc/dash_pulso", { method: "POST", body: "{}" })); }
  catch (e) {
    if (e.status === 401) return salir();
    const main = document.getElementById("main");
    if (main && !data) main.innerHTML = `<div class="state">No se han podido cargar los datos. Recarga la página en un momento.</div>`;
  }
}

function login(msg = "") {
  clearInterval(timer); data = null;
  app.innerHTML = `
  <div class="login">
    <form id="f">
      ${logoTag("Recao")}
      <h1>Dirección</h1>
      <p>Entra con tu cuenta de la app de Recao.</p>
      <label>Email<input name="email" type="email" autocomplete="username" required /></label>
      <label>Contraseña<input name="pass" type="password" autocomplete="current-password" required /></label>
      <div class="err" role="alert">${msg}</div>
      <button type="submit">Entrar</button>
    </form>
  </div>`;
  document.getElementById("f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Entrando…";
    sesion = await auth("password", { email: String(f.get("email")).trim().toLowerCase(), password: String(f.get("pass")) });
    guardar(sesion);
    if (!sesion) return login("Email o contraseña incorrectos.");
    arrancar();
  });
}

async function arrancar() {
  if (!sesion) return login();
  let u;
  try { u = (await api(`/rest/v1/usuarios?select=id,nombre,rol,activo&auth_id=eq.${sesion.user_id}&limit=1`))[0]; }
  catch { sesion = null; guardar(null); return login(); }
  if (!u || !u.activo || u.rol !== "admin") { sesion = null; guardar(null); return login("Esta zona es solo para dirección."); }
  shell(u);
  document.getElementById("salir").addEventListener("click", salir);
  await cargar();
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) cargar(); }, REFRESCO_MS);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && data && sesion) cargar(); });

// Modo vista previa: la página trae una foto fija de los datos y no pide login
if (window.__RECAO_DEMO__) { shell(null); pintar(window.__RECAO_DEMO__); }
else arrancar();
