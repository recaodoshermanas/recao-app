// Producto · Radar: busca productos virales en TikTok e Instagram para traerlos a la tienda.
// Cada lunes la función radar-recoger (Apify) recoge lo publicado en las búsquedas por tema y en las cuentas vigiladas,
// calcula los outliers (visualizaciones ≥ 5× seguidores o ≥ 3× la mediana de la cuenta) y hace una ficha de cada uno con Claude.
// Después el agente de producto (tarea programada de Claude) junta las fichas por producto, las cruza con Epos y deja
// las oportunidades en la bandeja. Aquí se decide: pasar al Lab, dejar en observación o descartar.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Pestanas, avisar, hoyStr, lunesDe, masDias } from "../ui.jsx";
import { num } from "../fmt.js";

const TIPOS = [["competencia", "Competencia"], ["obrador", "Obrador de referencia"], ["creador", "Creador"], ["distribuidor", "Distribuidor"], ["medio", "Medio"]];
const TIPO_T = Object.fromEntries(TIPOS);
const RED_T = { instagram: "Instagram", tiktok: "TikTok" };
const AREA_T = { producto: "Producto", redes: "Redes", ambas: "Las dos" };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"error"\s*:\s*"([^"]+)"/.exec(t) || /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const fh = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : "–");
const fd = (ts) => (ts ? new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }) : "–");
const limpia = (u) => u.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/i, "").replace(/\/.*$/, "");
const x = (v) => (v == null ? "–" : `${String(Math.round(Number(v) * 10) / 10).replace(".", ",")}×`);
const chip = (t, fondo = "var(--grid)", color = "var(--text)") => <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: fondo, color }}>{t}</span>;
const VERDE = ["rgba(49,112,57,.13)", "#1E4A25"], AMBAR = ["rgba(241,190,73,.28)", "#6B4A00"], ROJO = ["rgba(178,65,42,.12)", "#8A2E1C"], AZUL = ["rgba(35,54,94,.10)", "#23365E"];

export function Radar() {
  const [vista, setVista] = useState("oportunidades");
  return (
    <>
      <div className="card">
        <div className="head"><div><h2>Radar de productos virales</h2><p className="sub">Busca cada lunes en TikTok e Instagram los vídeos que funcionan muy por encima de lo normal de su cuenta (outliers) y saca de ellos productos que podríamos traer a la tienda antes que nadie en Dos Hermanas. Solo datos públicos de las cuentas.</p></div></div>
        <Pestanas etiqueta="Vista" valor={vista} onChange={setVista} opciones={[{ id: "oportunidades", label: "Oportunidades" }, { id: "posts", label: "Publicaciones" }, { id: "cuentas", label: "Temas y cuentas" }, { id: "registro", label: "Registro" }]} />
      </div>
      <Estado />
      {vista === "oportunidades" && <Oportunidades />}
      {vista === "posts" && <Posts />}
      {vista === "cuentas" && <Cuentas />}
      {vista === "registro" && <Registro />}
    </>
  );
}

