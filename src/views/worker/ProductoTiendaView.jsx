import { useState, useEffect, useRef } from "react";
import { F, SF, C, SHADOW, inp, btnDark, btnGhost, lbl } from "../../lib/styles.js";
import { IcoRight, IcoCheck } from "../../lib/icons.jsx";
import { sb } from "../../lib/supabase.js";
import { prepararFoto } from "./RecepcionView.jsx";
import { Instrucciones } from "../../components/Instrucciones.jsx";

// #35 · Bloque «Producto» de la app de trabajadoras: «Escanear producto» (es este / no es este / cambiar precio)
// e «Instrucciones» desplegables en cada pantalla (el texto lo edita dirección en Producto → App de tienda).
const fn = (accion, datos = {}) => sb.fn("producto-tienda", { accion, ...datos });
const fnRec = (accion, datos = {}) => sb.fn("recepcion", { accion, ...datos });
const eur = (x) => (x == null || isNaN(x) ? "" : Number(x).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €");
const numero = (v) => { const t = String(v ?? "").trim().replace(/\s|€/g, "").replace(",", "."); const n = Number(t); return t !== "" && isFinite(n) ? n : null; };
const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 18, padding: 16, boxShadow: SHADOW.card, display: "flex", flexDirection: "column", gap: 10 };
const btnPeq = { ...btnGhost, padding: "0 14px", height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 };
const caja = { padding: "16px 16px 28px", display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "0 auto" };

function Aviso({ msg, tipo = "mal" }) {
  if (!msg) return null;
  return <div role="alert" style={{ fontFamily: F, fontSize: 13, borderRadius: 12, padding: "10px 12px", background: tipo === "mal" ? "#FBEAE7" : "#EAF4EE", color: tipo === "mal" ? "#A3362B" : "#1E6B3C" }}>{msg}</div>;
}

