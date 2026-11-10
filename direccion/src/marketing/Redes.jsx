// Marketing · Redes sociales: lista de outliers (vídeos que funcionan muy por encima de lo normal de su cuenta) para sacar
// formatos e ideas de contenido. Sale del mismo Radar que Producto (función radar-recoger): cada outlier lleva una ficha
// hecha por Claude con el formato, el gancho, por qué funciona y cómo lo adaptaría Recao. Cada outlier se clasifica: por probar, para el futuro, probado o descartado (función radar_redes_clasificar).
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Pestanas, avisar } from "../ui.jsx";
import { num } from "../fmt.js";

const RED_T = { instagram: "Instagram", tiktok: "TikTok" };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const fd = (ts) => (ts ? new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" }) : "–");
const x = (v) => (v == null ? "–" : `${String(Math.round(Number(v) * 10) / 10).replace(".", ",")}×`);
const chip = (t, fondo = "var(--grid)", color = "var(--text)") => <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: fondo, color }}>{t}</span>;

const ESTADOS = [
  { id: "sin", label: "Por clasificar" },
  { id: "probar", label: "Por probar" },
  { id: "futuro", label: "Para el futuro" },
  { id: "probado", label: "Probados" },
  { id: "descartado", label: "Descartados" },
];

export function MarketingRedes() {
  const [posts, setPosts] = useState(null);
  const [busq, setBusq] = useState({});
  const [dias, setDias] = useState("14");
  const [red, setRed] = useState("");
  const [area, setArea] = useState("");
  const [estado, setEstado] = useState("sin");
  const [lim, setLim] = useState(40);
  const [busy, setBusy] = useState(null);
  const cargar = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([
        sb.select("radar_posts", "select=id,red,autor,url,publicado_en,texto,imagen_url,visualizaciones,me_gusta,comentarios,compartidos,guardados,seguidores_autor,ratio_seg,ratio_mediana,busqueda_id,ficha,recogido_en,redes_estado,redes_nota,redes_url_nuestro,redes_por,redes_en&es_outlier=eq.true&order=recogido_en.desc&limit=2000"),
        sb.select("radar_busquedas", "select=id,termino,area"),
      ]);
      setBusq(Object.fromEntries(b.map((v) => [v.id, v]))); setPosts(p);
    } catch (e) { avisar(msg(e), "mal"); setPosts([]); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!posts) return <Cargando />;
  const desde = dias ? Date.now() - Number(dias) * 86400000 : 0;
  // fuera de España no interesa (salvo que alguien ya lo haya clasificado)
  const base = posts.filter((p) => p.redes_estado || !(p.ficha && p.ficha.espana === false)).filter((p) => {
    if (red && p.red !== red) return false;
    if (area && (busq[p.busqueda_id]?.area || "cuentas") !== area) return false;
    return true;
  });
  const enFecha = (p) => !desde || new Date(p.publicado_en || p.recogido_en).getTime() >= desde;
  const deEstado = (id) => base.filter((p) => (p.redes_estado || "sin") === id && (id !== "sin" || enFecha(p)));
  const vis = deEstado(estado).sort((a, b) => (estado !== "sin"
    ? new Date(b.redes_en || 0) - new Date(a.redes_en || 0)
    : (Number(b.ratio_seg ?? b.ratio_mediana) || 0) - (Number(a.ratio_seg ?? a.ratio_mediana) || 0)));
  const clasificar = async (p, nuevo, extra = {}) => {
    setBusy(p.id);
    try {
      const r = await sb.rpc("radar_redes_clasificar", { p_id: p.id, p_estado: nuevo, p_nota: extra.nota ?? null, p_url: extra.url ?? null });
      setPosts((ps) => ps.map((q) => (q.id === p.id ? { ...q, redes_estado: nuevo, redes_por: nuevo ? r?.por || "Dirección" : null, redes_en: nuevo ? new Date().toISOString() : null,
        redes_nota: extra.nota != null ? (extra.nota.trim() || null) : q.redes_nota, redes_url_nuestro: extra.url != null ? (extra.url.trim() || null) : q.redes_url_nuestro } : q)));
    } catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  const probado = (p) => {
    const url = window.prompt("Enlace a nuestro vídeo (opcional)", p.redes_url_nuestro || ""); if (url === null) return;
    const nota = window.prompt("¿Cómo ha ido? (vistas, compartidos… opcional)", p.redes_nota || ""); if (nota === null) return;
    clasificar(p, "probado", { url, nota });
  };
  const anotar = (p) => { const nota = window.prompt("Nota", p.redes_nota || ""); if (nota === null) return; clasificar(p, p.redes_estado, { nota }); };
  const botones = (p) => {
    const b = busy === p.id, e = p.redes_estado || "";
    const btn = (clase, texto, fn) => <button key={texto} className={clase} disabled={b} onClick={fn}>{texto}</button>;
    const out = [];
    if (e === "" || e === "futuro") out.push(btn("btn-p", "Nos interesa probarlo", () => clasificar(p, "probar")));
    if (e === "probar") out.push(btn("btn-p", "Ya lo hemos probado", () => probado(p)));
    if (e === "" || e === "probar") out.push(btn("btn-l", "Para el futuro", () => clasificar(p, "futuro")));
    if (e === "probado") out.push(btn("btn-l", "Editar resultado", () => probado(p)), btn("btn-txt", "Volver a por probar", () => clasificar(p, "probar")));
    if (e && e !== "probado") out.push(btn("btn-txt", "Nota", () => anotar(p)));
    if (e !== "descartado" && e !== "probado") out.push(btn("btn-txt", "Descartar", () => clasificar(p, "descartado")));
    if (e && e !== "probado") out.push(btn("btn-txt", "Sin clasificar", () => clasificar(p, null)));
    return out;
  };
  return (
    <>
      <div className="card">
        <div className="head"><div><h2>Redes sociales · Outliers</h2><p className="sub">Vídeos de TikTok e Instagram que han hecho muchas más visualizaciones que seguidores tiene su cuenta (5× o más) o que su mediana (3× o más). Si a una cuenta pequeña le explota un formato, es copiable. Llegan nuevos cada lunes: clasifícalos para que la lista no crezca sin fin.</p></div></div>
        <div className="fila-campos" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          {estado === "sin" && <label className="campo">Publicados<select value={dias} onChange={(e) => setDias(e.target.value)}><option value="7">Últimos 7 días</option><option value="14">Últimos 14 días</option><option value="30">Últimos 30 días</option><option value="">Todo</option></select></label>}
          <label className="campo">Red<select value={red} onChange={(e) => setRed(e.target.value)}><option value="">Las dos</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></label>
          <label className="campo">Venían de<select value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todo</option><option value="redes">Temas de redes (tiendas, humor…)</option><option value="producto">Temas de producto (dulces, novedades…)</option><option value="cuentas">Cuentas vigiladas</option></select></label>
        </div>
        <Pestanas etiqueta="Clasificación" valor={estado} onChange={(v) => { setEstado(v); setLim(40); }} opciones={ESTADOS.map((s) => ({ id: s.id, label: `${s.label} (${deEstado(s.id).length})` }))} />
      </div>
      <div className="card mt">
        {!vis.length ? <p className="empty">{estado === "sin" ? (posts.length ? "Todo clasificado. Los nuevos llegan el lunes." : "Todavía no hay outliers.") : "Nada en esta lista."}</p> : (
          <>
            <p className="sub">{num(vis.length)} outliers · {estado !== "sin" ? "lo último clasificado primero" : "ordenados por cuántas veces superan a su cuenta"}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {vis.slice(0, lim).map((p) => {
                const f = p.ficha || {};
                return (
                  <div key={p.id} className="card" style={{ display: "flex", gap: 14, flexWrap: "wrap", opacity: p.redes_estado === "descartado" ? 0.7 : 1 }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ width: 104, height: 150, borderRadius: 10, overflow: "hidden", background: "var(--grid)", flex: "0 0 auto", display: "block" }} aria-label={`Abrir el vídeo de @${p.autor}`}>
                      {p.imagen_url && <img src={p.imagen_url} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                    </a>
                    <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {chip(`${x(p.ratio_seg ?? p.ratio_mediana)} ${p.ratio_seg != null ? "sus seguidores" : "su mediana"}`, "rgba(49,112,57,.13)", "#1E4A25")}
                        {f.formato && chip(f.formato, "rgba(241,190,73,.28)", "#6B4A00")}
                        {f.patrocinado && chip("Publicidad", "rgba(178,65,42,.12)", "#8A2E1C")}
                        <small className="pf">{RED_T[p.red]} · <a href={p.url} target="_blank" rel="noopener noreferrer">@{p.autor}</a> · {p.seguidores_autor != null ? `${num(p.seguidores_autor)} seguidores · ` : ""}{num(p.visualizaciones)} vistas{p.compartidos != null ? ` · ${num(p.compartidos)} compartidos` : ""}{p.guardados != null ? ` · ${num(p.guardados)} guardados` : ""} · {fd(p.publicado_en)}</small>
                      </div>
                      {f.gancho ? <p style={{ margin: 0, fontWeight: 700 }}>Gancho: {f.gancho}</p> : <p style={{ margin: 0, fontSize: 13.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.texto || "(sin texto)"}</p>}
                      {f.estructura && <p style={{ margin: 0, fontSize: 14 }}><b>Cómo va:</b> {f.estructura}</p>}
                      {f.por_que_funciona && <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)" }}><b style={{ color: "var(--text)" }}>Por qué funciona:</b> {f.por_que_funciona}</p>}
                      {f.idea_recao && <p style={{ margin: 0, fontSize: 14 }}><b>Idea para Recao:</b> {f.idea_recao}</p>}
                      {f.producto && <small className="pf">Producto: {f.producto}{f.marca ? ` · ${f.marca}` : ""}</small>}
                      {(p.redes_nota || p.redes_url_nuestro) && <p style={{ margin: 0, fontSize: 14, background: "var(--grid)", borderRadius: 8, padding: "6px 10px" }}>{p.redes_estado === "probado" ? <b>Resultado: </b> : <b>Nota: </b>}{p.redes_nota || ""}{p.redes_url_nuestro ? <> {p.redes_nota ? "· " : ""}<a href={p.redes_url_nuestro} target="_blank" rel="noopener noreferrer">Nuestro vídeo</a></> : null}</p>}
                      {p.redes_estado && <small className="pf">{ESTADOS.find((s) => s.id === p.redes_estado)?.label} · {p.redes_por || "—"}, {fd(p.redes_en)}</small>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                        <a className="btn-l" href={p.url} target="_blank" rel="noopener noreferrer">Ver vídeo</a>
                        {botones(p)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {vis.length > lim && <p style={{ textAlign: "center" }}><button className="btn-l" onClick={() => setLim(lim + 40)}>Ver más</button></p>}
          </>
        )}
      </div>
    </>
  );
}
