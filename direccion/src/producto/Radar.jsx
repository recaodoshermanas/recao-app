// Producto · Radar (#141): cuentas y búsquedas vigiladas en Instagram y TikTok, y las publicaciones recogidas cada lunes.
// Solo datos públicos de las cuentas. La recogida la hace la función radar-recoger (Apify); aquí se editan las listas y se ve el resultado.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Pestanas, avisar, hoyStr, lunesDe, masDias } from "../ui.jsx";
import { num } from "../fmt.js";

const TIPOS = [["competencia", "Competencia"], ["obrador", "Obrador de referencia"], ["creador", "Creador"], ["distribuidor", "Distribuidor"], ["medio", "Medio"]];
const TIPO_T = Object.fromEntries(TIPOS);
const RED_T = { instagram: "Instagram", tiktok: "TikTok" };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"error"\s*:\s*"([^"]+)"/.exec(t) || /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const fh = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : "–");
const fd = (ts) => (ts ? new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }) : "–");
const limpia = (u) => u.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i, "").replace(/\/.*$/, "");

export function Radar() {
  const [vista, setVista] = useState("posts");
  return (
    <>
      <div className="card">
        <div className="head"><div><h2>Radar</h2><p className="sub">Lo que publican las cuentas vigiladas (competencia, obradores, creadores…). Se recoge solo cada lunes a las 6:00; solo se guardan datos públicos de las cuentas, nunca los usuarios que comentan.</p></div></div>
        <Pestanas etiqueta="Vista" valor={vista} onChange={setVista} opciones={[{ id: "posts", label: "Publicaciones" }, { id: "cuentas", label: "Cuentas y búsquedas" }, { id: "registro", label: "Registro de recogidas" }]} />
      </div>
      {vista === "posts" && <Posts />}
      {vista === "cuentas" && <Cuentas />}
      {vista === "registro" && <Registro />}
    </>
  );
}