// ---------- lector: pistola (teclado) o cámara ----------
function LectorCodigo({ onCodigo }) {
  const [codigo, setCodigo] = useState("");
  const [camara, setCamara] = useState(false);
  const [msg, setMsg] = useState("");
  const video = useRef(null);
  const aviso = useRef(onCodigo); aviso.current = onCodigo;
  useEffect(() => {
    if (!camara) return;
    let stream, parar = false;
    (async () => {
      try {
        if (!("BarcodeDetector" in window)) { setMsg("Este móvil no lee códigos con la cámara: usa la pistola o escríbelo."); setCamara(false); return; }
        const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        while (!parar) {
          const r = await det.detect(video.current).catch(() => []);
          if (r?.[0]?.rawValue) { const c = String(r[0].rawValue).replace(/\D/g, ""); setCodigo(c); setCamara(false); aviso.current(c); break; }
          await new Promise((s) => setTimeout(s, 250));
        }
      } catch (_) { setMsg("No he podido abrir la cámara."); setCamara(false); }
    })();
    return () => { parar = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camara]);
  // la pistola escribe el código y pulsa Intro; si no, al llegar a 8 o 13 cifras se busca solo
  useEffect(() => {
    if (codigo.length !== 8 && codigo.length !== 13) return;
    const t = setTimeout(() => aviso.current(codigo), 350);
    return () => clearTimeout(t);
  }, [codigo]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={lbl} htmlFor="esc-cod">Código de barras</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input id="esc-cod" autoFocus inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter" && codigo.length >= 6) onCodigo(codigo); }}
          placeholder="Pásale la pistola…" style={{ ...inp, flex: 1, minWidth: 0, letterSpacing: "0.04em" }} />
        <button type="button" aria-label="Escanear con la cámara" onClick={() => setCamara(true)} style={{ ...btnPeq, width: 52, padding: 0, height: 50 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.char} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        </button>
      </div>
      {camara && <video ref={video} muted playsInline style={{ width: "100%", borderRadius: 12, background: "#000" }} />}
      <Aviso msg={msg} />
    </div>
  );
}

// ---------- Escanear producto ----------
export function EscanearProductoView({ onAnadir, onFin }) {
  const [vista, setVista] = useState("buscar"); // buscar | ficha | incidencia | precio | hecho
  const [clave, setClave] = useState(0);
  const [q, setQ] = useState("");
  const [lista, setLista] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [prod, setProd] = useState(null);
  const [porCodigo, setPorCodigo] = useState(null);
  const [hecho, setHecho] = useState(null);
  const [msg, setMsg] = useState("");

  const porNombre = q.trim().length >= 2;
  useEffect(() => {
    if (!porNombre) { setLista(null); return; }
    let vivo = true;
    const t = setTimeout(() => fn("buscar", { q }).then((r) => vivo && setLista(r.productos || [])).catch(() => vivo && setLista([])), 300);
    return () => { vivo = false; clearTimeout(t); };
  }, [q, porNombre]);

  const ultimo = useRef("");
  const leerCodigo = async (codigo) => {
    if (!codigo || ultimo.current === codigo) return;
    ultimo.current = codigo; setMsg(""); setBuscando(true);
    try {
      const r = await fn("buscar", { codigo });
      const ps = r.productos || [];
      if (!ps.length) { onAnadir(codigo); return; } // no existe: «Añadir producto» con el código puesto
      setProd(ps[0]); setPorCodigo(codigo); setVista("ficha");
    } catch (e) { setMsg(e.message || "No he podido buscarlo"); ultimo.current = ""; }
    setBuscando(false);
  };
  const otra = () => { setVista("buscar"); setProd(null); setPorCodigo(null); setHecho(null); setQ(""); setLista(null); setMsg(""); ultimo.current = ""; setClave((k) => k + 1); };

  if (vista === "hecho" && hecho) return (
    <div style={{ ...caja, paddingTop: 30 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        <span style={{ width: 72, height: 72, borderRadius: 999, background: "#EAF4EE", display: "flex", alignItems: "center", justifyContent: "center" }}><IcoCheck size={36} color={C.grn} sw={2.4} /></span>
        <div style={{ fontFamily: SF, fontSize: 24 }}>{hecho.titulo}</div>
        <div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>{hecho.texto}</div>
      </div>
      <button type="button" onClick={otra} style={{ ...btnGhost, minHeight: 48 }}>Escanear otro</button>
      <button type="button" onClick={onFin} style={btnDark}>Volver al inicio</button>
    </div>
  );
  if (vista === "incidencia" && prod) return <><Instrucciones pantalla="incidencia" /><NoEsEste p={prod} codigo={porCodigo} onVolver={() => setVista("ficha")} onListo={() => { setHecho({ titulo: "Incidencia mandada", texto: "Dirección lo revisa y lo corrige." }); setVista("hecho"); }} /></>;
  if (vista === "precio" && prod) return <><Instrucciones pantalla="escanear" /><CambiarPrecio p={prod} onVolver={() => setVista("ficha")} onListo={(r) => { setHecho({ titulo: "Precio cambiado", texto: `${r.nombre}: de ${eur(r.antes)} a ${eur(r.pvp)}. Ya está en la caja y dirección lo revisa.` }); setVista("hecho"); }} /></>;
  if (vista === "ficha" && prod) return (
    <div style={caja}>
      <Instrucciones pantalla="escanear" sinMargen />
      <div style={card}>
        <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>{porCodigo ? `Código ${porCodigo}` : "Buscado por nombre"}</div>
        <div style={{ fontFamily: F, fontSize: 18, fontWeight: 700, color: C.char }}>{prod.nombre}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: SF, fontSize: 30, color: C.char }}>{eur(prod.pvp)}</span>
          {prod.precio_marcado != null && <span style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0DA", color: "#7A5410" }}>Precio marcado</span>}
        </div>
        <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>{prod.proveedor ? `Proveedor: ${prod.proveedor}` : "Sin proveedor"}</div>
      </div>
      <button type="button" onClick={otra} style={{ ...btnDark, background: C.grn, color: "#fff" }}>Es este</button>
      {porCodigo && <button type="button" onClick={() => setVista("incidencia")} style={{ ...btnDark, background: "#fff", color: "#A3362B", border: `1.5px solid ${C.red}` }}>No es este producto</button>}
      <button type="button" onClick={() => setVista("precio")} style={{ ...btnDark, background: "#fff", color: C.char, border: `1.5px solid ${C.brd}` }}>Cambiar precio</button>
    </div>
  );

  return (
    <div style={caja}>
      <Instrucciones pantalla="escanear" sinMargen />
      <LectorCodigo key={clave} onCodigo={leerCodigo} />
      {buscando && <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Buscando…</div>}
      <Aviso msg={msg} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}><span style={{ flex: 1, height: 1, background: C.brdL }} /><span style={{ fontFamily: F, fontSize: 12, color: C.mutL }}>o búscalo por su nombre</span><span style={{ flex: 1, height: 1, background: C.brdL }} /></div>
      <label style={{ position: "absolute", left: -9999 }} htmlFor="esc-nombre">Buscar por nombre</label>
      <input id="esc-nombre" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Por ejemplo: oferta Bimbo" style={inp} />
      {porNombre && (lista === null ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Buscando…</div> : lista.length === 0 ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>No encuentro nada con ese nombre.</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lista.map((p) => (
            <button key={p.id} type="button" onClick={() => { setProd(p); setPorCodigo(null); setVista("ficha"); }} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "10px 12px", minHeight: 48, fontFamily: F, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.char }}>{p.nombre}</span><span style={{ display: "block", fontSize: 11.5, color: C.mut }}>{[eur(p.pvp), p.proveedor, p.barcode ? null : "sin código"].filter(Boolean).join(" · ")}</span></span>
              <IcoRight size={16} color={C.mut} />
            </button>
          ))}
        </div>
      ))}
      <button type="button" onClick={() => onAnadir("")} style={{ background: "none", border: "none", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#4A4236", textDecoration: "underline", padding: 10, cursor: "pointer" }}>No está: dar de alta un producto nuevo</button>
    </div>
  );
}

