// Personas · Equipo → Formación (#79): vídeos de formación para las eventuales y seguimiento de quién los ha visto.
import { useCallback, useEffect, useState } from "react";
import { sb, supabase } from "../../../src/lib/supabase.js";
import { duracionTxt } from "../../../src/lib/formacion.js";
import { Panel, avisar, fechaCorta, fechaDia, Cargando } from "../ui.jsx";

const lineaEstado = (p) => {
  if (p.rojo) return { txt: "Lleva más de 21 días con un vídeo pendiente", rojo: true };
  if (!p.total) return { txt: "Sin vídeos todavía" };
  if (p.completos === p.total) return { txt: "Al día" };
  if (!p.completos && !p.medias) return { txt: "No ha empezado" };
  return { txt: `Le faltan ${p.total - p.completos}${p.medias ? ` · ${p.medias} a medias` : ""}` };
};

export function Formacion({ inicial }) {
  const [d, setD] = useState(null);
  const [portadas, setPortadas] = useState({});
  const [nuevo, setNuevo] = useState(false);
  const [editar, setEditar] = useState(null);
  const [persona, setPersona] = useState(inicial || null);
  const cargar = useCallback(async () => {
    try {
      setD(await sb.rpc("formacion_admin_resumen"));
      sb.fn("formacion", { accion: "portadas" }).then((r) => setPortadas(r.portadas || {})).catch(() => {});
    } catch (e) { avisar("No se ha podido cargar la formación", "mal"); setD((x) => x || { videos: [], personas: [] }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return <Cargando />;

  const videos = d.videos || [];
  const personas = d.personas || [];
  const alDia = personas.filter((p) => p.total > 0 && p.completos === p.total).length;
  const rojas = personas.filter((p) => p.rojo);
  const retirar = async (v) => {
    if (!window.confirm(`¿Retirar «${v.titulo}»? Dejará de verse y de contar para todas.`)) return;
    try { await sb.rpc("formacion_admin_retirar", { p_id: v.id }); avisar("Vídeo retirado"); cargar(); }
    catch (e) { avisar("No se ha podido retirar", "mal"); }
  };

  return (
    <>
      <div className="card mt">
        <div className="head">
          <div>
            <h2>Formación en vídeo</h2>
            <p className="sub">{videos.length} {videos.length === 1 ? "vídeo publicado" : "vídeos publicados"}{videos.length ? ` · ${alDia} de ${personas.length} ${personas.length === 1 ? "persona al día" : "personas al día"}` : ""}. Solo para eventuales con cuenta; cada una ve únicamente el suyo.</p>
          </div>
          <button className="btn-p" onClick={() => setNuevo(true)}>+ Vídeo</button>
        </div>
        {rojas.length > 0 && (
          <div role="alert" style={{ background: "#FBEAE7", color: "#8A2A1F", borderRadius: 12, padding: "10px 14px", fontWeight: 700, fontSize: 13.5, margin: "4px 0 12px" }}>
            {rojas.length === 1 ? "1 persona lleva" : `${rojas.length} personas llevan`} más de 21 días sin ver un vídeo: {rojas.map((p) => p.nombre).join(", ")}.
          </div>
        )}
        {!videos.length ? <p className="empty">Todavía no hay vídeos. Pulsa «+ Vídeo» para publicar el primero.</p> : (
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>#</th><th>Vídeo</th><th>Duración</th><th>Publicado</th><th>Completos</th><th></th></tr></thead>
              <tbody>
                {videos.map((v, i) => (
                  <tr key={v.id}>
                    <td>{i + 1}</td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 64, height: 40, borderRadius: 8, background: "var(--tinta)", overflow: "hidden", flexShrink: 0 }}>{portadas[v.id] && <img src={portadas[v.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}</span>
                        <span className="pn">{v.titulo}</span>
                      </span>
                    </td>
                    <td>{duracionTxt(v.duracion_seg)}</td>
                    <td>{fechaDia(v.publicado_en)}</td>
                    <td>{v.completos} de {v.personas}</td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-l" onClick={() => setEditar({ ...v, posicion: i + 1 })}>Editar</button>{" "}
                      <button className="btn-txt peligro" onClick={() => retirar(v)}>Retirar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt">
        <div className="head"><div><h2>Eventuales</h2><p className="sub">Pulsa en una persona para ver el detalle de cada vídeo.</p></div></div>
        {!personas.length ? <p className="empty">No hay eventuales con cuenta.</p> : (
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Persona</th><th>Progreso</th><th>Estado</th></tr></thead>
              <tbody>
                {personas.map((p) => {
                  const e = lineaEstado(p);
                  return (
                    <tr key={p.id} onClick={() => setPersona(p.id)} style={{ cursor: "pointer" }}>
                      <td><span className="pn">{p.nombre}</span></td>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="barra-p" style={{ width: 120 }}><i style={{ width: `${p.total ? Math.round((p.completos / p.total) * 100) : 0}%`, background: p.rojo ? "var(--rojo)" : undefined }} /></span>
                          <span>{p.completos} de {p.total}</span>
                        </span>
                      </td>
                      <td style={e.rojo ? { color: "var(--rojo)", fontWeight: 700 } : undefined}>{e.txt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nuevo && <FormVideo total={videos.length} onClose={() => setNuevo(false)} onHecho={() => { setNuevo(false); cargar(); }} />}
      {editar && <FormEditar video={editar} total={videos.length} onClose={() => setEditar(null)} onHecho={() => { setEditar(null); cargar(); }} />}
      {persona && <DetallePersona p={personas.find((x) => x.id === persona)} id={persona} onClose={() => setPersona(null)} />}
    </>
  );
}

function DetallePersona({ p, id, onClose }) {
  const [lista, setLista] = useState(null);
  useEffect(() => { sb.rpc("formacion_admin_persona", { p_uid: id }).then(setLista).catch(() => { avisar("No se ha podido cargar el detalle", "mal"); setLista([]); }); }, [id]);
  if (!p) return null;
  const sinVer = p.sin_ver;
  return (
    <Panel titulo={p.nombre} sub={`${p.completos} completos · ${p.medias} a medias · ${sinVer} sin ver`} onClose={onClose} ancho="520px">
      {!lista ? <Cargando /> : lista.map((v, i) => {
        const pct = Math.min(100, Math.floor((Number(v.max_seg) / Number(v.duracion_seg)) * 100));
        const estado = v.completo_en ? "Completo" : Number(v.max_seg) > 0 ? "A medias" : "Sin ver";
        const rojo = !v.completo_en && v.dias >= 21;
        return (
          <div key={v.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
            <div style={{ fontWeight: 700 }}>{i + 1}. {v.titulo}</div>
            <div style={{ fontSize: 13, color: rojo ? "var(--rojo)" : "var(--text-2)", marginTop: 3 }}>
              {estado === "Completo" && <>Completo · {fechaCorta(v.completo_en)}</>}
              {estado === "A medias" && <>A medias · llegó al {pct} % · última vez {fechaCorta(v.ultima)} · lleva {v.dias} {v.dias === 1 ? "día" : "días"} publicado</>}
              {estado === "Sin ver" && <>Sin ver · lleva {v.dias} {v.dias === 1 ? "día" : "días"} publicado</>}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

const opcionesPosicion = (n, nuevo) => Array.from({ length: n + (nuevo ? 1 : 0) }, (_, i) => i + 1);

// Lee duración y una imagen de portada del archivo, sin subirlo
function leerVideo(archivo) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true; v.playsInline = true; v.src = url;
    const fallo = () => { URL.revokeObjectURL(url); mal(new Error("No se ha podido leer el vídeo. Usa un MP4 (H.264).")); };
    const t = setTimeout(fallo, 20000);
    v.onerror = () => { clearTimeout(t); fallo(); };
    v.onloadedmetadata = () => {
      const dur = v.duration;
      if (!isFinite(dur) || dur <= 0) { clearTimeout(t); return fallo(); }
      v.currentTime = Math.min(1, dur / 2);
    };
    v.onseeked = () => {
      clearTimeout(t);
      let portada = null;
      try {
        const c = document.createElement("canvas");
        const w = 480; c.width = w; c.height = Math.round(w * (v.videoHeight / (v.videoWidth || 1))) || 270;
        c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => { URL.revokeObjectURL(url); ok({ duracion: v.duration, portada: b }); }, "image/jpeg", 0.8);
        return;
      } catch (e) { /* sin portada */ }
      URL.revokeObjectURL(url); ok({ duracion: v.duration, portada });
    };
  });
}

function FormVideo({ total, onClose, onHecho }) {
  const [archivo, setArchivo] = useState(null);
  const [titulo, setTitulo] = useState("");
  const [pos, setPos] = useState(total + 1);
  const [paso, setPaso] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = archivo && titulo.trim() && !busy;
  const publicar = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      setPaso("Leyendo el vídeo…");
      const info = await leerVideo(archivo);
      const ext = (archivo.name.split(".").pop() || "mp4").toLowerCase();
      const s = await sb.fn("formacion", { accion: "subir", ext });
      setPaso("Subiendo el vídeo… no cierres esta ventana");
      const sube = await supabase.storage.from("formacion-videos").uploadToSignedUrl(s.ruta_video, s.token_video, archivo, { contentType: archivo.type || "video/mp4" });
      if (sube.error) throw new Error(`No se ha podido subir el vídeo (${sube.error.message}). Si es muy grande, comprímelo y vuelve a probar.`);
      let rutaPortada = "";
      if (info.portada) {
        const sp = await supabase.storage.from("formacion-videos").uploadToSignedUrl(s.ruta_portada, s.token_portada, info.portada, { contentType: "image/jpeg" });
        if (!sp.error) rutaPortada = s.ruta_portada;
      }
      setPaso("Publicando…");
      await sb.rpc("formacion_admin_alta", { p_titulo: titulo.trim(), p_ruta_video: s.ruta_video, p_ruta_portada: rutaPortada, p_duracion: info.duracion, p_posicion: Number(pos) });
      avisar("Vídeo publicado: las eventuales reciben el aviso en la campana");
      onHecho();
    } catch (e) { avisar(e.message || "No se ha podido publicar", "mal"); setBusy(false); setPaso(""); }
  };
  return (
    <Panel titulo="Nuevo vídeo" sub="Al publicarlo, cada eventual con cuenta recibe un aviso en la campana (no por email)" onClose={busy ? () => {} : onClose} ancho="520px"
      pie={<button className="btn-p" onClick={publicar} disabled={!ok}>{busy ? paso || "Publicando…" : "Publicar"}</button>}>
      <label className="campo">Archivo de vídeo<input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" disabled={busy} onChange={(e) => setArchivo(e.target.files[0] || null)} /></label>
      <small style={{ display: "block", marginTop: -8, marginBottom: 14, color: "var(--muted)" }}>Mejor MP4 (H.264) y ligero: se verá desde el móvil con datos.</small>
      <label className="campo">Título<input value={titulo} maxLength={90} disabled={busy} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Cómo se abre la tienda" /></label>
      <label className="campo">Posición en la lista
        <select value={pos} disabled={busy} onChange={(e) => setPos(e.target.value)}>
          {opcionesPosicion(total, true).map((n) => <option key={n} value={n}>{n === total + 1 ? `${n} · al final` : n}</option>)}
        </select>
      </label>
    </Panel>
  );
}

function FormEditar({ video, total, onClose, onHecho }) {
  const [titulo, setTitulo] = useState(video.titulo);
  const [pos, setPos] = useState(video.posicion);
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    if (!titulo.trim()) return;
    setBusy(true);
    try { await sb.rpc("formacion_admin_editar", { p_id: video.id, p_titulo: titulo.trim(), p_posicion: Number(pos) }); avisar("Cambios guardados"); onHecho(); }
    catch (e) { avisar("No se ha podido guardar", "mal"); setBusy(false); }
  };
  return (
    <Panel titulo="Editar vídeo" sub="El título nuevo se ve al volver a abrir la app. No se manda aviso." onClose={onClose} ancho="520px"
      pie={<button className="btn-p" onClick={guardar} disabled={busy || !titulo.trim()}>{busy ? "Guardando…" : "Guardar"}</button>}>
      <label className="campo">Título<input value={titulo} maxLength={90} onChange={(e) => setTitulo(e.target.value)} autoFocus /></label>
      <label className="campo">Posición en la lista
        <select value={pos} onChange={(e) => setPos(e.target.value)}>{opcionesPosicion(total, false).map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
    </Panel>
  );
}