function Posts() {
  const [posts, setPosts] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [fc, setFc] = useState(""); const [ft, setFt] = useState(""); const [fs, setFs] = useState("");
  const [lim, setLim] = useState(60);
  useEffect(() => {
    Promise.all([
      sb.select("radar_posts", "select=id,red,cuenta_id,origen,autor,url,publicado_en,texto,imagen_url,me_gusta,comentarios,visualizaciones,recogido_en&order=publicado_en.desc.nullslast&limit=1000"),
      sb.select("radar_cuentas", "select=id,red,usuario,tipo&order=usuario"),
    ]).then(([p, c]) => { setPosts(p); setCuentas(c); }).catch((e) => { avisar(msg(e), "mal"); setPosts([]); });
  }, []);
  if (!posts) return <Cargando />;
  const porId = Object.fromEntries(cuentas.map((c) => [c.id, c]));
  const semanas = [...new Set(posts.filter((p) => p.publicado_en).map((p) => lunesDe(p.publicado_en.slice(0, 10))))].sort().reverse();
  const vis = posts.filter((p) => {
    if (fc && String(p.cuenta_id) !== fc) return false;
    if (ft && porId[p.cuenta_id]?.tipo !== ft) return false;
    if (fs) { if (!p.publicado_en) return false; const d = p.publicado_en.slice(0, 10); if (d < fs || d > masDias(fs, 6)) return false; }
    return true;
  });
  return (
    <div className="card mt">
      <div className="fila-campos" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <label className="campo">Cuenta<select value={fc} onChange={(e) => setFc(e.target.value)}><option value="">Todas</option>{cuentas.map((c) => <option key={c.id} value={c.id}>@{c.usuario} ({RED_T[c.red]})</option>)}</select></label>
        <label className="campo">Tipo<select value={ft} onChange={(e) => setFt(e.target.value)}><option value="">Todos</option>{TIPOS.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>
        <label className="campo">Semana (publicación)<select value={fs} onChange={(e) => setFs(e.target.value)}><option value="">Todas</option>{semanas.map((s) => <option key={s} value={s}>Semana del {fd(`${s}T12:00:00`)}</option>)}</select></label>
      </div>
      {!vis.length ? <p className="empty">{posts.length ? "Ninguna publicación con esos filtros." : "Aún no se ha recogido nada. Añade cuentas y pulsa «Recoger ahora» en «Cuentas y búsquedas»."}</p> : (
        <>
          <p className="sub">{num(vis.length)} publicaciones</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {vis.slice(0, lim).map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="card" style={{ textDecoration: "none", color: "inherit", padding: 0, overflow: "hidden" }}>
                {p.imagen_url ? <img src={p.imagen_url} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 180, objectFit: "cover", display: "block", background: "var(--line)" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                <div style={{ padding: 12 }}>
                  <small className="pf">{RED_T[p.red]} · {p.origen}{porId[p.cuenta_id]?.tipo ? ` · ${TIPO_T[porId[p.cuenta_id].tipo]}` : ""} · {fd(p.publicado_en)}</small>
                  <p style={{ margin: "6px 0", fontSize: 13.5, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.texto || "(sin texto)"}</p>
                  <small className="pf">{p.visualizaciones != null ? `${num(p.visualizaciones)} vistas · ` : ""}{p.me_gusta != null ? `${num(p.me_gusta)} me gusta · ` : ""}{p.comentarios != null ? `${num(p.comentarios)} comentarios` : ""} — Abrir original →</small>
                </div>
              </a>
            ))}
          </div>
          {vis.length > lim && <p style={{ textAlign: "center" }}><button className="btn-l" onClick={() => setLim(lim + 60)}>Ver más</button></p>}
        </>
      )}
    </div>
  );
}

function Cuentas() {
  const [cu, setCu] = useState(null); const [bu, setBu] = useState([]);
  const [nc, setNc] = useState({ red: "tiktok", usuario: "", tipo: "", nota: "" });
  const [nb, setNb] = useState({ red: "tiktok", termino: "" });
  const [lanzando, setLanzando] = useState(false);
  const cargar = useCallback(() => {
    Promise.all([sb.select("radar_cuentas", "select=*&order=creado_en"), sb.select("radar_busquedas", "select=*&order=creado_en")]).then(([c, b]) => { setCu(c); setBu(b); }).catch((e) => { avisar(msg(e), "mal"); setCu((x) => x || []); });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!cu) return <Cargando />;
  const addC = async () => {
    const u = limpia(nc.usuario); if (!u) { avisar("Escribe el usuario", "mal"); return; }
    try { await sb.insert("radar_cuentas", { red: nc.red, usuario: u, tipo: nc.tipo || null, nota: nc.nota.trim() || null }); setNc({ ...nc, usuario: "", nota: "" }); cargar(); }
    catch (e) { avisar(/duplicate|23505|409/.test(String(e.message)) ? "Esa cuenta ya está en la lista" : msg(e), "mal"); }
  };
  const addB = async () => {
    const t = nb.termino.trim(); if (!t) { avisar("Escribe la palabra o el hashtag", "mal"); return; }
    try { await sb.insert("radar_busquedas", { red: nb.red, termino: t }); setNb({ ...nb, termino: "" }); cargar(); }
    catch (e) { avisar(/duplicate|23505|409/.test(String(e.message)) ? "Esa búsqueda ya está en la lista" : msg(e), "mal"); }
  };
  const upd = async (tabla, id, cambio) => { try { await sb.update(tabla, `id=eq.${id}`, cambio); cargar(); } catch (e) { avisar(msg(e), "mal"); } };
  const quitarB = async (id) => { try { await sb.delete("radar_busquedas", `id=eq.${id}`); cargar(); } catch (e) { avisar("Esa búsqueda ya tiene publicaciones: desactívala en vez de quitarla", "mal"); } };
  const recoger = async () => {
    setLanzando(true);
    try { await sb.fn("radar-recoger", { accion: "manual" }); avisar("Recogida lanzada. Tarda uno o dos minutos: mira el registro."); }
    catch (e) { avisar(msg(e), "mal"); } finally { setLanzando(false); }
  };
  return (
    <>
      <div className="card mt">
        <div className="head"><div><h2>Cuentas vigiladas</h2><p className="sub">Se recogen hasta 12 publicaciones nuevas por cuenta. El criterio: cuentas que enseñen productos virales o atractivos que podamos vender (también contenido de clientes), no tiendas de un solo producto.</p></div>
          <button className="btn-p" disabled={lanzando} onClick={recoger}>{lanzando ? "Lanzando…" : "Recoger ahora"}</button></div>
        <div className="tabla-scroll"><table className="ranking">
          <thead><tr><th>Cuenta</th><th>Tipo</th><th>Nota</th><th>Última recogida</th><th>Activa</th></tr></thead>
          <tbody>{cu.map((c) => (
            <tr key={c.id}>
              <td><b>@{c.usuario}</b><small className="pf">{RED_T[c.red]}</small></td>
              <td><select value={c.tipo || ""} onChange={(e) => upd("radar_cuentas", c.id, { tipo: e.target.value || null })} aria-label="Tipo"><option value="">Sin clasificar</option>{TIPOS.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></td>
              <td><input defaultValue={c.nota || ""} onBlur={(e) => { if ((e.target.value || null) !== (c.nota || null)) upd("radar_cuentas", c.id, { nota: e.target.value.trim() || null }); }} aria-label="Nota" style={{ width: "100%" }} /></td>
              <td>{fh(c.ultima_recogida)}</td>
              <td><input type="checkbox" checked={c.activa} onChange={(e) => upd("radar_cuentas", c.id, { activa: e.target.checked })} aria-label="Activa" /></td>
            </tr>))}</tbody>
        </table></div>
        <h3>Añadir cuenta</h3>
        <div className="fila-campos" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          <label className="campo">Red<select value={nc.red} onChange={(e) => setNc({ ...nc, red: e.target.value })}><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></label>
          <label className="campo">Usuario<input value={nc.usuario} onChange={(e) => setNc({ ...nc, usuario: e.target.value })} placeholder="@usuario" /></label>
          <label className="campo">Tipo<select value={nc.tipo} onChange={(e) => setNc({ ...nc, tipo: e.target.value })}><option value="">Sin clasificar</option>{TIPOS.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>
          <label className="campo">Nota<input value={nc.nota} onChange={(e) => setNc({ ...nc, nota: e.target.value })} /></label>
        </div>
        <button className="btn-p" onClick={addC}>Añadir cuenta</button>
      </div>
      <div className="card mt">
        <h2>Búsquedas</h2>
        <p className="sub">Palabra clave o hashtag (con # para hashtag). Se recogen hasta 30 publicaciones por búsqueda.</p>
        {bu.length > 0 && <div className="tabla-scroll"><table className="ranking"><thead><tr><th>Búsqueda</th><th>Red</th><th>Activa</th><th></th></tr></thead>
          <tbody>{bu.map((b) => <tr key={b.id}><td><b>{b.termino}</b></td><td>{RED_T[b.red]}</td><td><input type="checkbox" checked={b.activa} onChange={(e) => upd("radar_busquedas", b.id, { activa: e.target.checked })} aria-label="Activa" /></td><td><button className="btn-txt" onClick={() => quitarB(b.id)}>Quitar</button></td></tr>)}</tbody></table></div>}
        <div className="fila-campos" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          <label className="campo">Red<select value={nb.red} onChange={(e) => setNb({ ...nb, red: e.target.value })}><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></label>
          <label className="campo">Palabra o hashtag<input value={nb.termino} onChange={(e) => setNb({ ...nb, termino: e.target.value })} placeholder="#roscondereyes" /></label>
        </div>
        <button className="btn-p" onClick={addB}>Añadir búsqueda</button>
      </div>
    </>
  );
}

function Registro() {
  const [r, setR] = useState(null);
  const cargar = useCallback(() => { sb.select("radar_ejecuciones", "select=*&order=id.desc&limit=40").then(async (x) => { setR(x); if (x.some((e) => !e.visto && e.estado !== "en_curso")) { try { await sb.update("radar_ejecuciones", "visto=eq.false&estado=neq.en_curso", { visto: true }); } catch (_) { /* nada */ } } }).catch((e) => { avisar(msg(e), "mal"); setR([]); }); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!r) return <Cargando />;
  const ESTADO = { ok: "Correcta", parcial: "Con fallos", error: "Fallida", en_curso: "En marcha" };
  return (
    <div className="card mt">
      <div className="head"><div><h2>Registro de recogidas</h2><p className="sub">Cada ejecución con los resultados nuevos y el coste estimado en dólares (plan Free de Apify: 5 $ al mes; tope por ejecución en app_config).</p></div><button className="btn-l" onClick={cargar}>Actualizar</button></div>
      {!r.length ? <p className="empty">Todavía no se ha recogido nada.</p> : (
        <div className="tabla-scroll"><table className="ranking">
          <thead><tr><th>Inicio</th><th>Origen</th><th>Estado</th><th className="r">Nuevas</th><th className="r">Leídas</th><th className="r">Coste est.</th><th>Error</th></tr></thead>
          <tbody>{r.map((e) => (
            <tr key={e.id}><td>{fh(e.inicio)}</td><td>{e.origen === "manual" ? "Manual" : "Lunes"}</td>
              <td className={e.estado === "error" || e.estado === "parcial" ? "down" : ""}>{ESTADO[e.estado]}</td>
              <td className="r">{num(e.resultados)}</td><td className="r">{num(e.items_apify)}</td><td className="r">{num(Number(e.coste_estimado), 3)} $</td>
              <td style={{ maxWidth: 360, whiteSpace: "normal" }}><small>{e.error || ""}</small></td></tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// Aviso a dirección en Producto → Resumen cuando una recogida ha fallado (solo dentro del panel)
export function AvisosRadar() {
  const [a, setA] = useState([]);
  useEffect(() => { sb.select("radar_ejecuciones", `select=id,estado,inicio,error&visto=eq.false&estado=in.(error,parcial)&inicio=gte.${masDias(hoyStr(), -21)}&order=id.desc&limit=3`).then(setA).catch(() => {}); }, []);
  if (!a.length) return null;
  return (
    <section className="avisos favisos" aria-label="Fallos del Radar">
      {a.map((x) => <a key={x.id} className="aviso" href="#/producto/radar"><b>Radar</b><span>La recogida del {fh(x.inicio)} {x.estado === "error" ? "ha fallado" : "ha tenido fallos"}: {(x.error || "").slice(0, 140)}</span><i aria-hidden="true">→</i></a>)}
    </section>
  );
}