// ---------- No es este producto (la incidencia de código de siempre) ----------
function NoEsEste({ p, codigo, onVolver, onListo }) {
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const input = useRef(null);
  const mandar = async () => {
    setBusy(true); setMsg("");
    try { await fnRec("incidencia_codigo", { codigo, texto, foto }); onListo(); }
    catch (e) { setMsg(e.message || "No se ha podido mandar"); }
    setBusy(false);
  };
  return (
    <div style={caja}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 22 }}>No es este producto</div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>El código {codigo} sale como «{p.nombre}»</div>
        </div>
        <button type="button" onClick={onVolver} style={{ ...btnPeq, height: 38 }}>Volver</button>
      </div>
      <div style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>Se lo mando a dirección para que lo corrija.</div>
      <label style={lbl} htmlFor="ne-txt">¿Qué producto es? (opcional)</label>
      <input id="ne-txt" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre que trae el envase" style={{ ...inp, marginTop: -6 }} />
      <input ref={input} type="file" accept="image/*" capture="environment" style={{ display: "none" }} aria-hidden="true" tabIndex={-1}
        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setFoto(await prepararFoto(f)); } catch (er) { setMsg(er.message); } }} />
      <button type="button" onClick={() => input.current?.click()} style={{ height: 46, borderRadius: 12, border: "1.5px dashed #C9C0B0", background: "transparent", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#4A4236", cursor: "pointer" }}>{foto ? "Foto añadida ✓ (cambiar)" : "Añadir foto"}</button>
      <Aviso msg={msg} />
      <button type="button" disabled={busy} onClick={mandar} style={{ ...btnDark, background: C.red, color: "#fff", opacity: busy ? 0.6 : 1 }}>{busy ? "Mandando…" : "Mandar incidencia"}</button>
    </div>
  );
}