function Estado() {
  const [e, setE] = useState(null);
  useEffect(() => { sb.select("radar_ejecuciones", "select=id,estado,fase,inicio,fin,items_apify,resultados,coste_estimado,detalle&order=id.desc&limit=1").then((r) => setE(r[0] || null)).catch(() => {}); }, []);
  if (!e) return null;
  const calc = (e.detalle || []).find((d) => d && d.calculo)?.calculo;
  return (
    <div className="card mt" style={{ background: "var(--tinta, #1E272E)", color: "#FAF6EC" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
        <div><small style={{ color: "#F1BE49", fontWeight: 800, letterSpacing: 1, textTransform: "uppercase" }}>{e.estado === "en_curso" ? `Recogida en marcha · ${e.fase === "fichas" ? "haciendo las fichas" : e.fase === "perfiles" ? "midiendo cuentas" : "buscando"}` : "Última pasada"}</small>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{fh(e.inicio)} · próxima: el lunes a las 6:00 (el agente propone a las 8:30)</div></div>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
          <div><b style={{ fontSize: 22 }}>{num(e.items_apify || 0)}</b><br /><small style={{ color: "#C9C4B6" }}>publicaciones leídas</small></div>
          {calc && <div><b style={{ fontSize: 22 }}>{num(calc.outliers_semana)}</b><br /><small style={{ color: "#C9C4B6" }}>outliers</small></div>}
          {calc && <div><b style={{ fontSize: 22 }}>{num(calc.cuentas_nuevas)}</b><br /><small style={{ color: "#C9C4B6" }}>cuentas descubiertas</small></div>}
          <div><b style={{ fontSize: 22 }}>{num(Number(e.coste_estimado) || 0, 2)} $</b><br /><small style={{ color: "#C9C4B6" }}>coste Apify (est.)</small></div>
        </div>
      </div>
    </div>
  );
}

// ---------- Oportunidades (bandeja) ----------
function Oportunidades() {
  const [estado, setEstado] = useState("bandeja");
  const [ops, setOps] = useState(null);
  const [posts, setPosts] = useState({});
  const [busy, setBusy] = useState(null);
  const cargar = useCallback(async () => {
    try {
      const o = await sb.select("radar_oportunidades", "select=*&order=actualizado_en.desc&limit=300");
      const ids = [...new Set(o.flatMap((r) => r.post_ids || []))];
      const ps = ids.length ? await sb.select("radar_posts", `select=id,red,url,autor,imagen_url,visualizaciones,seguidores_autor,ratio_seg,publicado_en,texto&id=in.(${ids.join(",")})`) : [];
      setPosts(Object.fromEntries(ps.map((p) => [p.id, p]))); setOps(o);
    } catch (e) { avisar(msg(e), "mal"); setOps([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!ops) return <Cargando />;
  const cuenta = (s) => ops.filter((o) => o.estado === s).length;
  const lista = ops.filter((o) => o.estado === estado).sort((a, b) => (Number(b.mejor_ratio) || 0) - (Number(a.mejor_ratio) || 0));
  const decidir = async (o, accion) => {
    let motivo = null;
    if (accion === "descartada") { motivo = window.prompt(`¿Por qué descartas «${o.nombre}»? (ayuda al agente a aprender)`, ""); if (motivo === null) return; }
    setBusy(o.id);
    try { const r = await sb.rpc("radar_oportunidad_decidir", { p_id: o.id, p_accion: accion, p_motivo: motivo }); avisar(accion === "lab" ? `«${o.nombre}» está en el Lab como idea (prueba ${r?.lab_prueba_id})` : "Hecho"); await cargar(); }
    catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  return (
    <div className="card mt">
      <Pestanas etiqueta="Estado" valor={estado} onChange={setEstado} opciones={[{ id: "bandeja", label: `Para decidir (${cuenta("bandeja")})` }, { id: "observacion", label: `En observación (${cuenta("observacion")})` }, { id: "lab", label: `Pasadas al Lab (${cuenta("lab")})` }, { id: "descartada", label: `Descartadas (${cuenta("descartada")})` }]} />
      {!lista.length ? <p className="empty">{estado === "bandeja" ? "No hay oportunidades pendientes. El agente deja las nuevas cada lunes por la mañana." : "Nada en esta lista."}</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
          {lista.map((o) => {
            const vids = (o.post_ids || []).map((id) => posts[id]).filter(Boolean).sort((a, b) => (Number(b.ratio_seg) || 0) - (Number(a.ratio_seg) || 0));
            const top = vids[0];
            const tend = o.tendencia === "subiendo" ? VERDE : o.tendencia === "agotandose" ? ROJO : AMBAR;
            return (
              <div key={o.id} className="card" style={{ display: "flex", gap: 16, flexWrap: "wrap", border: o.estado === "observacion" ? "1.5px dashed var(--line)" : undefined }}>
                <a href={top?.url} target="_blank" rel="noopener noreferrer" style={{ width: 120, height: 170, borderRadius: 12, overflow: "hidden", background: "var(--grid)", flex: "0 0 auto", display: "block" }} aria-label={`Ver el vídeo de ${o.nombre}`}>
                  {top?.imagen_url && <img src={top.imagen_url} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                </a>
                <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0 }}>{o.nombre}{o.marca ? <small className="pf"> · {o.marca}</small> : null}</h3>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{o.tipo === "fabricar" ? chip("Hay que fabricarlo", ...AMBAR) : chip("Se compra a proveedor", ...VERDE)}{o.temporada && chip("Temporada", ...AZUL)}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
                    <div style={{ background: "var(--grid)", borderRadius: 10, padding: 10 }}><b style={{ fontSize: 19, color: "var(--up)" }}>{x(o.mejor_ratio)}</b><br /><small className="pf">mejor vídeo vs seguidores</small></div>
                    <div style={{ background: "var(--grid)", borderRadius: 10, padding: 10 }}><b style={{ fontSize: 19 }}>{o.n_cuentas ?? "–"}</b><br /><small className="pf">cuentas · {o.n_videos ?? vids.length} vídeos</small></div>
                    <div style={{ background: "var(--grid)", borderRadius: 10, padding: 10 }}><b style={{ fontSize: 19 }}>{fd(o.primera_vez)}</b><br /><small className="pf">primera vez visto</small></div>
                    <div style={{ background: tend[0], borderRadius: 10, padding: 10 }}><b style={{ fontSize: 19, color: tend[1] }}>{o.tendencia === "agotandose" ? "Agotándose" : o.tendencia === "subiendo" ? "Subiendo" : "Estable"}</b><br /><small className="pf">tendencia</small></div>
                  </div>
                  <p style={{ margin: 0 }}><b>¿Lo vendemos?</b> {o.en_tienda === "si" ? "Sí" : o.en_tienda === "parecido" ? "Algo parecido" : "No"}{o.en_tienda_nota ? `. ${o.en_tienda_nota}` : "."}{o.proveedor_sugerido ? <> <b>Proveedor posible:</b> {o.proveedor_sugerido}.</> : null}{o.precio_visto ? <> <b>Precio visto:</b> {o.precio_visto}.</> : null}</p>
                  {o.demanda && <p style={{ margin: 0 }}><b>Demanda en comentarios:</b> {o.demanda}</p>}
                  {o.por_que && <p style={{ margin: 0, color: "var(--text-2)" }}><b style={{ color: "var(--text)" }}>Por qué lo propone:</b> {o.por_que}</p>}
                  {o.motivo && o.estado !== "bandeja" && <small className="pf">{o.estado === "descartada" ? "Motivo" : "Nota"}: {o.motivo}{o.decidido_por ? ` · ${o.decidido_por}, ${fd(o.decidido_en)}` : ""}</small>}
                  {vids.length > 0 && <small className="pf">Vídeos: {vids.slice(0, 6).map((v, i) => <span key={v.id}>{i ? " · " : ""}<a href={v.url} target="_blank" rel="noopener noreferrer">@{v.autor} ({num(v.visualizaciones)}, {x(v.ratio_seg)})</a></span>)}</small>}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {o.estado !== "lab" && <button className="btn-p" disabled={busy === o.id} onClick={() => decidir(o, "lab")}>Pasar al Lab</button>}
                    {o.estado === "lab" && <a className="btn-l" href="#/producto/lab">Ver en el Lab</a>}
                    {o.estado === "bandeja" && <button className="btn-l" disabled={busy === o.id} onClick={() => decidir(o, "observacion")}>Dejar en observación</button>}
                    {o.estado !== "bandeja" && o.estado !== "lab" && <button className="btn-l" disabled={busy === o.id} onClick={() => decidir(o, "bandeja")}>Volver a la bandeja</button>}
                    {o.estado !== "descartada" && o.estado !== "lab" && <button className="btn-txt" disabled={busy === o.id} onClick={() => decidir(o, "descartada")}>Descartar</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- Publicaciones ----------
function Posts() {
  const [posts, setPosts] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [fc, setFc] = useState(""); const [ft, setFt] = useState(""); const [fs, setFs] = useState(""); const [solo, setSolo] = useState(true);
  const [lim, setLim] = useState(60);
  useEffect(() => {
    Promise.all([
      sb.select("radar_posts", "select=id,red,cuenta_id,origen,autor,url,publicado_en,texto,imagen_url,me_gusta,comentarios,visualizaciones,seguidores_autor,ratio_seg,ratio_mediana,es_outlier,ficha&order=publicado_en.desc.nullslast&limit=1500"),
      sb.select("radar_cuentas", "select=id,red,usuario,tipo&order=usuario"),
    ]).then(([p, c]) => { setPosts(p); setCuentas(c); }).catch((e) => { avisar(msg(e), "mal"); setPosts([]); });
  }, []);
  if (!posts) return <Cargando />;
  const porId = Object.fromEntries(cuentas.map((c) => [c.id, c]));
  const semanas = [...new Set(posts.filter((p) => p.publicado_en).map((p) => lunesDe(p.publicado_en.slice(0, 10))))].sort().reverse();
  const vis = posts.filter((p) => {
    if (solo && !p.es_outlier) return false;
    if (fc && String(p.cuenta_id) !== fc) return false;
    if (ft && porId[p.cuenta_id]?.tipo !== ft) return false;
    if (fs) { if (!p.publicado_en) return false; const d = p.publicado_en.slice(0, 10); if (d < fs || d > masDias(fs, 6)) return false; }
    return true;
  }).sort((a, b) => (solo ? (Number(b.ratio_seg) || 0) - (Number(a.ratio_seg) || 0) : 0));
  return (
    <div className="card mt">
      <div className="fila-campos" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <label className="campo">Mostrar<select value={solo ? "1" : ""} onChange={(e) => setSolo(!!e.target.value)}><option value="1">Solo outliers</option><option value="">Todo lo recogido</option></select></label>
        <label className="campo">Cuenta<select value={fc} onChange={(e) => setFc(e.target.value)}><option value="">Todas</option>{cuentas.map((c) => <option key={c.id} value={c.id}>@{c.usuario} ({RED_T[c.red]})</option>)}</select></label>
        <label className="campo">Tipo<select value={ft} onChange={(e) => setFt(e.target.value)}><option value="">Todos</option>{TIPOS.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>
        <label className="campo">Semana (publicación)<select value={fs} onChange={(e) => setFs(e.target.value)}><option value="">Todas</option>{semanas.map((s) => <option key={s} value={s}>Semana del {fd(`${s}T12:00:00`)}</option>)}</select></label>
      </div>
      {!vis.length ? <p className="empty">{posts.length ? "Ninguna publicación con esos filtros." : "Aún no se ha recogido nada."}</p> : (
        <>
          <p className="sub">{num(vis.length)} publicaciones{solo ? " · ordenadas por cuántas veces superan a sus seguidores" : ""}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {vis.slice(0, lim).map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" className="card" style={{ textDecoration: "none", color: "inherit", padding: 0, overflow: "hidden" }}>
                {p.imagen_url ? <img src={p.imagen_url} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: 180, objectFit: "cover", display: "block", background: "var(--line)" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
                <div style={{ padding: 12 }}>
                  <small className="pf">{RED_T[p.red]} · @{p.autor} · {fd(p.publicado_en)}</small>
                  {p.es_outlier && <div style={{ margin: "6px 0" }}>{chip(`${x(p.ratio_seg ?? p.ratio_mediana)} ${p.ratio_seg != null ? "sus seguidores" : "su mediana"}`, ...VERDE)}</div>}
                  {p.ficha?.producto && <p style={{ margin: "6px 0", fontWeight: 700 }}>{p.ficha.producto}{p.ficha.marca ? ` · ${p.ficha.marca}` : ""}</p>}
                  <p style={{ margin: "6px 0", fontSize: 13.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.texto || "(sin texto)"}</p>
                  <small className="pf">{p.visualizaciones != null ? `${num(p.visualizaciones)} vistas` : ""}{p.seguidores_autor != null ? ` · ${num(p.seguidores_autor)} seguidores` : ""} — Abrir →</small>
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

// ---------- Temas y cuentas ----------
function Cuentas() {
  const [cu, setCu] = useState(null); const [bu, setBu] = useState([]);
  const [nc, setNc] = useState({ red: "tiktok", usuario: "", tipo: "", nota: "" });
  const [nb, setNb] = useState({ red: "tiktok", termino: "", area: "producto" });
  const [verDesc, setVerDesc] = useState(false);
  const [lanzando, setLanzando] = useState(false);
  const cargar = useCallback(() => {
    Promise.all([sb.select("radar_cuentas", "select=*&order=outliers_total.desc,creado_en"), sb.select("radar_busquedas", "select=*&order=activa.desc,outliers_total.desc,creado_en")]).then(([c, b]) => { setCu(c); setBu(b); }).catch((e) => { avisar(msg(e), "mal"); setCu((v) => v || []); });
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!cu) return <Cargando />;
  const addC = async () => {
    const u = limpia(nc.usuario); if (!u) { avisar("Escribe el usuario", "mal"); return; }
    try { await sb.insert("radar_cuentas", { red: nc.red, usuario: u, tipo: nc.tipo || null, nota: nc.nota.trim() || null, origen: "manual" }); setNc({ ...nc, usuario: "", nota: "" }); cargar(); }
    catch (e) { avisar(/duplicate|23505|409/.test(String(e.message)) ? "Esa cuenta ya está en la lista" : msg(e), "mal"); }
  };
  const addB = async () => {
    const t = nb.termino.trim(); if (!t) { avisar("Escribe la palabra o el hashtag", "mal"); return; }
    try { await sb.insert("radar_busquedas", { red: nb.red, termino: t, area: nb.area, origen: "manual" }); setNb({ ...nb, termino: "" }); cargar(); }
    catch (e) { avisar(/duplicate|23505|409/.test(String(e.message)) ? "Esa búsqueda ya está en la lista" : msg(e), "mal"); }
  };
  const upd = async (tabla, id, cambio) => { try { await sb.update(tabla, `id=eq.${id}`, cambio); cargar(); } catch (e) { avisar(msg(e), "mal"); } };
  const recoger = async () => {
    setLanzando(true);
    try { await sb.fn("radar-recoger", { accion: "manual" }); avisar("Recogida lanzada. Tarda entre 10 y 30 minutos: mira el registro."); }
    catch (e) { avisar(msg(e), "mal"); } finally { setLanzando(false); }
  };
  const fijas = cu.filter((c) => c.origen !== "agente"), desc = cu.filter((c) => c.origen === "agente");
  const filaC = (c) => (
    <tr key={c.id}>
      <td><b>@{c.usuario}</b><small className="pf">{RED_T[c.red]}{c.anadida_por ? ` · ${c.anadida_por}` : ""}</small></td>
      <td className="r">{c.seguidores != null ? num(c.seguidores) : "–"}</td>
      <td className="r">{c.mediana_vis != null ? num(Math.round(c.mediana_vis)) : "–"}</td>
      <td className="r">{num(c.outliers_total || 0)}{c.ultimo_outlier ? <small className="pf">último {fd(c.ultimo_outlier)}</small> : null}</td>
      <td><select value={c.tipo || ""} onChange={(e) => upd("radar_cuentas", c.id, { tipo: e.target.value || null })} aria-label="Tipo"><option value="">Sin clasificar</option>{TIPOS.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></td>
      <td style={{ maxWidth: 280, whiteSpace: "normal" }}><small>{c.nota || ""}</small></td>
      <td><input type="checkbox" checked={c.activa} onChange={(e) => upd("radar_cuentas", c.id, { activa: e.target.checked })} aria-label="Activa" /></td>
      <td>{c.origen === "agente" && <button className="btn-txt" onClick={() => upd("radar_cuentas", c.id, { origen: "manual", activa: true })}>Fijar</button>}</td>
    </tr>);
  return (
    <>
      <div className="card mt">
        <div className="head"><div><h2>Temas que busca</h2><p className="sub">Es el prospecting: buscando por tema aparecen cuentas que no conocemos. El agente añade temas nuevos (de los hashtags de los outliers) y desactiva los que pasan 3 semanas sin dar nada. Los que añadís vosotros se quedan.</p></div>
          <button className="btn-p" disabled={lanzando} onClick={recoger}>{lanzando ? "Lanzando…" : "Recoger ahora"}</button></div>
        <div className="tabla-scroll"><table className="ranking"><thead><tr><th>Tema</th><th>Red</th><th>Para</th><th>Quién</th><th className="r">Outliers</th><th>Activa</th></tr></thead>
          <tbody>{bu.map((b) => <tr key={b.id}><td><b>{b.termino}</b>{b.nota ? <small className="pf">{b.nota}</small> : null}</td><td>{RED_T[b.red]}</td>
            <td><select value={b.area} onChange={(e) => upd("radar_busquedas", b.id, { area: e.target.value })} aria-label="Para qué área">{Object.entries(AREA_T).map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></td>
            <td>{b.origen === "agente" ? "Agente" : b.anadida_por || "—"}</td><td className="r">{num(b.outliers_total || 0)}</td>
            <td><input type="checkbox" checked={b.activa} onChange={(e) => upd("radar_busquedas", b.id, { activa: e.target.checked, retirada_en: e.target.checked ? null : new Date().toISOString() })} aria-label="Activa" /></td></tr>)}</tbody></table></div>
        <div className="fila-campos" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          <label className="campo">Red<select value={nb.red} onChange={(e) => setNb({ ...nb, red: e.target.value })}><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></label>
          <label className="campo">Palabra o hashtag<input value={nb.termino} onChange={(e) => setNb({ ...nb, termino: e.target.value })} placeholder="dulces virales o #roscon" /></label>
          <label className="campo">Para<select value={nb.area} onChange={(e) => setNb({ ...nb, area: e.target.value })}>{Object.entries(AREA_T).map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>
        </div>
        <button className="btn-p" onClick={addB}>Añadir tema</button>
      </div>
      <div className="card mt">
        <h2>Cuentas fijadas por vosotros</h2>
        <p className="sub">Se revisan cada lunes (hasta 12 publicaciones nuevas) y no se retiran solas.</p>
        <div className="tabla-scroll"><table className="ranking">
          <thead><tr><th>Cuenta</th><th className="r">Seguidores</th><th className="r">Mediana</th><th className="r">Outliers</th><th>Tipo</th><th>Nota</th><th>Activa</th><th></th></tr></thead>
          <tbody>{fijas.map(filaC)}</tbody></table></div>
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
        <div className="head"><div><h2>Descubiertas por el agente <small className="pf">· {desc.filter((c) => c.activa).length} vigiladas</small></h2><p className="sub">Entran solas cuando dan un outlier y dejan de vigilarse tras 4 semanas sin ninguno. «Fijar» la pasa a vuestra lista.</p></div>
          <button className="btn-l" onClick={() => setVerDesc(!verDesc)}>{verDesc ? "Ocultar" : `Ver las ${desc.length}`}</button></div>
        {verDesc && <div className="tabla-scroll"><table className="ranking">
          <thead><tr><th>Cuenta</th><th className="r">Seguidores</th><th className="r">Mediana</th><th className="r">Outliers</th><th>Tipo</th><th>Nota</th><th>Activa</th><th></th></tr></thead>
          <tbody>{desc.map(filaC)}</tbody></table></div>}
      </div>
    </>
  );
}

// ---------- Registro ----------
function Registro() {
  const [r, setR] = useState(null);
  const cargar = useCallback(() => { sb.select("radar_ejecuciones", "select=id,origen,estado,fase,inicio,fin,resultados,items_apify,coste_estimado,error,visto&order=id.desc&limit=40").then(async (v) => { setR(v); if (v.some((e) => !e.visto && e.estado !== "en_curso")) { try { await sb.update("radar_ejecuciones", "visto=eq.false&estado=neq.en_curso", { visto: true }); } catch (_) { /* nada */ } } }).catch((e) => { avisar(msg(e), "mal"); setR([]); }); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!r) return <Cargando />;
  const ESTADO = { ok: "Correcta", parcial: "Con fallos", error: "Fallida", en_curso: "En marcha" };
  return (
    <div className="card mt">
      <div className="head"><div><h2>Registro de recogidas</h2><p className="sub">Cada ejecución con lo leído, lo nuevo y el coste estimado en dólares de Apify (tope por ejecución en app_config: radar_max_resultados).</p></div><button className="btn-l" onClick={cargar}>Actualizar</button></div>
      {!r.length ? <p className="empty">Todavía no se ha recogido nada.</p> : (
        <div className="tabla-scroll"><table className="ranking">
          <thead><tr><th>Inicio</th><th>Origen</th><th>Estado</th><th className="r">Nuevas</th><th className="r">Leídas</th><th className="r">Coste est.</th><th>Error</th></tr></thead>
          <tbody>{r.map((e) => (
            <tr key={e.id}><td>{fh(e.inicio)}</td><td>{e.origen === "manual" ? "Manual" : "Lunes"}</td>
              <td className={e.estado === "error" || e.estado === "parcial" ? "down" : ""}>{ESTADO[e.estado]}{e.estado === "en_curso" && e.fase ? ` (${e.fase})` : ""}</td>
              <td className="r">{num(e.resultados)}</td><td className="r">{num(e.items_apify)}</td><td className="r">{num(Number(e.coste_estimado), 3)} $</td>
              <td style={{ maxWidth: 360, whiteSpace: "normal" }}><small>{e.error || ""}</small></td></tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// Aviso a dirección en Producto → Resumen: recogida fallida u oportunidades nuevas en la bandeja
export function AvisosRadar() {
  const [a, setA] = useState([]);
  const [n, setN] = useState(0);
  useEffect(() => {
    sb.select("radar_ejecuciones", `select=id,estado,inicio,error&visto=eq.false&estado=in.(error,parcial)&inicio=gte.${masDias(hoyStr(), -21)}&order=id.desc&limit=3`).then(setA).catch(() => {});
    sb.select("radar_oportunidades", "select=id&estado=eq.bandeja").then((r) => setN(r.length)).catch(() => {});
  }, []);
  if (!a.length && !n) return null;
  return (
    <section className="avisos favisos" aria-label="Radar">
      {n > 0 && <a className="aviso" href="#/producto/radar"><b>Radar</b><span>{n} {n === 1 ? "producto viral espera" : "productos virales esperan"} tu decisión en la bandeja</span><i aria-hidden="true">→</i></a>}
      {a.map((v) => <a key={v.id} className="aviso" href="#/producto/radar"><b>Radar</b><span>La recogida del {fh(v.inicio)} {v.estado === "error" ? "ha fallado" : "ha tenido fallos"}: {(v.error || "").slice(0, 140)}</span><i aria-hidden="true">→</i></a>)}
    </section>
  );
}
