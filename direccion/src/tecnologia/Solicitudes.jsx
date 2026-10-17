// Tecnología · Solicitudes: lo que los socios piden para la app y el panel.
// Cada solicitud tiene estado, urgencia e historial (comentarios, preguntas, revisiones y cambios de estado).
// Claude las lee y las actualiza directamente en la base de datos (tablas tec_solicitudes y tec_solicitud_eventos).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Panel, Pestanas, Avatar, avisar, hace, fechaCorta, Cargando } from "../ui.jsx";
import { AREAS_PLAN, AREA, SOCIOS, nombreSocio } from "../plan/datos.js";
import "./tecnologia.css";

export const ESTADOS = [
  { id: "pregunta", label: "Necesita respuesta", corto: "Pregunta" },
  { id: "revision", label: "Para revisar", corto: "Revisar" },
  { id: "en_curso", label: "En curso", corto: "En curso" },
  { id: "por_hacer", label: "Por hacer", corto: "Por hacer" },
  { id: "nueva", label: "Recibida", corto: "Recibida" },
  { id: "standby", label: "En espera", corto: "En espera" },
  { id: "hecha", label: "Hecha", corto: "Hecha" },
  { id: "descartada", label: "Descartada", corto: "Descartada" },
];
const ESTADO = Object.fromEntries(ESTADOS.map((e) => [e.id, e]));
const CERRADAS = ["hecha", "descartada"];
export const URGENCIAS = [
  { id: "urgente", label: "Urgente" }, { id: "alta", label: "Alta" }, { id: "normal", label: "Normal" }, { id: "baja", label: "Baja" },
];
const URG_N = { urgente: 0, alta: 1, normal: 2, baja: 3 };
const TIPOS = [
  { id: "nueva", label: "Función nueva" }, { id: "mejora", label: "Mejora" }, { id: "error", label: "Algo falla" }, { id: "consulta", label: "Duda" },
];
const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]));
const DONDES = [
  { id: "app", label: "App del equipo" }, { id: "panel", label: "Panel de dirección" }, { id: "ambas", label: "Las dos" }, { id: "otro", label: "Otro" },
];
const DONDE = Object.fromEntries(DONDES.map((d) => [d.id, d]));
const ESPERA_SOCIO = ["pregunta", "revision"];