// ---------- Cambiar precio (Editar producto) ----------
function CambiarPrecio({ p, onVolver, onListo }) {
  const [motivos, setMotivos] = useState(null);
  const [sel, setSel] = useState(null); // id del motivo o "nuevo"
  const [nuevoMotivo, setNuevoMotivo] = useState("");
  const [precio, setPrecio] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { fn("motivos").then((r) => setMotivos(r.motivos || [])).catch((e) => { setMsg(e.message); setMotivos([]); }); }, []);
  const m = (motivos || []).find((x) => x.id === sel);
  const marcado = !!m?.es_marcado;
  const valor = numero(precio);
  const listo = sel && (sel !== "nuevo" || nuevoMotivo.trim().length >= 3) && valor > 0 && (marcado || Math.abs(valor - p.pvp) >= 0.005);
  const guardar = async () => {
    setBusy(true); setMsg("");
    try {
      const datos = { product_id: p.id, ...(sel === "nuevo" ? { motivo_nuevo: nuevoMotivo.trim() } : { motivo_id: sel }), ...(marcado ? { precio_marcado: valor } : { pvp: valor }) };
      onListo(await fn("cambiar_precio", datos));
    } catch (e) { setMsg(e.message || "No se ha podido cambiar el precio"); }
    setBusy(false);
  };
  const opcion = (id, texto) => {
    const on = sel === id;
    return (
      <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setSel(id)}
        style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", minHeight: 48, padding: "10px 14px", borderRadius: 14, cursor: "pointer", fontFamily: F, fontSize: 14.5, fontWeight: 600, border: on ? `2px solid ${C.char}` : `1.5px solid ${C.brd}`, background: on ? "#F6F1E6" : "#fff", color: C.char }}>
        <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${on ? C.char : C.brd}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <span style={{ width: 8, height: 8, borderRadius: 999, background: C.char }} />}</span>
        {texto}
      </button>
    );
  };
  return (
    <div style={caja}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 22 }}>Cambiar precio</div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{p.nombre} · en la caja: {eur(p.pvp)}</div>
        </div>
        <button type="button" onClick={onVolver} style={{ ...btnPeq, height: 38 }}>Volver</button>
      </div>
      <div style={lbl}>Motivo</div>
      {motivos === null ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Cargando…</div> : (
        <div role="radiogroup" aria-label="Motivo del cambio" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: -4 }}>
          {motivos.map((x) => opcion(x.id, x.nombre))}
          {opcion("nuevo", "Añadir motivo")}
        </div>
      )}
      {sel === "nuevo" && <>
        <label style={lbl} htmlFor="cp-mot">Escribe el motivo</label>
        <input id="cp-mot" value={nuevoMotivo} onChange={(e) => setNuevoMotivo(e.target.value)} maxLength={80} placeholder="Por ejemplo: oferta del proveedor" style={{ ...inp, marginTop: -6 }} />
        <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: -4 }}>Queda guardado en la lista para las siguientes veces.</div>
      </>}
      {sel && <>
        <label style={lbl} htmlFor="cp-pvp">{marcado ? "Precio marcado en el envase (€)" : "Nuevo precio de venta (€)"}</label>
        <input id="cp-pvp" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0,00" style={{ ...inp, marginTop: -6, fontSize: 20, fontWeight: 700 }} />
        {marcado && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: -4 }}>Ese será el precio en la caja y queda guardado como precio marcado.</div>}
        {valor > 0 && Math.abs(valor - p.pvp) >= 0.005 && <div style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>En la caja pasa de <b>{eur(p.pvp)}</b> a <b>{eur(valor)}</b>.</div>}
        {valor > 0 && Math.abs(valor - p.pvp) < 0.005 && <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>{marcado ? "Es el mismo precio que la caja: solo se guarda como precio marcado." : "Es el mismo precio que ya tiene la caja."}</div>}
      </>}
      <Aviso msg={msg} />
      <button type="button" disabled={!listo || busy} onClick={guardar} style={{ ...btnDark, opacity: !listo || busy ? 0.5 : 1, cursor: !listo || busy ? "default" : "pointer" }}>{busy ? "Guardando en la caja…" : "Guardar precio"}</button>
      <div style={{ fontFamily: F, fontSize: 12, color: C.mut }}>El precio cambia en la caja al momento. Queda apuntado quién lo cambia y por qué, y dirección lo revisa.</div>
    </div>
  );
}

// ---------- #72 · Comprobar precio marcado: dirección manda productos a mirar en tienda ----------
export function ComprobarMarcadoView({ onTerminar }) {
  const [lista, setLista] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [hecho, setHecho] = useState(null);
  const [msg, setMsg] = useState("");
  const cargar = () => fn("marcado_lista").then((r) => setLista(r.productos || [])).catch((e) => { setMsg(e.message || "No he podido cargar la lista"); setLista([]); });
  useEffect(() => { cargar(); }, []);
  if (abierto) return <><Instrucciones pantalla="marcado" /><ResponderMarcado p={abierto} onVolver={() => setAbierto(null)} onListo={(t) => { setAbierto(null); setHecho(t); cargar(); }} /></>;
  return (
    <div style={caja}>
      <Instrucciones pantalla="marcado" sinMargen />
      <div style={{ fontFamily: F, fontSize: 13.5, color: C.mut }}>Dirección quiere saber si estos productos traen el precio marcado en el envase. Búscalos en la estantería y di lo que ves.</div>
      <Aviso msg={hecho} tipo="bien" />
      <Aviso msg={msg} />
      {lista === null ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut }}>Cargando…</div> : lista.length === 0 ? (
        <div style={{ ...card, alignItems: "center", textAlign: "center" }}>
          <IcoCheck size={30} color={C.grn} sw={2.4} />
          <div style={{ fontFamily: F, fontSize: 14.5, color: C.char, fontWeight: 600 }}>No hay nada que comprobar</div>
        </div>
      ) : lista.map((p) => (
        <button key={p.id} type="button" onClick={() => { setHecho(null); setAbierto(p); }} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "12px 14px", minHeight: 56, fontFamily: F, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: C.char }}>{p.nombre}</span>
            <span style={{ display: "block", fontSize: 12.5, color: C.mut }}>{[p.barcode || "sin código", p.proveedor, `en caja ${eur(p.pvp)}`].filter(Boolean).join(" · ")}</span>
          </span>
          <IcoRight size={16} color={C.mut} />
        </button>
      ))}
      <button type="button" onClick={onTerminar} style={{ ...btnGhost, minHeight: 48 }}>Volver al inicio</button>
    </div>
  );
}

