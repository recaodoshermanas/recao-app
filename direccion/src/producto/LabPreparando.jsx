// Producto · Lab (#216): fase «Preparando» (análisis + conseguir proveedor) y vista «Distribuidores y catálogos».
// El análisis y las propuestas los rellena el agente de producto (tarea programada de Claude); aquí se ven, se editan y se lanzan los contactos.
// Correos: se dejan «En cola» y los envía el agente desde el Gmail de Recao. WhatsApp: se abre wa.me a mano y la respuesta se anota a mano.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Pestanas, avisar, hace } from "../ui.jsx";

const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };

export const MOTIVOS_DESCARTE = [
  ["grandes_superficies", "Ya está en grandes superficies"], ["precio", "No competimos en precio"], ["equipo", "Necesita equipo que no tenemos"],
  ["tendencia", "Tendencia pasada"], ["clientela", "No encaja con la clientela"], ["sin_proveedor", "No hay proveedor"],
];
export const RECOMENDACIONES = ["Probar en el Lab", "Replicar con obrador", "Encargar al obrador", "Observar", "Descartar por ahora"];
const PUNTOS = [["diferenciacion", "Diferenciación", "¿Está en súper o cadenas?"], ["precio", "Precio", "Referencia más barata vista"], ["necesita", "Qué necesita", "Congelador, frío, expositor…"],
  ["condiciones", "Condiciones del proveedor", "Mínimo, plazo, caducidad, etiqueta en español"], ["clientela", "Encaje con la clientela", ""], ["temporada", "Temporada", ""]];
const SEM = { bien: ["Bien", "rgba(49,112,57,.13)", "#1E4A25"], ojo: ["Ojo", "rgba(241,190,73,.28)", "#6B4A00"], mal: ["Mal", "rgba(178,65,42,.12)", "#8A2E1C"], sin_datos: ["Sin datos", "#EEECE6", "#4E5961"] };
const RECO_K = { "Probar en el Lab": "bien", "Replicar con obrador": "ojo", "Encargar al obrador": "bien", Observar: "ojo", "Descartar por ahora": "mal" };
export const ESTADOS_C = { en_cola: ["En cola", "ojo"], esperando: ["Esperando", "ojo"], respondido: ["Respondido", "info"], sin_respuesta: ["Sin respuesta", "sin_datos"], es_proveedor: ["Es el proveedor", "bien"], descartado: ["Descartado", "sin_datos"] };
const PROB = { alta: "bien", media: "ojo", baja: "sin_datos" };

function Chip({ k, children }) {
  const c = k === "info" ? [null, "rgba(35,54,94,.10)", "#23365E"] : SEM[k] || SEM.sin_datos;
  return <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", background: c[1], color: c[2] }}>{children}</span>;
}
const EstadoC = ({ e }) => <Chip k={(ESTADOS_C[e] || ["", "sin_datos"])[1]}>{(ESTADOS_C[e] || [e])[0]}</Chip>;
const canalT = (c) => (c === "whatsapp" ? "WhatsApp" : "Correo");
const rellenar = (t, nombre, enlace) => String(t || "").replaceAll("[producto]", nombre || "").replaceAll("[enlace]", enlace || "");
const waUrl = (tel, txt) => `https://wa.me/${tel}?text=${encodeURIComponent(txt)}`;

export function faltaProgramar(f) {
  const falta = [];
  if (!String(f.proveedor || "").trim()) falta.push("proveedor");
  if (f.pvp_elegido === "" || f.pvp_elegido == null) falta.push("PVP");
  if (!f.f_lanzamiento) falta.push("fecha de lanzamiento");
  return falta;
}

// Abre WhatsApp en una pestaña nueva (se abre antes de esperar a la base de datos para que el navegador no la bloquee)
async function abrirWhatsApp(tel, txt, crear) {
  const w = window.open("", "_blank");
  try { await crear(); if (w) w.location.href = waUrl(tel, txt); else window.location.href = waUrl(tel, txt); return true; }
  catch (e) { if (w) w.close(); avisar(msg(e), "mal"); return false; }
}