const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Cuenta del panel → socio (Adrián, Pablo, Javi, Miguel); la cuenta compartida no es nadie
export function socioDe(user) {
  const pila = sinTildes(String(user?.nombre || "").trim().split(/\s+/)[0]);
  const s = SOCIOS.find((x) => sinTildes(x.label) === pila || sinTildes(x.id) === pila);
  return s ? s.id : "";
}
// Lee el documento que prepara el Claude de cada socio (formato de «Cómo pedir») y rellena los campos
const CLAVES_DOC = ["titulo", "urgencia", "tipo", "donde", "area"];
const buscar = (lista, v) => lista.find((x) => sinTildes(v).startsWith(sinTildes(x.label)) || sinTildes(v).includes(sinTildes(x.label)));
export function leerDocumento(txt) {
  const campos = {}; const resto = [];
  String(txt || "").replace(/\r/g, "").split("\n").forEach((l) => {
    const m = l.replace(/[*_#>`]/g, "").trim().match(/^([A-Za-zÁÉÍÓÚáéíóúÑñ ]{3,20}):\s*(.*)$/);
    const k = m && sinTildes(m[1]).trim();
    if (k && CLAVES_DOC.includes(k) && !(k in campos)) {
      campos[k] = m[2].trim();
      if (k === "urgencia" && /[,.(—–-]\s*\S/.test(campos[k])) resto.push(l); // el porqué de la urgencia se queda en los detalles
      return;
    }
    resto.push(l);
  });
  const out = { descripcion: resto.map((l) => l.replace(/\*\*/g, "")).join("\n").replace(/^\s+|\s+$/g, "") };
  if (campos.titulo) out.titulo = campos.titulo.replace(/^["«“]|["»”]$/g, "").slice(0, 120);
  const u = campos.urgencia && buscar(URGENCIAS, campos.urgencia); if (u) out.urgencia = u.id;
  const t = campos.tipo && buscar(TIPOS, campos.tipo); if (t) out.tipo = t.id;
  if (campos.donde) { const d = sinTildes(campos.donde); out.donde = d.includes("dos") || d.includes("ambas") ? "ambas" : d.includes("app") ? "app" : d.includes("panel") ? "panel" : "otro"; }
  const a = campos.area && buscar(AREAS_PLAN, campos.area); if (a) out.area = a.id;
  return out;
}
const filas = (t, min = 4, max = 18) => Math.max(min, Math.min(max, String(t || "").split("\n").length + 1));

const orden = (a, b) => (URG_N[a.urgencia] ?? 2) - (URG_N[b.urgencia] ?? 2) || String(a.creado_en).localeCompare(String(b.creado_en));

// ---- datos ----
function useSolicitudes() {
  const [sols, setSols] = useState(null);
  const [nEv, setNEv] = useState({});
  const cargar = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        sb.select("tec_solicitudes", "select=*&order=creado_en.desc"),
        sb.select("tec_solicitud_eventos", "select=solicitud_id&tipo=neq.estado"),
      ]);
      const n = {}; e.forEach((x) => { n[x.solicitud_id] = (n[x.solicitud_id] || 0) + 1; });
      setSols(s); setNEv(n);
    } catch (err) { setSols((v) => v || []); }
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(); }, 45000);
    return () => clearInterval(t);
  }, [cargar]);
  const cambiar = useCallback(async (id, patch) => {
    setSols((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try { await sb.update("tec_solicitudes", `id=eq.${id}`, patch); } catch (err) { avisar("No se ha podido guardar", "mal"); }
    cargar();
  }, [cargar]);
  return { sols, nEv, cargar, cambiar };
}
const eventosDe = (id) => sb.select("tec_solicitud_eventos", `select=*&solicitud_id=eq.${id}&order=id.asc`);
const nuevoEvento = (solicitud_id, tipo, texto) => sb.insert("tec_solicitud_eventos", { solicitud_id, tipo, texto });

// ---- piezas ----
function Urg({ u }) { return <span className={`sol-urg u-${u}`}>{URGENCIAS.find((x) => x.id === u)?.label || u}</span>; }
function Est({ e }) { return <span className={`sol-est e-${e}`}>{ESTADO[e]?.corto || e}</span>; }
function ChipArea({ id }) { const a = AREA[id]; return a ? <span className="chip-area" style={{ "--c": a.color }}>{a.label}</span> : null; }

function Fila({ s, nCom, onAbrir }) {
  return (
    <li>
      <button className={`sol-fila u-${s.urgencia}`} onClick={() => onAbrir(s.id)}>
        <span className="sol-num">#{s.id}</span>
        <span className="sol-cuerpo">
          <span className="sol-tit">{s.titulo}</span>
          <span className="sol-meta">
            <Est e={s.estado} />
            {s.urgencia !== "normal" && <Urg u={s.urgencia} />}
            <span>{TIPO[s.tipo]?.label}</span>
            <span>{DONDE[s.donde]?.label}</span>
            <ChipArea id={s.area} />
            {nCom > 0 && <span>💬 {nCom}</span>}
            {s.fecha_limite && !CERRADAS.includes(s.estado) && <span className="sol-fl">para el {fechaCorta(s.fecha_limite)}</span>}
          </span>
        </span>
        <span className="sol-quien" title={s.pedido_por ? `Pide ${nombreSocio(s.pedido_por)}` : "Sin asignar"}>
          {s.pedido_por ? <Avatar nombre={nombreSocio(s.pedido_por)} size={26} /> : <span className="avatar vacio" style={{ width: 26, height: 26 }} />}
          <small>{hace(s.actualizado_en || s.creado_en)}</small>
        </span>
      </button>
    </li>
  );
}

// ---- alta ----
function Nueva({ yo, onClose, onCreada }) {
  const [f, setF] = useState({ titulo: "", descripcion: "", pedido_por: yo, urgencia: "normal", tipo: "mejora", donde: "panel", area: "", enlace: "" });
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState("");
  const [pegado, setPegado] = useState(false);
  const aplicarDoc = () => {
    if (!doc.trim()) return;
    const d = leerDocumento(doc);
    setF((x) => ({ ...x, ...d }));
    setPegado(true);
    avisar(d.titulo ? "Campos rellenados: revísalos antes de enviar" : "No he encontrado el título: escríbelo tú");
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const enviar = async () => {
    if (!f.titulo.trim()) return;
    setBusy(true);
    try {
      const r = await sb.insert("tec_solicitudes", { ...f, titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, pedido_por: f.pedido_por || null, area: f.area || null, enlace: f.enlace.trim() || null });
      const n = Array.isArray(r) ? r[0] : r;
      avisar("Solicitud enviada");
      onCreada(n);
    } catch (e) { avisar("No se ha podido enviar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Nueva solicitud" sub="Para la app del equipo o el panel de dirección" onClose={onClose} ancho="560px"
      pie={<button className="btn-p" onClick={enviar} disabled={busy || !f.titulo.trim()}>{busy ? "Enviando…" : "Enviar solicitud"}</button>}>
      {!pegado && (
        <div className="sol-pegar">
          <b>¿Lo has preparado con tu Claude?</b>
          <p>Pega aquí el documento que te ha dado y se rellenan los campos solos. <a href="#/tecnologia/como-pedir" onClick={onClose}>Cómo prepararlo</a></p>
          <textarea rows={3} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Pega el documento completo…" aria-label="Documento de Claude" />
          <div className="sol-botones"><button className="btn-l" disabled={!doc.trim()} onClick={aplicarDoc}>Rellenar con el documento</button></div>
        </div>
      )}
      <label className="campo">Qué necesitas<input value={f.titulo} onChange={set("titulo")} placeholder="Ej.: que los festivos salgan marcados en Horarios" autoFocus={!pegado} /></label>
      <label className="campo">Detalles<textarea rows={filas(f.descripcion, 5)} value={f.descripcion} onChange={set("descripcion")} placeholder="Para qué lo quieres y cómo te lo imaginas. Si algo falla: qué hiciste, qué esperabas y qué pasó." /></label>
      <div className="campo-t"><span>Urgencia</span>
        <div className="seg seg-wrap">{URGENCIAS.map((u) => <button key={u.id} aria-pressed={f.urgencia === u.id} onClick={() => setF({ ...f, urgencia: u.id })}>{u.label}</button>)}</div>
      </div>
      <div className="fila-campos">
        <label className="campo">Tipo<select value={f.tipo} onChange={set("tipo")}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="campo">Dónde<select value={f.donde} onChange={set("donde")}>{DONDES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
      </div>
      <div className="fila-campos">
        <label className="campo">Quién lo pide<select value={f.pedido_por} onChange={set("pedido_por")}><option value="">—</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label className="campo">Área<select value={f.area} onChange={set("area")}><option value="">Sin área</option>{AREAS_PLAN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
      </div>
      <label className="campo">Enlace a un documento, chat o captura (opcional)<input type="url" value={f.enlace} onChange={set("enlace")} placeholder="https://…" /></label>
    </Panel>
  );
}

// ---- detalle ----
function Evento({ ev }) {
  if (ev.tipo === "estado") {
    return <li className="sol-ev-estado"><span>{ev.autor || "—"} la pasó de <b>{ESTADO[ev.de]?.label || ev.de || "—"}</b> a <b>{ESTADO[ev.a]?.label || ev.a}</b></span><small>{hace(ev.creado_en)}</small></li>;
  }
  const etiqueta = { pregunta: "Pregunta", respuesta: "Respuesta", revision_ok: "Revisada: funciona", revision_cambios: "Pide cambios" }[ev.tipo];
  return (
    <li className={`sol-ev t-${ev.tipo}`}>
      <Avatar nombre={ev.autor} size={28} />
      <div>
        <b>{ev.autor || "—"}</b>{etiqueta && <span className="sol-ev-tipo">{etiqueta}</span>}<small>{hace(ev.creado_en)}</small>
        {ev.texto && <p>{ev.texto}</p>}
      </div>
    </li>
  );
}

function Detalle({ s, onClose, cambiar, recargar }) {
  const [evs, setEvs] = useState(null);
  const [titulo, setTitulo] = useState(s.titulo);
  const [desc, setDesc] = useState(s.descripcion || "");
  const [enlace, setEnlace] = useState(s.enlace || "");
  const [txt, setTxt] = useState("");
  const [resp, setResp] = useState("");
  const [modoCambios, setModoCambios] = useState(false);
  const [busy, setBusy] = useState(false);
  const finRef = useRef(null);
  const cargarEvs = useCallback(() => eventosDe(s.id).then(setEvs).catch(() => setEvs([])), [s.id]);
  useEffect(() => { cargarEvs(); }, [cargarEvs, s.estado]);
  useEffect(() => { setTitulo(s.titulo); setDesc(s.descripcion || ""); setEnlace(s.enlace || ""); }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const anotar = async (tipo, texto, estado) => {
    setBusy(true);
    try {
      if (tipo !== "estado" && (texto || tipo !== "comentario")) await nuevoEvento(s.id, tipo, texto || null);
      if (estado && estado !== s.estado) await cambiar(s.id, { estado });
      await cargarEvs(); recargar();
      setTimeout(() => finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
      return true;
    } catch (e) { avisar("No se ha podido guardar", "mal"); return false; }
    finally { setBusy(false); }
  };
  const ultimaPregunta = (evs || []).filter((e) => e.tipo === "pregunta").slice(-1)[0];

  return (
    <Panel titulo={<input className="titulo-ed" value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo.trim() && titulo !== s.titulo && cambiar(s.id, { titulo: titulo.trim() })} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} aria-label="Título" />}
      sub={`#${s.id} · ${s.pedido_por ? `la pide ${nombreSocio(s.pedido_por)}` : "sin asignar"} · ${hace(s.creado_en)}`} onClose={onClose} ancho="620px"
      pie={<button className="btn-p" onClick={onClose}>Listo</button>}>

      {s.estado === "revision" && (
        <div className="sol-accion revisar">
          <b>Está publicada. ¿Funciona como esperabas?</b>
          {!modoCambios ? (
            <div className="sol-botones">
              <button className="btn-ok" disabled={busy} onClick={() => anotar("revision_ok", null, "hecha")}>Sí, funciona</button>
              <button className="btn-l" disabled={busy} onClick={() => setModoCambios(true)}>Pedir cambios</button>
            </div>
          ) : (
            <div className="nuevo-com">
              <textarea rows={3} value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Qué no funciona o qué cambiarías…" autoFocus />
              <div className="sol-botones">
                <button className="btn-txt" onClick={() => setModoCambios(false)}>Cancelar</button>
                <button className="btn-p" disabled={busy || !resp.trim()} onClick={async () => { if (await anotar("revision_cambios", resp.trim(), "por_hacer")) { setResp(""); setModoCambios(false); } }}>Enviar cambios</button>
              </div>
            </div>
          )}
        </div>
      )}
      {s.estado === "pregunta" && (
        <div className="sol-accion pregunta">
          <b>Hay una pregunta para seguir</b>
          {ultimaPregunta?.texto && <p>{ultimaPregunta.texto}</p>}
          <div className="nuevo-com">
            <textarea rows={3} value={resp} onChange={(e) => setResp(e.target.value)} placeholder="Tu respuesta…" />
            <button className="btn-p" disabled={busy || !resp.trim()} onClick={async () => { if (await anotar("respuesta", resp.trim(), "por_hacer")) setResp(""); }}>Responder</button>
          </div>
        </div>
      )}

      <div className="campos-t">
        <div className="campo-t"><span>Estado</span>
          <div className="seg seg-wrap">{ESTADOS.map((e) => <button key={e.id} aria-pressed={s.estado === e.id} onClick={() => anotar("estado", null, e.id)} disabled={busy}>{e.label}</button>)}</div>
        </div>
        <div className="campo-t"><span>Urgencia</span>
          <div className="seg seg-wrap">{URGENCIAS.map((u) => <button key={u.id} aria-pressed={s.urgencia === u.id} onClick={() => cambiar(s.id, { urgencia: u.id })}>{u.label}</button>)}</div>
        </div>
        <div className="fila-campos">
          <label className="campo">Tipo<select value={s.tipo} onChange={(e) => cambiar(s.id, { tipo: e.target.value })}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="campo">Dónde<select value={s.donde} onChange={(e) => cambiar(s.id, { donde: e.target.value })}>{DONDES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></label>
        </div>
        <div className="fila-campos">
          <label className="campo">Quién lo pide<select value={s.pedido_por || ""} onChange={(e) => cambiar(s.id, { pedido_por: e.target.value || null })}><option value="">—</option>{SOCIOS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          <label className="campo">Área<select value={s.area || ""} onChange={(e) => cambiar(s.id, { area: e.target.value || null })}><option value="">Sin área</option>{AREAS_PLAN.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        </div>
        <label className="campo">Para cuándo (opcional)<input type="date" value={s.fecha_limite || ""} onChange={(e) => cambiar(s.id, { fecha_limite: e.target.value || null })} /></label>
        <label className="campo">Detalles<textarea rows={filas(desc)} value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={() => desc !== (s.descripcion || "") && cambiar(s.id, { descripcion: desc.trim() || null })} placeholder="Para qué es y cómo te lo imaginas" /></label>
        <label className="campo">Enlace (opcional){/^https?:\/\//.test(s.enlace || "") && <a className="sol-enlace" href={s.enlace} target="_blank" rel="noopener noreferrer">Abrir enlace ↗</a>}
          <input type="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} onBlur={() => enlace.trim() !== (s.enlace || "") && cambiar(s.id, { enlace: enlace.trim() || null })} placeholder="https://…" /></label>

        <div className="campo-t bloque"><span>Historial</span>
          {evs === null ? <p className="empty">Cargando…</p> : evs.length === 0 ? <p className="empty">Todavía nada.</p> : (
            <ul className="sol-hist">{evs.map((ev) => <Evento key={ev.id} ev={ev} />)}</ul>
          )}
          <div className="nuevo-com" ref={finRef}>
            <textarea rows={2} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Escribe un comentario, una idea o feedback…" />
            <button className="btn-l" disabled={busy || !txt.trim()} onClick={async () => { if (await anotar("comentario", txt.trim())) setTxt(""); }}>Comentar</button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ---- pantalla ----
export function TecSolicitudes({ user, extra }) {
  const yo = socioDe(user);
  const { sols, nEv, cargar, cambiar } = useSolicitudes();
  const [vista, setVista] = useState("abiertas");
  const [q, setQ] = useState("");
  const [quien, setQuien] = useState("");
  const [urg, setUrg] = useState("");
  const [abierta, setAbierta] = useState(() => Number(extra) || null);
  const [nueva, setNueva] = useState(false);
  const [plegados, setPlegados] = useState({ standby: true });

  const lista = useMemo(() => (sols || []).filter((s) =>
    (!q || sinTildes(`#${s.id} ${s.titulo} ${s.descripcion || ""}`).includes(sinTildes(q))) &&
    (!quien || s.pedido_por === quien) && (!urg || s.urgencia === urg)), [sols, q, quien, urg]);
  const abiertas = lista.filter((s) => !CERRADAS.includes(s.estado));
  const cerradas = lista.filter((s) => CERRADAS.includes(s.estado)).sort((a, b) => String(b.cerrada_en || b.actualizado_en).localeCompare(String(a.cerrada_en || a.actualizado_en)));
  const meToca = (sols || []).filter((s) => ESPERA_SOCIO.includes(s.estado) && (!yo || s.pedido_por === yo));
  const sel = (sols || []).find((s) => s.id === abierta);

  if (!sols) return <Cargando />;
  return (
    <div className="sol">
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={setVista} etiqueta="Solicitudes"
          opciones={[{ id: "abiertas", label: "Abiertas", n: (sols || []).filter((s) => !CERRADAS.includes(s.estado)).length }, { id: "cerradas", label: "Cerradas" }]} />
        <div className="acciones"><a className="btn-txt" href="#/tecnologia/como-pedir">Cómo pedir</a><button className="btn-p" onClick={() => setNueva(true)}>+ Nueva solicitud</button></div>
      </div>

      {vista === "abiertas" && meToca.length > 0 && (
        <div className="sol-toca">
          <b>{yo ? "Te toca" : "Esperan respuesta"}: {meToca.length === 1 ? "1 solicitud" : `${meToca.length} solicitudes`}</b>
          <ul>{meToca.sort(orden).map((s) => <li key={s.id}><button onClick={() => setAbierta(s.id)}><Est e={s.estado} /> #{s.id} {s.titulo}{!yo && s.pedido_por ? ` · ${nombreSocio(s.pedido_por)}` : ""}</button></li>)}</ul>
        </div>
      )}

      <div className="filtros-t">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" aria-label="Buscar solicitudes" />
        <select value={quien} onChange={(e) => setQuien(e.target.value)} aria-label="Quién la pide"><option value="">La pida quien la pida</option>{SOCIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select value={urg} onChange={(e) => setUrg(e.target.value)} aria-label="Urgencia"><option value="">Cualquier urgencia</option>{URGENCIAS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
        {(q || quien || urg) && <button className="btn-txt" onClick={() => { setQ(""); setQuien(""); setUrg(""); }}>Limpiar</button>}
      </div>

      {vista === "abiertas" ? (
        abiertas.length === 0 ? <p className="empty">No hay solicitudes abiertas.</p> : (
          <div className="grupos-t">
            {ESTADOS.filter((e) => !CERRADAS.includes(e.id)).map((e) => {
              const g = abiertas.filter((s) => s.estado === e.id).sort(orden);
              if (!g.length) return null;
              const pleg = !!plegados[e.id];
              return (
                <section key={e.id} className={`grupo-t sol-g g-${e.id}`}>
                  <button className="grupo-t-cab" onClick={() => setPlegados({ ...plegados, [e.id]: !pleg })} aria-expanded={!pleg}>
                    <span className="flecha">{pleg ? "▸" : "▾"}</span>{e.label}<small>{g.length}</small>
                  </button>
                  {!pleg && <ul className="sol-lista">{g.map((s) => <Fila key={s.id} s={s} nCom={nEv[s.id]} onAbrir={setAbierta} />)}</ul>}
                </section>
              );
            })}
          </div>
        )
      ) : (
        cerradas.length === 0 ? <p className="empty">Todavía no hay solicitudes cerradas.</p> : <ul className="sol-lista">{cerradas.map((s) => <Fila key={s.id} s={s} nCom={nEv[s.id]} onAbrir={setAbierta} />)}</ul>
      )}

      <p className="sol-nota">Claude ve estas solicitudes directamente: cuando trabaja en una, cambia su estado y deja aquí lo que ha hecho o lo que necesita saber. A quien la pide le llega un aviso (campana y correo) cuando hay una pregunta, cuando está lista para revisar y cuando cambia de estado.</p>

      {nueva && <Nueva yo={yo} onClose={() => setNueva(false)} onCreada={(n) => { setNueva(false); cargar(); if (n?.id) setAbierta(n.id); }} />}
      {sel && <Detalle s={sel} onClose={() => setAbierta(null)} cambiar={cambiar} recargar={cargar} />}
    </div>
  );
}