function ResponderMarcado({ p, onVolver, onListo }) {
  const [tiene, setTiene] = useState(null); // true | false
  const [precio, setPrecio] = useState("");
  const [foto, setFoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const input = useRef(null);
  const valor = numero(precio);
  const lejos = valor > 0 && p.pvp > 0 && Math.abs(valor - p.pvp) / p.pvp > 0.3;
  const mandar = async () => {
    if (tiene && !(valor > 0)) { setMsg("Escribe el precio que trae la etiqueta"); return; }
    if (tiene && lejos && !window.confirm(`El precio marcado (${eur(valor)}) es muy distinto del de la caja (${eur(p.pvp)}). ¿Lo has escrito bien?`)) return;
    setBusy(true); setMsg("");
    try {
      const r = await fn("marcado_responder", { id: p.id, marcado: !!tiene, precio: tiene ? valor : null, foto: tiene ? foto : null });
      onListo(tiene ? `${r.nombre}: precio ${eur(r.pvp)} puesto en la caja.` : `${r.nombre}: avisado a dirección de que no trae precio marcado.`);
    } catch (e) { setMsg(e.message || "No se ha podido guardar"); }
    setBusy(false);
  };
  const opcion = (v, texto) => (
    <button type="button" role="radio" aria-checked={tiene === v} onClick={() => { setTiene(v); setMsg(""); }}
      style={{ minHeight: 52, padding: "10px 14px", borderRadius: 14, cursor: "pointer", fontFamily: F, fontSize: 15, fontWeight: 700, textAlign: "left", border: tiene === v ? `2px solid ${C.char}` : `1.5px solid ${C.brd}`, background: tiene === v ? "#F6F1E6" : "#fff", color: C.char }}>{texto}</button>
  );
  return (
    <div style={caja}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SF, fontSize: 22 }}>{p.nombre}</div>
          <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{[p.barcode || "sin código", p.proveedor].filter(Boolean).join(" · ")}</div>
          <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, marginTop: 4 }}>En la caja: <b>{eur(p.pvp)}</b></div>
        </div>
        <button type="button" onClick={onVolver} style={{ ...btnPeq, height: 38 }}>Volver</button>
      </div>
      <div role="radiogroup" aria-label="¿Trae precio marcado?" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {opcion(true, "Tiene precio marcado")}
        {opcion(false, "No tiene precio marcado")}
      </div>
      {tiene === true && <>
        <label style={lbl} htmlFor="pm-precio">Precio de la etiqueta (€)</label>
        <input id="pm-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0,00" style={{ ...inp, marginTop: -6, fontSize: 20, fontWeight: 700 }} />
        {valor > 0 && <div style={{ fontFamily: F, fontSize: 13.5, color: lejos ? "#A3362B" : C.char }}>{Math.abs(valor - p.pvp) < 0.005 ? "Es el mismo precio que la caja: queda guardado como precio marcado." : <>En la caja pasa de <b>{eur(p.pvp)}</b> a <b>{eur(valor)}</b>.{lejos ? " Ojo: es muy distinto, revisa que esté bien escrito." : ""}</>}</div>}
        <input ref={input} type="file" accept="image/*" capture="environment" style={{ display: "none" }} aria-hidden="true" tabIndex={-1}
          onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { setFoto(await prepararFoto(f)); } catch (er) { setMsg(er.message); } }} />
        <button type="button" onClick={() => input.current?.click()} style={{ height: 46, borderRadius: 12, border: "1.5px dashed #C9C0B0", background: "transparent", fontFamily: F, fontSize: 13.5, fontWeight: 600, color: "#4A4236", cursor: "pointer" }}>{foto ? "Foto añadida ✓ (cambiar)" : "Foto de la etiqueta (opcional)"}</button>
      </>}
      {tiene === false && <div style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>Se lo devuelvo a dirección para que decida el precio. En la caja no cambia nada.</div>}
      <Aviso msg={msg} />
      <button type="button" disabled={tiene === null || busy || (tiene && !(valor > 0))} onClick={mandar} style={{ ...btnDark, opacity: tiene === null || busy || (tiene && !(valor > 0)) ? 0.5 : 1 }}>{busy ? "Guardando…" : tiene ? "Poner este precio en la caja" : "Mandar a dirección"}</button>
    </div>
  );
}