// ───────────────────────── Ficha en Preparando ─────────────────────────
export function Preparando({ id, f, setF, modo, guardando, onProgramar, onDescartar, onCambio }) {
  const [d, setD] = useState(null);
  const [an, setAn] = useState(undefined); // análisis guardado
  const [editAn, setEditAn] = useState(null);
  const [wa, setWa] = useState(null); // { supplier_id, tel, texto }
  const [verPl, setVerPl] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const fabricar = modo === "fabricar";
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const cargar = useCallback(async () => {
    try {
      const [datos, r] = await Promise.all([sb.rpc("lab_preparar_datos", { p_id: id }), sb.select("lab_pruebas", `select=analisis,analisis_en,preparar_pedido_en&id=eq.${id}`)]);
      setD(datos); setAn(r[0] || {});
    } catch (e) { avisar(msg(e), "mal"); setD((x) => x || { proveedores: [], distribuidores: [], contactos: [], plantillas: {} }); setAn((x) => x || {}); }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d || an === undefined) return <Cargando />;

  const a = an.analisis;
  const pl = d.plantillas || {};
  const guardarAn = async () => {
    try { await sb.update("lab_pruebas", `id=eq.${id}`, { analisis: editAn }); setEditAn(null); avisar("Análisis guardado"); cargar(); } catch (e) { avisar(msg(e), "mal"); }
  };
  const empezarEditar = () => {
    const base = a || {};
    setEditAn({ ...base, recomendacion: base.recomendacion || "", texto: base.texto || "",
      puntos: PUNTOS.map(([k]) => ({ clave: k, valor: "", semaforo: "sin_datos", nota: "", ...((base.puntos || []).find((x) => x.clave === k) || {}) })) });
  };
  const crearContacto = (args) => sb.rpc("lab_contacto_crear", { p_prueba: id, p_distribuidor: null, p_supplier: null, p_mensaje: null, ...args });
  const enviarWa = async () => {
    const ok = await abrirWhatsApp(wa.tel, wa.texto, () => crearContacto({ p_supplier: wa.supplier_id, p_canal: "whatsapp", p_tipo: fabricar ? "obrador" : "producto", p_mensaje: wa.texto }));
    if (ok) { setWa(null); avisar("Contacto anotado como «Esperando». La respuesta se anota a mano en Contactos."); cargar(); onCambio(); }
  };
  const enviarCorreo = async (dist) => {
    setOcupado(true);
    try { await crearContacto({ p_distribuidor: dist.id, p_canal: "correo", p_tipo: "producto" }); avisar(`Correo a ${dist.nombre} en cola: lo envía el agente en su próxima pasada.`); cargar(); onCambio(); }
    catch (e) { avisar(msg(e), "mal"); } finally { setOcupado(false); }
  };
  const faltanCat = d.distribuidores.filter((x) => x.catalogo_estado !== "recibido" && !x.catalogo_pedido);
  const pedirCatalogos = async () => {
    setOcupado(true);
    let n = 0;
    for (const x of faltanCat) { try { await sb.rpc("lab_contacto_crear", { p_prueba: null, p_distribuidor: x.id, p_supplier: null, p_canal: "correo", p_tipo: "catalogo", p_mensaje: null }); n++; } catch (e) { avisar(msg(e), "mal"); } }
    setOcupado(false); if (n) avisar(`Catálogo pedido a ${n} distribuidor${n === 1 ? "" : "es"}.`); cargar();
  };
  const falta = faltaProgramar(f);
  const cat = a?.catalogos;

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {/* a. Análisis */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <h3>Análisis</h3>
        {!editAn && <button className="btn-txt" onClick={empezarEditar}>{a ? "Editar análisis" : "Escribirlo a mano"}</button>}
      </div>
      {editAn ? (
        <div className="card" style={{ background: "var(--bg)", padding: 12 }}>
          <div className="fila-campos">
            <label className="campo">Recomendación<select value={editAn.recomendacion} onChange={(e) => setEditAn({ ...editAn, recomendacion: e.target.value })}><option value="">–</option>{RECOMENDACIONES.map((r) => <option key={r}>{r}</option>)}</select></label>
          </div>
          <label className="campo">Por qué<textarea rows={2} value={editAn.texto} onChange={(e) => setEditAn({ ...editAn, texto: e.target.value })} /></label>
          {editAn.puntos.map((pt, i) => {
            const cambia = (k) => (e) => setEditAn({ ...editAn, puntos: editAn.puntos.map((y, j) => (j === i ? { ...y, [k]: e.target.value } : y)) });
            return (
              <div key={pt.clave} className="fila-campos">
                <label className="campo">{PUNTOS[i][1]}<input value={pt.valor} onChange={cambia("valor")} placeholder={PUNTOS[i][2]} /></label>
                <label className="campo">Semáforo<select value={pt.semaforo} onChange={cambia("semaforo")}>{Object.entries(SEM).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></label>
                <label className="campo">Nota<input value={pt.nota} onChange={cambia("nota")} /></label>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8 }}><button className="btn-p" onClick={guardarAn}>Guardar análisis</button><button className="btn-l" onClick={() => setEditAn(null)}>Cancelar</button></div>
        </div>
      ) : !a ? (
        <p className="sub">El agente de producto está preparando el análisis{an.preparar_pedido_en ? ` (pedido ${hace(an.preparar_pedido_en)})` : ""}. Saldrá aquí con la recomendación y las propuestas de a quién preguntar.</p>
      ) : (
        <>
          {a.recomendacion && (
            <div style={{ background: (SEM[RECO_K[a.recomendacion]] || SEM.sin_datos)[1], color: (SEM[RECO_K[a.recomendacion]] || SEM.sin_datos)[2], borderRadius: 12, padding: "12px 14px" }}>
              <b>{a.recomendacion}</b>{a.texto && <div style={{ marginTop: 4 }}>{a.texto}</div>}
            </div>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0", display: "grid", gap: 8 }}>
            {PUNTOS.map(([k, label]) => {
              const pt = (a.puntos || []).find((x) => x.clave === k) || { semaforo: "sin_datos" };
              const s = SEM[pt.semaforo] || SEM.sin_datos;
              return (
                <li key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: 99, marginTop: 5, flex: "none", background: s[2] }} />
                  <div><b>{label}</b> <Chip k={pt.semaforo}>{pt.valor || s[0]}</Chip>{pt.nota && <small className="pf">{pt.nota}</small>}</div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* b. Conseguir proveedor / Buscar obrador */}
      <h3>{fabricar ? "Buscar obrador" : "Conseguir proveedor"}</h3>
      {!fabricar && <>
        <h4 style={{ margin: "4px 0" }}>1 · Catálogos guardados</h4>
        <p className="sub" style={{ marginTop: 0 }}>{cat?.texto ? `${cat.encontrado ? "✓ " : "— "}${cat.texto}` : d.n_catalogos ? `El agente lo buscará en los ${d.n_catalogos} catálogos guardados.` : "Aún no hay catálogos guardados."}</p>
      </>}

      <h4 style={{ margin: "4px 0" }}>{fabricar ? "1 · Preguntar a un obrador nuestro" : "2 · Preguntar a un proveedor nuestro"}</h4>
      {!d.proveedores.length ? <p className="sub" style={{ marginTop: 0 }}>{a ? "El agente no ha propuesto ninguno." : "Los propone el agente al hacer el análisis."}</p> : (
        <ul className="movers">{d.proveedores.map((x) => {
          const plantilla = pl[fabricar ? "wa_obrador" : "wa_proveedor"]?.texto;
          const abierto = wa && wa.supplier_id === x.supplier_id;
          return (
            <li key={x.supplier_id || x.nombre} style={{ padding: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}><b>{x.nombre}</b> {x.probabilidad && <Chip k={PROB[x.probabilidad]}>Probabilidad {x.probabilidad}</Chip>}{x.motivo && <small className="pf">{x.motivo}</small>}</div>
                {x.contacto ? <EstadoC e={x.contacto.estado} />
                  : !x.supplier_id ? <small className="pf">No es un proveedor de Epos</small>
                  : !x.tel ? <small className="pf">Sin teléfono · añadirlo en Pedidos</small>
                  : !abierto && <button className="btn-p" onClick={() => setWa({ supplier_id: x.supplier_id, tel: x.tel, texto: rellenar(plantilla, f.nombre, f.fuente_url) })}>WhatsApp</button>}
              </div>
              {abierto && (
                <div style={{ marginTop: 8 }}>
                  <label className="campo">Mensaje (se puede cambiar antes de abrir)<textarea rows={4} value={wa.texto} onChange={(e) => setWa({ ...wa, texto: e.target.value })} /></label>
                  <div style={{ display: "flex", gap: 8 }}><button className="btn-p" onClick={enviarWa}>Abrir WhatsApp</button><button className="btn-l" onClick={() => setWa(null)}>Cancelar</button></div>
                </div>
              )}
            </li>
          );
        })}</ul>
      )}

      {!fabricar && <>
        <h4 style={{ margin: "8px 0 4px" }}>3 · Escribir al distribuidor encontrado</h4>
        {!d.distribuidores.length ? <p className="sub" style={{ marginTop: 0 }}>{a ? "El agente no ha encontrado distribuidores para este producto." : "Los propone el agente al hacer el análisis."}</p> : (
          <ul className="movers">{d.distribuidores.map((x) => (
            <li key={x.id} style={{ padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}><b>{x.nombre}</b>{x.tipo && <small className="pf">{x.tipo}</small>}{x.motivo && <small className="pf">{x.motivo}</small>}{!x.correo && !x.contacto && <small className="pf">Sin correo guardado: el agente lo busca antes de enviar.</small>}</div>
              {x.contacto ? <EstadoC e={x.contacto.estado} /> : <button className="btn-p" disabled={ocupado} onClick={() => enviarCorreo(x)}>Enviar correo</button>}
            </li>
          ))}</ul>
        )}
        <button className="btn-txt" style={{ justifySelf: "start" }} onClick={() => setVerPl(!verPl)}>{verPl ? "Ocultar plantilla" : "Ver plantilla"}</button>
        {verPl && <pre style={{ whiteSpace: "pre-wrap", background: "var(--bg)", padding: 12, borderRadius: 10, fontFamily: "inherit", fontSize: 13.5, margin: 0 }}>{`Asunto: ${rellenar(pl.correo_distribuidor?.asunto, f.nombre)}\n\n${rellenar(pl.correo_distribuidor?.texto, f.nombre, f.fuente_url)}`}</pre>}
        <p className="sub">Los correos salen sin revisión desde el Gmail de Recao (etiqueta «Producto»), con un tope diario. Nunca se escribe dos veces al mismo por la misma prueba.</p>

        <h4 style={{ margin: "8px 0 4px" }}>4 · Pedir catálogo</h4>
        {!d.distribuidores.length ? <p className="sub" style={{ marginTop: 0 }}>No hay distribuidores de esta categoría todavía.</p>
          : !faltanCat.length ? <p className="sub" style={{ marginTop: 0 }}>Todos los distribuidores de esta prueba ya tienen el catálogo mandado o pedido.</p>
          : <button className="btn-l" style={{ justifySelf: "start" }} disabled={ocupado} onClick={pedirCatalogos}>Pedir catálogo a {faltanCat.length} distribuidor{faltanCat.length === 1 ? "" : "es"}</button>}
      </>}

      {/* c. Contactos de esta prueba */}
      <h3>Contactos de esta prueba</h3>
      {!d.contactos.length ? <p className="sub" style={{ marginTop: 0 }}>Todavía no se ha preguntado a nadie.</p> : (
        <div className="tabla-scroll"><table className="ranking">
          <thead><tr><th>A quién</th><th>Canal</th><th>Cuándo</th><th>Estado</th><th>Respuesta</th></tr></thead>
          <tbody>{d.contactos.map((c) => (
            <tr key={c.id}><td>{c.quien}</td><td>{canalT(c.canal)}</td><td>{hace(c.enviado_en || c.creado_en)}</td><td><EstadoC e={c.estado} /></td>
              <td>{c.respuesta || <span className="pf">{c.estado === "en_cola" ? "Lo envía el agente" : c.canal === "whatsapp" ? "Se anota a mano en Distribuidores y catálogos → Contactos" : "Sin respuesta todavía"}</span>}</td></tr>
          ))}</tbody>
        </table></div>
      )}

      {/* d. Precio, pedido y lanzamiento */}
      <h3>Precio, pedido y lanzamiento</h3>
      <div className="fila-campos">
        <label className="campo">Proveedor elegido<input value={f.proveedor} onChange={set("proveedor")} placeholder="O «Es el proveedor» en un contacto" /></label>
        <label className="campo">PVP elegido (€)<input inputMode="decimal" value={f.pvp_elegido} onChange={set("pvp_elegido")} /></label>
        <label className="campo">Pedido inicial (unidades)<input inputMode="decimal" value={f.pedido_inicial_uds} onChange={set("pedido_inicial_uds")} /></label>
        <label className="campo">Fecha de lanzamiento<input type="date" value={f.f_lanzamiento} onChange={set("f_lanzamiento")} /></label>
      </div>
      <p className="sub" style={{ marginTop: 0 }}>Las referencias de precio (coste con 35 %, mercado y producto parecido) están más abajo, en «Precio».</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn-p" disabled={guardando || falta.length > 0} onClick={onProgramar}>Pasar a Programado</button>
        <span className="sub">{falta.length ? `Falta: ${falta.join(", ")}.` : "Todo listo: saldrá en el calendario con su fecha."}</span>
      </div>
      <div className="fila-campos" style={{ marginTop: 12 }}>
        <label className="campo">Motivo para descartar<select value={f.motivo_descarte_tipo} onChange={set("motivo_descarte_tipo")}><option value="">–</option>{MOTIVOS_DESCARTE.map(([i, t]) => <option key={i} value={i}>{t}</option>)}</select></label>
        <label className="campo">Detalle (opcional)<input value={f.motivo_descarte} onChange={set("motivo_descarte")} /></label>
      </div>
      <button className="btn-l" style={{ justifySelf: "start" }} disabled={guardando} onClick={onDescartar}>Descartar</button>
    </div>
  );
}

// ───────────────────────── Vista «Distribuidores y catálogos» ─────────────────────────
export function Distribuidores({ lista, onAbrir }) {
  const [sub, setSub] = useState("dist");
  return (
    <div className="card mt">
      <Pestanas etiqueta="Apartado" valor={sub} onChange={setSub} opciones={[{ id: "dist", label: "Distribuidores" }, { id: "contactos", label: "Contactos" }, { id: "reglas", label: "Reglas y plantillas" }]} />
      {sub === "dist" && <DistLista />}
      {sub === "contactos" && <Contactos lista={lista} onAbrir={onAbrir} />}
      {sub === "reglas" && <Reglas />}
    </div>
  );
}

const ORIGEN = { proveedor: ["Nuestro proveedor", "bien"], busqueda: ["Búsqueda", "info"], respuesta: ["Respuesta", "info"] };
const CAT = { recibido: ["Catálogo recibido", "bien"], pedido: ["Catálogo pedido", "ojo"], sin: ["Sin catálogo", "sin_datos"] };

function DistLista() {
  const [l, setL] = useState(null);
  const [q, setQ] = useState(""); const [res, setRes] = useState(null);
  const [pl, setPl] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [verProv, setVerProv] = useState(false);
  const cargar = useCallback(() => { sb.rpc("lab_distribuidores_lista").then(setL).catch((e) => { avisar(msg(e), "mal"); setL([]); }); }, []);
  useEffect(() => { cargar(); sb.rpc("lab_reglas").then((r) => setPl(Object.fromEntries((r.plantillas || []).map((t) => [t.clave, t])))).catch(() => {}); }, [cargar]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => sb.rpc("lab_quien_lleva", { p_q: q }).then(setRes).catch(() => setRes([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  if (!l) return <Cargando />;
  const dists = l.filter((x) => x.id);
  const nuestros = l.filter((x) => !x.id);
  const faltan = dists.filter((x) => x.catalogo_estado === "sin");
  const pedir = async (x) => {
    if (x.id) {
      setOcupado(true);
      try { await sb.rpc("lab_contacto_crear", { p_prueba: null, p_distribuidor: x.id, p_supplier: null, p_canal: "correo", p_tipo: "catalogo", p_mensaje: null }); avisar(`Catálogo pedido a ${x.nombre}: el correo lo envía el agente.`); cargar(); }
      catch (e) { avisar(msg(e), "mal"); } finally { setOcupado(false); }
    } else {
      const txt = pl.correo_catalogo?.texto || "Hola, somos Recao (Dos Hermanas). ¿Nos podéis enviar vuestro catálogo actualizado? ¡Gracias!";
      if (await abrirWhatsApp(x.tel, txt, () => sb.rpc("lab_contacto_crear", { p_prueba: null, p_distribuidor: null, p_supplier: x.supplier_id, p_canal: "whatsapp", p_tipo: "catalogo", p_mensaje: txt }))) { avisar("Petición anotada como «Esperando»."); cargar(); }
    }
  };
  const pedirFaltan = async () => {
    setOcupado(true); let n = 0;
    for (const x of faltan) { try { await sb.rpc("lab_contacto_crear", { p_prueba: null, p_distribuidor: x.id, p_supplier: null, p_canal: "correo", p_tipo: "catalogo", p_mensaje: null }); n++; } catch (e) { avisar(msg(e), "mal"); } }
    setOcupado(false); if (n) avisar(`Catálogo pedido a ${n} distribuidor${n === 1 ? "" : "es"}.`); cargar();
  };
  const tarjeta = (x) => {
    const o = ORIGEN[x.origen] || ORIGEN.busqueda, c = CAT[x.catalogo_estado] || CAT.sin;
    return (
      <div key={`${x.id}-${x.supplier_id}`} className="card" style={{ padding: 12, display: "grid", gap: 6, alignContent: "start" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><b>{x.nombre}</b><Chip k={o[1]}>{o[0]}</Chip></div>
        {x.tipo && <small className="pf">{x.tipo}</small>}
        {x.marcas?.length > 0 ? <small>{x.marcas.join(" · ")}</small> : x.n_productos > 0 && <small className="pf">{x.n_productos} productos en Epos</small>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Chip k={c[1]}>{c[0]}{x.catalogo_fecha ? ` · ${new Date(`${x.catalogo_fecha}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : ""}</Chip>
          {x.catalogo_estado === "sin" && (x.id ? <button className="btn-l" disabled={ocupado} onClick={() => pedir(x)}>Pedir catálogo</button>
            : x.tel ? <button className="btn-l" onClick={() => pedir(x)}>Pedir catálogo (WhatsApp)</button> : <small className="pf">Sin teléfono · añadirlo en Pedidos</small>)}
        </div>
      </div>
    );
  };
  return (
    <>
      <label className="campo" style={{ marginTop: 12 }}>¿Quién lleva…? (marca o producto)<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Por ejemplo: Oreo" /></label>
      {res && (!res.length ? <p className="sub">Nadie de la lista lo lleva (ni en los productos de Epos de nuestros proveedores ni en las marcas de los catálogos leídos).</p> : (
        <ul className="movers">{res.map((r) => <li key={`${r.supplier_id}-${r.distribuidor_id}`} style={{ padding: "6px 0" }}><b>{r.nombre}</b> <small className="pf">{r.fuente}{r.fuente === "proveedor nuestro" ? ` · ${r.n} producto${r.n === 1 ? "" : "s"} en Epos` : ""}{r.ejemplos?.length ? `: ${r.ejemplos.join(", ")}` : ""}</small></li>)}</ul>
      ))}
      <div className="head" style={{ marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Distribuidores ({dists.length})</h3>
        {faltan.length > 0 && <button className="btn-p" disabled={ocupado} onClick={pedirFaltan}>Pedir catálogo a los que faltan ({faltan.length})</button>}
      </div>
      {!dists.length ? <p className="sub">Todavía no hay distribuidores: los añade el agente de producto al buscar proveedor para las pruebas en Preparando.</p>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginTop: 8 }}>{dists.map(tarjeta)}</div>}
      <div className="head" style={{ marginTop: 16 }}>
        <h3 style={{ margin: 0 }}>Nuestros proveedores ({nuestros.length})</h3>
        <button className="btn-txt" onClick={() => setVerProv(!verProv)}>{verProv ? "Ocultar" : "Ver"}</button>
      </div>
      <p className="sub" style={{ marginTop: 0 }}>Sus marcas salen de sus productos en Epos (las busca «¿Quién lleva…?»).</p>
      {verProv && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>{nuestros.map(tarjeta)}</div>}
    </>
  );
}

function Contactos({ lista, onAbrir }) {
  const [l, setL] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [anot, setAnot] = useState(null); // { id, texto }
  const cargar = useCallback(() => { sb.rpc("lab_contactos_lista").then(setL).catch((e) => { avisar(msg(e), "mal"); setL([]); }); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!l) return <Cargando />;
  const nEsp = l.filter((c) => c.estado === "esperando" || c.estado === "en_cola").length, nResp = l.filter((c) => c.estado === "respondido" || c.estado === "es_proveedor").length;
  const vis = l.filter((c) => (filtro === "esp" ? c.estado === "esperando" || c.estado === "en_cola" : filtro === "resp" ? c.estado === "respondido" || c.estado === "es_proveedor" : true));
  const guardarAnot = async () => {
    try { await sb.rpc("lab_contacto_anotar", { p_id: anot.id, p_respuesta: anot.texto }); setAnot(null); avisar("Respuesta anotada"); cargar(); } catch (e) { avisar(msg(e), "mal"); }
  };
  const esProveedor = async (c) => {
    try { await sb.rpc("lab_contacto_es_proveedor", { p_id: c.id }); avisar(`${c.quien} queda como proveedor de «${c.prueba}». Sigue con precio y fecha en la ficha.`); cargar(); } catch (e) { avisar(msg(e), "mal"); }
  };
  const abrir = (c) => { const p = lista.find((x) => x.id === c.prueba_id); if (p) onAbrir(p); };
  return (
    <>
      <div style={{ marginTop: 12 }}><Pestanas etiqueta="Filtro" valor={filtro} onChange={setFiltro} opciones={[{ id: "todos", label: `Todos (${l.length})` }, { id: "esp", label: `Esperando (${nEsp})` }, { id: "resp", label: `Respondidos (${nResp})` }]} /></div>
      {!vis.length ? <p className="empty">No hay contactos aquí.</p> : (
        <div className="tabla-scroll"><table className="ranking">
          <thead><tr><th>Prueba</th><th>A quién</th><th>Canal</th><th>Estado</th><th>Respuesta</th><th></th></tr></thead>
          <tbody>{vis.map((c) => (
            <tr key={c.id}>
              <td>{c.prueba_id ? <button className="btn-txt" style={{ padding: 0, textAlign: "left" }} onClick={() => abrir(c)}>{c.prueba}</button> : <span className="pf">{c.tipo === "catalogo" ? "Catálogo general" : "–"}</span>}</td>
              <td>{c.quien}<small className="pf">{hace(c.enviado_en || c.creado_en)}</small></td>
              <td>{canalT(c.canal)}{c.tipo === "catalogo" && <small className="pf">catálogo</small>}</td>
              <td><EstadoC e={c.estado} />{c.recordatorio_en && <small className="pf">recordatorio {hace(c.recordatorio_en)}</small>}</td>
              <td style={{ minWidth: 220 }}>
                {anot?.id === c.id ? (
                  <div><textarea rows={3} style={{ width: "100%" }} aria-label="Respuesta" value={anot.texto} onChange={(e) => setAnot({ ...anot, texto: e.target.value })} />
                    <button className="btn-p" onClick={guardarAnot}>Guardar</button> <button className="btn-l" onClick={() => setAnot(null)}>Cancelar</button></div>
                ) : c.respuesta || <span className="pf">{c.estado === "en_cola" ? "Lo envía el agente" : "Sin respuesta todavía"}</span>}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                {c.canal === "whatsapp" && anot?.id !== c.id && ["esperando", "respondido", "sin_respuesta"].includes(c.estado) && <button className="btn-txt" onClick={() => setAnot({ id: c.id, texto: c.respuesta || "" })}>Anotar respuesta</button>}
                {c.estado === "respondido" && c.prueba_id && <button className="btn-l" onClick={() => esProveedor(c)}>Es el proveedor</button>}
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

function Reglas() {
  const [r, setR] = useState(null);
  const [pls, setPls] = useState([]);
  const cargar = useCallback(() => { sb.rpc("lab_reglas").then((x) => { setR({ tope: x.tope_dia ?? "10", rec: x.recordatorio_dias ?? "6", sinRev: x.sin_revision !== "false", con: x.con_telefono, tot: x.proveedores_pedido }); setPls(x.plantillas || []); }).catch((e) => avisar(msg(e), "mal")); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!r) return <Cargando />;
  const guardar = async () => {
    try { await sb.rpc("lab_reglas_guardar", { p_tope_dia: Number(r.tope), p_recordatorio_dias: Number(r.rec), p_sin_revision: r.sinRev }); avisar("Reglas guardadas"); cargar(); } catch (e) { avisar(msg(e), "mal"); }
  };
  const guardarPl = async (t) => {
    try { await sb.rpc("lab_plantilla_guardar", { p_clave: t.clave, p_asunto: t.asunto || "", p_texto: t.texto }); avisar("Plantilla guardada"); } catch (e) { avisar(msg(e), "mal"); }
  };
  return (
    <>
      <h3>Reglas</h3>
      <ul style={{ lineHeight: 1.6, paddingLeft: 18 }}>
        <li><b>Nunca dos veces</b> al mismo contacto por la misma prueba (lo impide la base de datos).</li>
        <li><b>Etiqueta en Gmail:</b> «Producto», con subetiquetas Producto/Distribuidores y Producto/Catálogos. Cada respuesta se une a su contacto por el hilo del correo.</li>
        <li><b>WhatsApp:</b> se abre a mano y la respuesta se anota a mano. Los teléfonos salen de Pedidos: {r.con} de {r.tot} proveedores lo tienen.</li>
      </ul>
      <div className="fila-campos">
        <label className="campo">Tope de correos al día<input inputMode="numeric" value={r.tope} onChange={(e) => setR({ ...r, tope: e.target.value })} /></label>
        <label className="campo">Recordatorio (una sola vez) a los … días sin respuesta<input inputMode="numeric" value={r.rec} onChange={(e) => setR({ ...r, rec: e.target.value })} /></label>
        <label className="campo">Envío sin revisión de las plantillas<select value={r.sinRev ? "si" : "no"} onChange={(e) => setR({ ...r, sinRev: e.target.value === "si" })}><option value="si">Sí, salen solas</option><option value="no">No, el agente espera</option></select></label>
      </div>
      <p className="sub">Lo que pase del tope sale al día siguiente. Tras el recordatorio sin respuesta, el contacto pasa a «Sin respuesta».</p>
      <button className="btn-p" onClick={guardar}>Guardar reglas</button>
      <h3 style={{ marginTop: 20 }}>Plantillas</h3>
      <p className="sub">Huecos: [producto] (nombre de la prueba) y [enlace] (enlace de la fuente).</p>
      {pls.map((t, i) => (
        <div key={t.clave} className="card" style={{ background: "var(--bg)", padding: 12, marginBottom: 10 }}>
          <b>{t.nombre}</b>
          {t.canal === "correo" && <label className="campo">Asunto<input value={t.asunto || ""} onChange={(e) => setPls(pls.map((y, j) => (j === i ? { ...y, asunto: e.target.value } : y)))} /></label>}
          <label className="campo">Texto<textarea rows={t.canal === "correo" ? 7 : 3} value={t.texto} onChange={(e) => setPls(pls.map((y, j) => (j === i ? { ...y, texto: e.target.value } : y)))} /></label>
          <button className="btn-l" onClick={() => guardarPl(t)}>Guardar plantilla</button>
        </div>
      ))}
    </>
  );
}
