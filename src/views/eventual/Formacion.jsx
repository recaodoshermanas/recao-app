// Formación en vídeo (#79): tarjeta del inicio, lista de vídeos y reproductor que no deja adelantar.
import { useState, useEffect, useRef, useCallback } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { IcoCheck, IcoLeft } from "../../lib/icons.jsx";
import { duracionTxt, estadoVideo, pctVideo, resumenFormacion } from "../../lib/formacion.js";

// Al volver a ver un vídeo ya completo se puede mover libremente. Si dirección no lo quiere, poner false.
const LIBRE_TRAS_VERLO = true;

export function TarjetaFormacion({ videos, onAbrir }) {
  if (!videos || !videos.length) return null;
  const { total, completos, pendientes } = resumenFormacion(videos);
  if (pendientes === 0) {
    return (
      <button onClick={() => onAbrir()} style={{ marginTop: 16, width: "100%", boxSizing: "border-box", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "#EFEBE3", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: "14px 16px", cursor: "pointer" }}>
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoCheck size={18} color={C.grn} sw={2.8} /></span>
        <span>
          <span style={{ display: "block", fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mut }}>Formación</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.char, marginTop: 2 }}>Estás al día · {completos} de {total} {total === 1 ? "vídeo visto" : "vídeos vistos"}</span>
        </span>
      </button>
    );
  }
  return (
    <button onClick={() => onAbrir()} style={{ marginTop: 16, width: "100%", boxSizing: "border-box", textAlign: "left", background: C.char, border: "none", borderRadius: 18, padding: "16px", cursor: "pointer", display: "block" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ minWidth: 34, height: 34, padding: "0 6px", boxSizing: "border-box", flexShrink: 0, borderRadius: 999, background: "#E5484D", color: "#fff", fontFamily: SF, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>{pendientes}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: "block", fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gold }}>Formación</span>
          <span style={{ display: "block", fontFamily: F, fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 2 }}>{pendientes === 1 ? "1 vídeo nuevo para ver" : `${pendientes} vídeos nuevos para ver`}</span>
        </span>
      </span>
      <span style={{ display: "block", height: 6, borderRadius: 999, background: "rgba(255,255,255,.18)", marginTop: 12, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${Math.round((completos / total) * 100)}%`, background: C.gold }} />
      </span>
      <span style={{ display: "block", fontFamily: F, fontSize: 12, color: "rgba(255,255,255,.7)", marginTop: 6 }}>{completos} de {total} completos</span>
    </button>
  );
}

const chip = (txt, bg, fg) => <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: bg, color: fg }}>{txt}</span>;

export function FormacionView({ videos, abrirId, onCambio, onVolver }) {
  const [sel, setSel] = useState(abrirId || null);
  const [portadas, setPortadas] = useState({});
  useEffect(() => { sb.fn("formacion", { accion: "portadas" }).then((r) => setPortadas(r.portadas || {})).catch(() => {}); }, [(videos || []).length]);
  useEffect(() => { if (abrirId) setSel(abrirId); }, [abrirId]);
  const lista = videos || [];
  const { total, completos } = resumenFormacion(lista);
  const actual = sel ? lista.find((v) => String(v.id) === String(sel)) : null;

  if (actual) return <Reproductor key={actual.id} video={actual} portada={portadas[actual.id]} onCambio={onCambio} onSalir={() => setSel(null)} />;

  return (
    <div style={{ padding: "18px 16px 40px", maxWidth: 540, margin: "0 auto" }}>
      <button onClick={onVolver} style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 40, padding: 0, border: "none", background: "transparent", fontFamily: F, fontSize: 14, fontWeight: 600, color: C.goldSub, cursor: "pointer" }}><IcoLeft size={18} /> Volver</button>
      <div style={{ fontFamily: SF, fontSize: 28, color: C.char, marginTop: 4 }}>Formación</div>
      <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut, marginTop: 4 }}>{total === 0 ? "Todavía no hay vídeos." : `${completos} de ${total} ${total === 1 ? "vídeo visto" : "vídeos vistos"}`}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {lista.map((v, i) => {
          const est = estadoVideo(v);
          return (
            <button key={v.id} onClick={() => setSel(v.id)} style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 10, cursor: "pointer" }}>
              <span style={{ width: 96, height: 60, flexShrink: 0, borderRadius: 10, background: C.char, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {portadas[v.id] && <img src={portadas[v.id]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                <span style={{ position: "relative", width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ borderLeft: "9px solid #fff", borderTop: "6px solid transparent", borderBottom: "6px solid transparent", marginLeft: 2 }} /></span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: F, fontSize: 11.5, color: C.mutL, fontWeight: 600 }}>Vídeo {i + 1} · {duracionTxt(v.duracion_seg)}</span>
                <span style={{ display: "block", fontFamily: F, fontSize: 14.5, fontWeight: 700, color: C.char, marginTop: 2, lineHeight: 1.3 }}>{v.titulo}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                  {est === "visto" ? chip("Visto", "#E7F3EC", "#1E7A46") : chip("Nuevo", "#FBF0DA", "#8A6410")}
                  {est === "medias" && <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}>a medias · {pctVideo(v)} %</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Reproductor({ video, portada, onCambio, onSalir }) {
  const completo = !!video.completo_en;
  const libre = LIBRE_TRAS_VERLO && completo;
  const dur = Number(video.duracion_seg) || 0;
  const vref = useRef(null);
  const caja = useRef(null);
  const maxRef = useRef(completo ? dur : Number(video.max_seg) || 0);
  const guardadoRef = useRef(maxRef.current);
  const enVuelo = useRef(false);
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const [jugando, setJugando] = useState(false);
  const [cur, setCur] = useState(0);
  const [pantalla, setPantalla] = useState(false);
  const [fin, setFin] = useState(false);
  const porGiro = useRef(false);

  useEffect(() => {
    let vivo = true;
    sb.fn("formacion", { accion: "url", video_id: video.id }).then((r) => { if (vivo) setUrl(r.url); }).catch((e) => { if (vivo) setError(e.message || "No se ha podido abrir el vídeo"); });
    return () => { vivo = false; };
  }, [video.id]);

  const guardar = useCallback(async (seg) => {
    if (enVuelo.current) return;
    if (seg <= guardadoRef.current && seg < dur) return;
    enVuelo.current = true;
    try {
      const r = await sb.rpc("formacion_guardar_progreso", { p_video: video.id, p_seg: seg });
      if (r && r.ok) { guardadoRef.current = Number(r.max_seg); if (r.completo && !completo) setFin(true); onCambio && onCambio(); }
    } catch (e) { /* se reintenta en el siguiente guardado */ }
    enVuelo.current = false;
  }, [video.id, dur, completo, onCambio]);

  // guardado cada 10 s, al pausar, al ocultar la pestaña y al salir
  useEffect(() => {
    const t = setInterval(() => { const v = vref.current; if (v && !v.paused) guardar(maxRef.current); }, 10000);
    const oculto = () => { if (document.visibilityState === "hidden") guardar(maxRef.current); };
    document.addEventListener("visibilitychange", oculto);
    window.addEventListener("pagehide", oculto);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", oculto); window.removeEventListener("pagehide", oculto); guardar(maxRef.current); };
  }, [guardar]);

  // pantalla completa propia (la misma capa de la app: así el bloqueo de adelantar sigue valiendo en iPhone)
  const entrar = () => {
    setPantalla(true);
    try { caja.current && caja.current.requestFullscreen && caja.current.requestFullscreen().catch(() => {}); } catch (e) { /* iPhone: basta la capa propia */ }
  };
  const salir = () => {
    setPantalla(false); porGiro.current = false;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* noop */ }
  };
  useEffect(() => {
    const h = () => { if (!document.fullscreenElement) { setPantalla(false); porGiro.current = false; } };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const h = () => {
      const horizontal = mq.matches && window.innerHeight < 560;
      if (horizontal && !pantalla) { porGiro.current = true; setPantalla(true); }
      if (!mq.matches && porGiro.current) { porGiro.current = false; setPantalla(false); }
    };
    mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); };
  }, [pantalla]);
  useEffect(() => {
    if (!pantalla) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [pantalla]);

  const alCargar = () => {
    const v = vref.current; if (!v) return;
    const ini = completo ? 0 : Math.min(maxRef.current, Math.max(0, (v.duration || dur) - 3));
    if (ini > 1) v.currentTime = ini;
  };
  const alAvanzar = () => {
    const v = vref.current; if (!v) return;
    const t = v.currentTime;
    if (!libre) {
      if (t > maxRef.current + 1.2) { v.currentTime = maxRef.current; return; }
      if (t > maxRef.current) maxRef.current = t;
    }
    setCur(t);
  };
  const alBuscar = () => {
    const v = vref.current; if (!v || libre) return;
    if (v.currentTime > maxRef.current + 0.6) v.currentTime = maxRef.current;
  };
  const alAcabar = () => { maxRef.current = dur; setJugando(false); guardar(dur); };
  const alternar = () => { const v = vref.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const mover = (e) => {
    const v = vref.current; if (!v) return;
    const x = Number(e.target.value);
    v.currentTime = libre ? x : Math.min(x, maxRef.current);
  };

  const total = dur || 1;
  const visto = Math.min(100, (maxRef.current / total) * 100);
  const caja_estilo = pantalla
    ? { position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", flexDirection: "column", justifyContent: "center" }
    : { position: "relative", background: "#000", borderRadius: 16, overflow: "hidden" };

  return (
    <div style={{ padding: pantalla ? 0 : "18px 16px 40px", maxWidth: 540, margin: "0 auto" }}>
      {!pantalla && <button onClick={() => { guardar(maxRef.current); onSalir(); }} style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 40, padding: 0, border: "none", background: "transparent", fontFamily: F, fontSize: 14, fontWeight: 600, color: C.goldSub, cursor: "pointer" }}><IcoLeft size={18} /> Formación</button>}
      {!pantalla && <div style={{ fontFamily: SF, fontSize: 24, color: C.char, margin: "4px 0 12px" }}>{video.titulo}</div>}
      <div ref={caja} style={caja_estilo}>
        {error ? <div style={{ padding: 30, color: "#fff", fontFamily: F, fontSize: 14, textAlign: "center" }}>{error}</div>
          : !url ? <div style={{ padding: 30, color: "#fff", fontFamily: F, fontSize: 14, textAlign: "center" }}>Cargando vídeo…</div>
          : (
            <video ref={vref} src={url} poster={portada || undefined} playsInline webkit-playsinline="true" preload="metadata" controlsList="nodownload noplaybackrate" disablePictureInPicture disableRemotePlayback
              onContextMenu={(e) => e.preventDefault()} onClick={alternar}
              onLoadedMetadata={alCargar} onTimeUpdate={alAvanzar} onSeeking={alBuscar} onRateChange={() => { if (vref.current) vref.current.playbackRate = 1; }}
              onPlay={() => setJugando(true)} onPause={() => { setJugando(false); guardar(maxRef.current); }} onEnded={alAcabar}
              style={{ width: "100%", maxHeight: pantalla ? "calc(100vh - 64px)" : "70vh", background: "#000", display: "block" }} />
          )}
        {url && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "rgba(0,0,0,.85)" }}>
            <button onClick={alternar} aria-label={jugando ? "Pausar" : "Reproducir"} style={{ width: 40, height: 40, flexShrink: 0, border: "none", borderRadius: "50%", background: C.gold, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {jugando
                ? <span style={{ display: "flex", gap: 4 }}><i style={{ width: 4, height: 14, background: C.goldDark }} /><i style={{ width: 4, height: 14, background: C.goldDark }} /></span>
                : <span style={{ borderLeft: `12px solid ${C.goldDark}`, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", marginLeft: 3 }} />}
            </button>
            <input type="range" min={0} max={total} step={0.1} value={Math.min(cur, total)} onChange={mover} aria-label="Posición del vídeo"
              style={{ flex: 1, height: 28, accentColor: C.gold, background: `linear-gradient(to right, rgba(241,190,73,.45) ${visto}%, rgba(255,255,255,.2) ${visto}%)`, borderRadius: 999 }} />
            <span style={{ fontFamily: F, fontSize: 12, color: "#fff", minWidth: 74, textAlign: "right" }}>{duracionTxt(cur)} / {duracionTxt(dur)}</span>
            <button onClick={pantalla ? salir : entrar} aria-label={pantalla ? "Salir de pantalla completa" : "Pantalla completa"} style={{ width: 40, height: 40, flexShrink: 0, border: "1.5px solid rgba(255,255,255,.4)", borderRadius: 10, background: "transparent", color: "#fff", cursor: "pointer", fontSize: 18 }}>{pantalla ? "⤡" : "⤢"}</button>
          </div>
        )}
      </div>
      {!pantalla && (
        <div style={{ fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.5, marginTop: 12 }}>
          {libre ? "Ya has visto este vídeo entero: puedes moverte libremente por él." : "No se puede adelantar el vídeo. Cuenta como visto cuando llegas al final."}
        </div>
      )}
      {!pantalla && fin && <div role="status" style={{ marginTop: 12, background: "#E7F3EC", color: "#1E7A46", fontFamily: F, fontSize: 14, fontWeight: 700, borderRadius: 12, padding: "12px 14px" }}>¡Vídeo completo! Ya cuenta como visto.</div>}
    </div>
  );
}
