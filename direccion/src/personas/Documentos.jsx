// Personas · Documentos (dirección)
// Nóminas, contratos, anexos y finiquitos que hace la gestoría. Se suben aquí en PDF y cada trabajadora los ve en su app.
// Nóminas: la trabajadora confirma que la ha recibido. Contratos y anexos: los firma en la app (código al correo) y el PDF
// queda sellado con el certificado de la empresa. Los finiquitos no van por aquí: se firman en persona.
// Nada se borra: se anula, y cada paso (subida, apertura, recibí, firma) queda registrado con fecha, IP y dispositivo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb, supabase } from "../../../src/lib/supabase.js";
import { Panel, Pestanas, Cargando, avisar, hace } from "../ui.jsx";
import { cargarNominas, resumenNominas, mesesDeLote, aprobarLote, RevisarLote, AjustesNominas, Lote, Problema } from "./NominasGestoria.jsx"; // #215
import { Normas } from "./Normas.jsx";
import { DocInterna } from "./DocInterna.jsx"; // #206

const fn = (accion, datos = {}) => sb.fn("documentos", { accion, ...datos });
const TIPOS = [
  { id: "nomina", t: "Nómina", firma: false },
  { id: "contrato", t: "Contrato", firma: true },
  { id: "anexo", t: "Anexo al contrato", firma: true },
  { id: "certificado", t: "Certificado", firma: false },
  { id: "otro", t: "Otro documento", firma: false },
];
const TIPO = Object.fromEntries(TIPOS.map((x) => [x.id, x]));
const ESTADO = {
  pendiente: { t: "Sin abrir", c: "#8A5A0B" },
  visto: { t: "Abierto, sin confirmar", c: "#8A5A0B" },
  recibido: { t: "Recibido", c: "var(--up)" },
  en_firma: { t: "Enviado a firmar", c: "#2F5C8F" },
  firmado: { t: "Firmado", c: "var(--up)" },
  rechazado: { t: "Firma rechazada", c: "var(--down)" },
  anulado: { t: "Anulado", c: "var(--muted)" },
};
const fecha = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const mesAnterior = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const esPendiente = (d) => d.estado !== "anulado" && ((d.requiere === "recibi" && !d.recibido_en) || (d.requiere === "firma" && d.estado !== "firmado"));

function Estado({ d }) {
  const e = ESTADO[d.estado] || { t: d.estado, c: "inherit" };
  let t = e.t;
  if (d.estado === "firmado" && d.firmado_en_papel) t = "Firmado en papel";
  if (d.requiere === "firma" && (d.estado === "pendiente" || d.estado === "visto")) t = d.estado === "pendiente" ? "Pendiente de firma · sin abrir" : "Pendiente de firma · abierto";
  return <span style={{ color: e.c, fontWeight: 700, fontSize: 13 }}>{t}</span>;
}

// #215: cuatro pestañas. Las antiguas («Todos», «Subir documento», «Nóminas de la gestoría», «Firma») siguen funcionando
// como enlace (#/personas/documentos/<antigua>) y caen en su sitio nuevo. Filtro de Pendientes: #/personas/documentos/pendientes:<filtro>.
// Persona concreta: #/personas/documentos/persona:<id>.
const FILTROS = [
  { id: "todo", label: "Todo" },
  { id: "nominas", label: "Nóminas por aprobar" },
  { id: "recibi", label: "Sin recibí o sin firmar" },
  { id: "normas", label: "Normas sin recibí" },
  { id: "app", label: "Sin aceptar la app" },
];
const PESTANAS = ["pendientes", "persona", "normas", "interna"];
const ANTIGUAS = { todos: "persona", subir: "pendientes", gestoria: "pendientes", firma: "interna", ajustes: "pendientes" };
function leerExtra(extra) {
  const [v0, det] = String(extra || "").split(":");
  const v = v0 || "pendientes";
  const tab = PESTANAS.includes(v) ? v : ANTIGUAS[v] || "pendientes";
  const filtro = v === "gestoria" ? "nominas" : tab === "pendientes" && FILTROS.some((f) => f.id === det) ? det : "todo";
  return { tab, filtro, persona: tab === "persona" ? det || "" : "", subir: v === "subir", ajustes: v === "ajustes", firma: v === "firma" };
}
const GRUPOS = [{ id: "principal", t: "Principales" }, { id: "apoyo", t: "Apoyos" }, { id: "eventual", t: "Eventuales" }];
function useMovil(q = "(max-width: 760px)") {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => { const mq = window.matchMedia(q); const f = () => setM(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, [q]);
  return m;
}
const fila = { display: "flex", gap: "4px 12px", alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderTop: "1px solid var(--line)" };

export function Documentos({ extra }) {
  const ini = useMemo(() => leerExtra(extra), [extra]);
  const [tab, setTab] = useState(ini.tab);
  const [filtro, setFiltro] = useState(ini.filtro);
  const [persona, setPersona] = useState(ini.persona);
  const [subir, setSubir] = useState(ini.subir);
  const [ajustes, setAjustes] = useState(ini.ajustes);
  const [firmaFoco, setFirmaFoco] = useState(ini.firma ? 1 : 0);
  const [normaAbrir, setNormaAbrir] = useState(null);
  const [ver, setVer] = useState(null);
  const [revisar, setRevisar] = useState(null);
  const [busy, setBusy] = useState(null);
  const [docs, setDocs] = useState(null);
  const [nom, setNom] = useState(null);
  const [nor, setNor] = useState(null);
  const [tipos, setTipos] = useState({});
  const [err, setErr] = useState({});
  const firmaRef = useRef(null);
  const movil = useMovil();
  useEffect(() => { setTab(ini.tab); setFiltro(ini.filtro); setPersona(ini.persona); if (ini.subir) setSubir(true); if (ini.ajustes) setAjustes(true); if (ini.firma) setFirmaFoco((n) => n + 1); }, [ini]);
  useEffect(() => { if (firmaFoco && tab === "interna") { const t = setTimeout(() => firmaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250); return () => clearTimeout(t); } }, [firmaFoco, tab]);

  const fallo = (k, v) => setErr((x) => ({ ...x, [k]: v }));
  // Cada parte se carga por su lado: si una falla, el resto de la lista se ve igual
  const cargarDocs = useCallback(async () => { try { setDocs(await fn("panel")); fallo("docs", false); } catch (e) { avisar(e.message || "No se han podido cargar los documentos", "mal"); fallo("docs", true); setDocs((x) => x || { documentos: [], trabajadoras: [] }); } }, []);
  const cargarNom = useCallback(async () => { try { setNom(await cargarNominas()); fallo("nom", false); } catch (e) { fallo("nom", true); setNom((x) => x || { lotes: [], partes: [], nifs: [] }); } }, []);
  const cargarNor = useCallback(async () => { try { setNor(await sb.fn("normas", { accion: "panel" })); fallo("nor", false); } catch (e) { fallo("nor", true); setNor((x) => x || { normas: [], versiones: [], recibos: [], plantilla: [] }); } }, []);
  useEffect(() => {
    cargarDocs(); cargarNom(); cargarNor();
    sb.select("usuarios", "select=id,tipo_turno&rol=eq.trabajadora").then((r) => setTipos(Object.fromEntries((r || []).map((u) => [u.id, u.tipo_turno])))).catch(() => {});
  }, [cargarDocs, cargarNom, cargarNor]);

  const trab = docs?.trabajadoras || [];
  const nombre = useMemo(() => Object.fromEntries(trab.map((u) => [u.id, u.nombre])), [trab]);
  if (!docs) return <Cargando texto="Cargando documentos…" />;

  const activas = trab.filter((u) => u.activo);
  const grupo = (u) => (u.eventual ? "eventual" : tipos[u.id] === "apoyo" ? "apoyo" : "principal");
  const R = nom ? resumenNominas(nom) : null;

  // ---- la bandeja de Pendientes ----
  const filas = [];
  if (R) {
    R.porAprobar.forEach((l) => filas.push({ k: `l${l.id}`, parte: "tu", tipo: "nominas", fecha: l.recibido_en, lote: l, partes: R.porLote(l.id), usuarios: [] }));
    R.sueltas.forEach((p) => filas.push({ k: `p${p.id}`, parte: "tu", tipo: "nominas", fecha: R.lotePorId[p.lote_id]?.recibido_en, suelta: p, usuarios: [] }));
  }
  docs.documentos.filter(esPendiente).forEach((x) => filas.push({ k: `d${x.id}`, parte: "ella", tipo: "recibi", fecha: x.subido_en, doc: x, usuarios: [x.usuario_id] }));
  const vigenteDe = (id) => nor?.versiones.find((v) => v.norma_id === id && v.vigente);
  if (nor) nor.normas.forEach((n) => {
    const v = vigenteDe(n.id); if (!v) return;
    const ok = new Set(nor.recibos.filter((r) => r.version_id === v.id && r.recibido_en).map((r) => r.usuario_id));
    const faltan = nor.plantilla.filter((u) => !ok.has(u.id));
    if (faltan.length) filas.push({ k: `n${n.id}`, parte: "ella", tipo: "normas", fecha: v.subido_en, norma: n, version: v, faltan, total: nor.plantilla.length, usuarios: faltan.map((u) => u.id) });
  });
  activas.filter((u) => !u.documentos_electronicos_en).forEach((u) => filas.push({ k: `u${u.id}`, parte: "ella", tipo: "app", fecha: null, usuario: u, usuarios: [u.id] }));
  filas.sort((a, b) => (a.fecha ? 0 : 1) - (b.fecha ? 0 : 1) || String(a.fecha || "").localeCompare(String(b.fecha || "")));
  const total = filas.length;
  const cuenta = Object.fromEntries(FILTROS.map((f) => [f.id, f.id === "todo" ? total : filas.filter((x) => x.tipo === f.id).length]));
  const pendDe = (id) => filas.filter((x) => x.usuarios.includes(id)).length;

  const opciones = [
    { id: "pendientes", label: "Pendientes", n: total },
    { id: "persona", label: "Por persona" },
    { id: "normas", label: "Normas y protocolos" },
    { id: "interna", label: "Documentación interna" },
  ];
  const sel = tab === "persona" ? trab.find((u) => u.id === persona) : null;
  const irFirma = () => { setTab("interna"); setFirmaFoco((n) => n + 1); };
  const aprobarFila = async (l, ps) => { setBusy(`a${l.id}`); const ok = await aprobarLote(l, ps); setBusy(null); if (ok) { cargarNom(); cargarDocs(); } };
  const listaSubir = sel && !sel.activo ? [...activas, sel] : activas;

  return (
    <>
      <div className="head" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p className="sub" style={{ margin: 0, flex: "1 1 320px" }}>Nóminas y contratos de la gestoría. Cada trabajadora ve los suyos en «Mis documentos» de la app. Nada se borra: se anula, y cada paso queda registrado.</p>
        <button className="btn-p" onClick={() => setSubir(true)}>{sel ? `Subir documento a ${sel.nombre}` : "Subir documento"}</button>
      </div>
      {!docs.firma_proveedor && !err.docs && <p className="b-nota">Falta el certificado de la empresa para que las trabajadoras puedan firmar contratos en la app. <button className="btn-txt" style={{ padding: 0 }} onClick={irFirma}>Súbelo en «Firma de contratos en la app»</button>. Mientras tanto, los contratos firmados en papel se pueden subir marcándolos como tal.</p>}
      <Pestanas valor={tab} opciones={opciones} onChange={(t) => { setTab(t); if (t !== "normas") setNormaAbrir(null); }} etiqueta="Secciones de documentos" />

      {tab === "pendientes" && (
        <div className="mt">
          <Pestanas valor={filtro} opciones={FILTROS.map((f) => ({ id: f.id, label: f.label, n: cuenta[f.id] }))} onChange={setFiltro} etiqueta="Filtrar pendientes" />
          {err.docs && <p className="b-nota">No se han podido cargar los documentos de cada persona; el resto de la lista sí está al día.</p>}
          {err.nom && <p className="b-nota">No se han podido cargar las nóminas de la gestoría; el resto de la lista sí está al día.</p>}
          {err.nor && <p className="b-nota">No se han podido cargar las normas y protocolos; el resto de la lista sí está al día.</p>}
          {(!nom || !nor) && <p className="pf">Cargando el resto de pendientes…</p>}
          {total === 0 && nom && nor ? <div className="card mt"><p className="empty">Todo al día ✓</p></div> : (() => {
            const ver2 = filas.filter((x) => filtro === "todo" || x.tipo === filtro);
            const tu = ver2.filter((x) => x.parte === "tu"), ella = ver2.filter((x) => x.parte === "ella");
            const aviso10 = R?.avisoDia10 && (filtro === "todo" || filtro === "nominas");
            if (!ver2.length && !aviso10) return <div className="card mt"><p className="empty">Nada pendiente en este filtro.</p></div>;
            return (
              <>
                {(tu.length > 0 || aviso10) && (
                  <section className="card mt" style={{ padding: 0 }}>
                    <h2 style={{ padding: "14px 14px 8px", margin: 0 }}>Te toca a ti <span className="pf" style={{ display: "inline" }}>· {tu.length}</span></h2>
                    {aviso10 && <p className="b-nota" style={{ margin: "0 14px 12px" }}>{R.avisoDia10}</p>}
                    {tu.map((x) => x.lote ? (() => {
                      const ps = x.partes; const listas = ps.filter((p) => p.estado === "lista").length;
                      const sinPag = ps.filter((p) => ["sin_asignar", "error"].includes(p.estado)).reduce((a, p) => a + (p.paginas?.length || 1), 0);
                      return (
                        <div key={x.k} style={fila}>
                          <span style={{ flex: "1 1 240px", minWidth: 0 }}>
                            <b style={{ display: "block" }}>Nóminas de {mesesDeLote(ps)} por aprobar</b>
                            <span className="pf">{listas} nómina{listas === 1 ? "" : "s"} separada{listas === 1 ? "" : "s"} · {sinPag ? <span style={{ color: "var(--down)" }}>{sinPag} página{sinPag === 1 ? "" : "s"} sin asignar</span> : "ninguna página sin asignar"} · {x.lote.origen === "gmail" ? "llegó del correo" : "subido a mano"} {hace(x.lote.recibido_en)}{x.lote.sin_avisar ? " · carga inicial: sin avisar" : ""}</span>
                          </span>
                          <button className="btn-l" onClick={() => setRevisar(x.lote.id)}>Revisar</button>
                          <button className="btn-p" disabled={!!busy} onClick={() => aprobarFila(x.lote, ps)}>{busy === `a${x.lote.id}` ? "Publicando…" : x.lote.sin_avisar ? "Aprobar y guardar sin avisar" : "Aprobar y publicar"}</button>
                        </div>
                      );
                    })() : (
                      <div key={x.k} style={{ padding: "0 14px" }}>
                        <Problema p={x.suelta} lote={R.lotePorId[x.suelta.lote_id]} trabajadoras={trab} nombre={nombre} onHecho={() => { cargarNom(); cargarDocs(); }} />
                      </div>
                    ))}
                  </section>
                )}
                {ella.length > 0 && (
                  <section className="card mt" style={{ padding: 0 }}>
                    <h2 style={{ padding: "14px 14px 8px", margin: 0 }}>Esperando a la trabajadora <span className="pf" style={{ display: "inline" }}>· {ella.length}</span></h2>
                    {ella.map((x) => x.doc ? (
                      <div key={x.k} style={fila}>
                        <span style={{ flex: "1 1 220px", minWidth: 0 }}><b style={{ display: "block" }}>{x.doc.titulo}</b><span className="pf">{TIPO[x.doc.tipo]?.t} · {x.doc.usuarios?.nombre || nombre[x.doc.usuario_id]} · subido {hace(x.doc.subido_en)}</span></span>
                        <Estado d={x.doc} />
                        <button className="btn-l" onClick={() => setVer(x.doc)}>Ver</button>
                      </div>
                    ) : x.norma ? (
                      <div key={x.k} style={fila}>
                        <span style={{ flex: "1 1 220px", minWidth: 0 }}><b style={{ display: "block" }}>{x.norma.titulo} <span className="pf" style={{ display: "inline" }}>v{x.version.version}</span></b><span className="pf">Faltan {x.faltan.length} de {x.total} por confirmar el recibí: {x.faltan.map((u) => u.nombre).join(", ")}</span></span>
                        <button className="btn-l" onClick={() => { setNormaAbrir(x.norma.id); setTab("normas"); }}>Ver en Normas</button>
                      </div>
                    ) : (
                      <div key={x.k} style={fila}>
                        <span style={{ flex: "1 1 220px", minWidth: 0 }}><b style={{ display: "block" }}>{x.usuario.nombre} no ha aceptado recibir documentos en la app</b><span className="pf">Informativo: se le pide la primera vez que entra en «Mis documentos».</span></span>
                        <button className="btn-txt" onClick={() => { setPersona(x.usuario.id); setTab("persona"); }}>Ver persona</button>
                      </div>
                    ))}
                  </section>
                )}
              </>
            );
          })()}
        </div>
      )}

      {tab === "persona" && (() => {
        const orden = [...GRUPOS.flatMap((g) => activas.filter((u) => grupo(u) === g.id).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((u) => ({ u, g: g.id }))),
          ...trab.filter((u) => !u.activo).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((u) => ({ u, g: "baja" }))];
        const titulos = { principal: "Principales", apoyo: "Apoyos", eventual: "Eventuales", baja: "De baja" };
        const detalle = sel ? <FichaPersona u={sel} grupo={grupo(sel)} docs={docs.documentos} R={R} nor={nor} nombre={nombre} onVer={setVer} onRevisar={setRevisar} /> : <p className="empty">Elige una persona {movil ? "arriba" : "de la lista"} para ver sus documentos y sus normas.</p>;
        if (movil) return (
          <div className="card mt">
            <label className="campo">Persona
              <select value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option value="">Elige…</option>
                {GRUPOS.map((g) => <optgroup key={g.id} label={g.t}>{orden.filter((o) => o.g === g.id).map(({ u }) => <option key={u.id} value={u.id}>{u.nombre}{pendDe(u.id) ? ` (${pendDe(u.id)} pendiente${pendDe(u.id) === 1 ? "" : "s"})` : ""}</option>)}</optgroup>)}
                <optgroup label="De baja">{orden.filter((o) => o.g === "baja").map(({ u }) => <option key={u.id} value={u.id}>{u.nombre} (baja)</option>)}</optgroup>
              </select>
            </label>
            {detalle}
          </div>
        );
        return (
          <div className="mt" style={{ display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
            <nav className="card" style={{ padding: "6px 0" }} aria-label="Personas">
              {orden.map(({ u, g }, i) => (
                <div key={u.id}>
                  {(i === 0 || orden[i - 1].g !== g) && <div className="pf" style={{ padding: "10px 14px 4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", fontSize: 11 }}>{titulos[g]}</div>}
                  <button onClick={() => setPersona(u.id)} aria-pressed={persona === u.id}
                    style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 8, border: 0, background: persona === u.id ? "var(--grid)" : "none", padding: "7px 14px", cursor: "pointer", textAlign: "left", font: "inherit", fontSize: 13.5, fontWeight: persona === u.id ? 700 : 500, color: g === "baja" ? "var(--muted)" : "inherit" }}>
                    <span>{u.nombre}</span>{pendDe(u.id) > 0 && <span className="cuenta" style={{ display: "inline-grid", placeItems: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "var(--amarillo)", color: "var(--tinta)", fontSize: 11, fontWeight: 800 }}>{pendDe(u.id)}</span>}
                  </button>
                </div>
              ))}
            </nav>
            <div className="card">{detalle}</div>
          </div>
        );
      })()}

      {tab === "normas" && <div className="card mt"><Normas abrirId={normaAbrir} onCambio={cargarNor} /></div>}
      {tab === "interna" && (
        <>
          <div className="card mt"><DocInterna /></div>
          <div className="card mt" ref={firmaRef} id="firma-contratos" style={{ scrollMarginTop: 72 }}><Firma onCambio={cargarDocs} /></div>
        </>
      )}

      <p style={{ textAlign: "center", margin: "28px 0 8px" }}><button className="btn-txt" onClick={() => setAjustes(true)}>Ajustes de documentos</button></p>

      {subir && (
        <Panel titulo={sel ? `Subir documento a ${sel.nombre}` : "Subir documento"} onClose={() => setSubir(false)} ancho={680}>
          <Subir trabajadoras={listaSubir} usuarioInicial={sel ? sel.id : ""} onHecho={() => { cargarDocs(); }} />
        </Panel>
      )}
      {ajustes && (
        <Panel titulo="Ajustes de documentos" sub="Nóminas de la gestoría: NIF, correo automático y subida a mano del PDF" onClose={() => setAjustes(false)} ancho={720}>
          {!nom ? <Cargando /> : err.nom ? <p className="b-nota">No se han podido cargar las nóminas de la gestoría. Prueba a recargar.</p> : <AjustesNominas d={nom} trabajadoras={trab} onHecho={() => { cargarNom(); cargarDocs(); }} />}
        </Panel>
      )}
      {revisar && nom && (() => {
        const l = nom.lotes.find((x) => x.id === revisar); if (!l) return null; const ps = nom.partes.filter((p) => p.lote_id === l.id);
        return (
          <Panel titulo={`Nóminas de ${mesesDeLote(ps)}`} sub={l.estado === "por_aprobar" ? "Por aprobar" : l.estado === "publicado" ? "Publicado" : l.estado} onClose={() => setRevisar(null)} ancho={780}>
            {l.estado === "por_aprobar"
              ? <RevisarLote l={l} partes={ps} trabajadoras={trab} nombre={nombre} onHecho={(cerrar) => { cargarNom(); cargarDocs(); if (cerrar) setRevisar(null); }} />
              : <Lote l={l} partes={ps} nombre={nombre} />}
          </Panel>
        );
      })()}
      {ver && <Detalle doc={ver} onClose={() => setVer(null)} onCambio={() => { setVer(null); cargarDocs(); }} />}
    </>
  );
}

function FichaPersona({ u, grupo, docs, R, nor, nombre, onVer, onRevisar }) {
  const suyos = docs.filter((x) => x.usuario_id === u.id);
  const vivos = suyos.filter((x) => x.estado !== "anulado"), anulados = suyos.filter((x) => x.estado === "anulado");
  const enLote = R ? R.porAprobar.flatMap((l) => R.porLote(l.id).filter((p) => p.usuario_id === u.id && ["lista", "error"].includes(p.estado)).map((p) => ({ p, l }))) : [];
  const enPlantilla = nor?.plantilla.some((x) => x.id === u.id);
  return (
    <>
      <div className="head"><div>
        <h2>{u.nombre}</h2>
        <p className="sub">{!u.activo ? "De baja" : grupo === "principal" ? "Principal" : grupo === "apoyo" ? "Apoyo" : "Eventual"} · {u.documentos_electronicos_en ? `Aceptó recibir documentos en la app el ${fecha(u.documentos_electronicos_en)}` : <span style={{ color: "#8A5A0B", fontWeight: 700 }}>Todavía no ha aceptado recibir documentos en la app</span>}</p>
      </div></div>
      <h3 style={{ fontSize: 15, margin: "6px 0" }}>Documentos</h3>
      {suyos.length === 0 && enLote.length === 0 ? <p className="pf">No tiene documentos.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Documento</th><th>Subido</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {enLote.map(({ p, l }) => (
                <tr key={`p${p.id}`}>
                  <td><span className="pn">Nómina de {mesesDeLote([p])}</span><span className="pf">De la gestoría</span></td>
                  <td><span className="pf" style={{ color: "inherit" }}>{hace(l.recibido_en)}</span></td>
                  <td><span style={{ color: "#2F5C8F", fontWeight: 700, fontSize: 13 }}>En un lote por aprobar</span></td>
                  <td className="r"><button className="btn-l" onClick={() => onRevisar(l.id)}>Revisar</button></td>
                </tr>
              ))}
              {[...vivos, ...anulados].map((x) => (
                <tr key={x.id} style={{ opacity: x.estado === "anulado" ? 0.6 : 1 }}>
                  <td><span className="pn" style={{ textDecoration: x.estado === "anulado" ? "line-through" : undefined }}>{x.titulo}</span><span className="pf">{TIPO[x.tipo]?.t}</span></td>
                  <td><span className="pf" style={{ color: "inherit" }}>{fecha(x.subido_en)}</span></td>
                  <td><Estado d={x} />{x.estado === "anulado" && x.anulado_motivo && <span className="pf">{x.anulado_motivo}</span>}</td>
                  <td className="r"><button className="btn-l" onClick={() => onVer(x)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h3 style={{ fontSize: 15, margin: "18px 0 6px" }}>Normas y protocolos</h3>
      {!nor ? <Cargando /> : grupo === "eventual" ? <p className="pf">Las eventuales no reciben las normas y protocolos.</p> : (() => {
        const lista = nor.normas.map((n) => ({ n, v: nor.versiones.find((v) => v.norma_id === n.id && v.vigente) })).filter((x) => x.v);
        if (!lista.length) return <p className="pf">Todavía no hay normas subidas.</p>;
        return (
          <div style={{ display: "grid", gap: 6 }}>
            {!enPlantilla && <p className="pf" style={{ margin: 0 }}>Ya no está en la plantilla: se muestran los recibís que dejó.</p>}
            {lista.map(({ n, v }) => {
              const r = nor.recibos.find((x) => x.version_id === v.id && x.usuario_id === u.id);
              return (
                <div key={n.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", display: "flex", gap: "2px 14px", flexWrap: "wrap", alignItems: "baseline", fontSize: 13 }}>
                  <span style={{ flex: "1 1 200px", minWidth: 0 }}><b>{n.titulo}</b> <span className="pf" style={{ display: "inline" }}>v{v.version}</span></span>
                  {r?.recibido_en ? <b style={{ color: "var(--up)" }}>Recibida {fecha(r.recibido_en)}</b> : <b style={{ color: "#8A5A0B" }}>{r?.visto_en ? "Abierta, sin confirmar" : "Pendiente"}</b>}
                </div>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}

function Subir({ trabajadoras, onHecho, usuarioInicial = "" }) {
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [tipo, setTipo] = useState("nomina");
  const [periodo, setPeriodo] = useState(mesAnterior());
  const [titulo, setTitulo] = useState("");
  const [papel, setPapel] = useState(false);
  const [interno, setInterno] = useState(""); // #207 documento interno al que corresponde la copia firmada
  const [internos, setInternos] = useState([]);
  useEffect(() => { sb.fn("doc-interna", { accion: "lista" }).then((r) => setInternos(r.documentos || [])).catch(() => {}); }, []);
  const [archivo, setArchivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hechos, setHechos] = useState([]);
  const input = useRef(null);
  const t = TIPO[tipo];
  const papelSuelto = tipo === "otro" || tipo === "certificado"; // #207: sin recibí y sin aviso
  const puedePapel = t.firma || papelSuelto;

  const subir = async () => {
    if (!usuario) { avisar("Elige la trabajadora", "mal"); return; }
    if (!archivo) { avisar("Elige el PDF", "mal"); return; }
    if (archivo.type && archivo.type !== "application/pdf") { avisar("Tiene que ser un PDF", "mal"); return; }
    if (archivo.size > 15 * 1024 * 1024) { avisar("El PDF pesa más de 15 MB", "mal"); return; }
    setBusy(true);
    try {
      const s = await fn("subida", { usuario_id: usuario });
      const { error } = await supabase.storage.from("personal").uploadToSignedUrl(s.ruta, s.token, archivo, { contentType: "application/pdf" });
      if (error) throw new Error("No se ha podido subir el PDF");
      const sinAviso = papelSuelto && papel;
      const r = sinAviso
        ? await sb.fn("doc-interna", { accion: "registrar_papel", usuario_id: usuario, ruta: s.ruta, tipo, titulo: titulo.trim() || undefined, doc_interno_id: interno ? Number(interno) : undefined, nombre_archivo: archivo.name })
        : await fn("registrar", { usuario_id: usuario, ruta: s.ruta, tipo, periodo: tipo === "nomina" ? periodo : undefined, titulo: titulo.trim() || undefined, firmado_en_papel: t.firma && papel, nombre_archivo: archivo.name });
      const nombre = trabajadoras.find((u) => u.id === usuario)?.nombre;
      setHechos((h) => [{ id: r.documento.id, texto: `${r.documento.titulo} · ${nombre}` }, ...h]);
      avisar(sinAviso ? `Guardado como firmado en la ficha de ${nombre}, sin avisar` : `Subido y avisada ${nombre}`);
      // listo para la siguiente: se queda el tipo, el mes y el documento interno
      setUsuario(usuarioInicial); setArchivo(null); setTitulo(""); if (!sinAviso) setPapel(false); if (input.current) input.current.value = "";
      onHecho();
    } catch (e) { avisar(e.message || "No se ha podido subir", "mal"); }
    setBusy(false);
  };

  return (
    <>
      <div className="head"><div><p className="sub" style={{ marginTop: 0 }}>Un PDF por trabajadora. Al subirlo se le avisa en la app y por WhatsApp. Para las nóminas del mes, el tipo y el mes se quedan puestos: solo cambia la trabajadora y el archivo.</p></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 14px", maxWidth: 760 }}>
        <label className="campo">Tipo
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPapel(false); setInterno(""); }}>
            {TIPOS.map((x) => <option key={x.id} value={x.id}>{x.t}</option>)}
          </select>
        </label>
        <label className="campo">Trabajadora
          <select value={usuario} onChange={(e) => setUsuario(e.target.value)}>
            <option value="">Elige…</option>
            {trabajadoras.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </label>
        {tipo === "nomina" && <label className="campo">Mes de la nómina<input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} /></label>}
        <label className="campo">Título <small>(opcional)</small><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "nomina" ? "Se pone solo con el mes" : `p. ej. ${t.t} indefinido 30 h`} /></label>
      </div>
      <label className="campo" style={{ maxWidth: 760 }}>PDF
        <input ref={input} type="file" accept="application/pdf,.pdf" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
      </label>
      {puedePapel && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 14 }}>
          <input type="checkbox" checked={papel} onChange={(e) => { setPapel(e.target.checked); if (!e.target.checked) setInterno(""); }} /> Ya está firmado en papel (solo se guarda y ella lo puede consultar)
        </label>
      )}
      {papelSuelto && papel && (
        <label className="campo" style={{ maxWidth: 380 }}>¿A qué documento interno corresponde? <small>(opcional)</small>
          <select value={interno} onChange={(e) => setInterno(e.target.value)}>
            <option value="">Ninguno</option>
            {internos.map((x) => <option key={x.id} value={x.id}>{x.titulo}</option>)}
          </select>
        </label>
      )}
      <p className="pf" style={{ marginTop: 0 }}>{papelSuelto && papel ? "Se guarda como firmado en su ficha. No se le pide recibí ni se le avisa." : t.firma ? (papel ? "Se guarda como firmado." : "Quedará pendiente de firma digital.") : "Ella lo abre en la app y confirma que lo ha recibido."}</p>
      <button className="btn-p" disabled={busy} onClick={subir}>{busy ? "Subiendo…" : papelSuelto && papel ? "Guardar sin avisar" : "Subir y avisar"}</button>
      {hechos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="pf" style={{ fontWeight: 700 }}>Subidos ahora</div>
          {hechos.map((h) => <div key={h.id} style={{ fontSize: 13.5, padding: "3px 0" }}>✓ {h.texto}</div>)}
        </div>
      )}
    </>
  );
}

function Firma({ onCambio }) {
  const [st, setSt] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [clave, setClave] = useState("");
  const [busy, setBusy] = useState(false);
  const [prueba, setPrueba] = useState(null);
  const cargar = useCallback(async () => { try { setSt(await fn("firma_estado")); } catch (e) { avisar(e.message, "mal"); setSt({ certificado: null }); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const guardar = async () => {
    if (!archivo) { avisar("Elige el archivo del certificado (.p12 o .pfx)", "mal"); return; }
    if (archivo.size > 1024 * 1024) { avisar("Ese archivo es demasiado grande para ser un certificado", "mal"); return; }
    setBusy(true);
    try {
      const buf = new Uint8Array(await archivo.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const r = await fn("certificado_guardar", { p12: btoa(bin), clave });
      setClave(""); setArchivo(null); setPrueba(r.prueba_url);
      avisar("Certificado guardado: la firma ya está activa"); await cargar(); onCambio();
    } catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  if (!st) return <Cargando />;
  const c = st.certificado;
  const dias = c ? Math.round((new Date(c.hasta) - new Date()) / 86400000) : null;
  return (
    <>
      <div className="head"><div><h2>Firma de contratos en la app</h2><p className="sub">La trabajadora firma con un código que le llega a su correo. Al firmar, el PDF se sella con el certificado digital de la empresa (cualquier cambio posterior lo invalida), un servicio externo certifica la hora y se le envía su copia por correo.</p></div></div>
      {c ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, marginBottom: 16, maxWidth: 620 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{st.activa ? "✓ Firma activa" : "Certificado caducado: la firma está parada"}</div>
          <div className="pf" style={{ color: "inherit" }}>{c.organizacion || c.titular}{c.nif ? ` · ${c.nif}` : ""}</div>
          <div className="pf">Titular: {c.titular} · Emisor: {c.emisor}</div>
          <div className="pf" style={{ color: dias != null && dias < 45 ? "var(--down)" : undefined }}>Caduca el {new Date(c.hasta).toLocaleDateString("es-ES")}{dias != null && dias >= 0 ? ` (en ${dias} días)` : ""}</div>
          {c.subido_por && <div className="pf">Subido por {c.subido_por} {c.subido_en ? hace(c.subido_en) : ""}</div>}
        </div>
      ) : <p className="b-nota" style={{ maxWidth: 620 }}>Todavía no hay certificado. Sube el certificado digital de la empresa (el de representante de persona jurídica que emite la FNMT, el mismo que suele usar la gestoría). Es un archivo .p12 o .pfx con su contraseña.</p>}
      {prueba && <p className="b-nota" style={{ maxWidth: 620 }}>Comprobación: <a href={prueba} target="_blank" rel="noreferrer">descarga este PDF de prueba</a> y ábrelo con Adobe Acrobat Reader. En el panel de firmas debe aparecer el sello de la empresa. (El enlace caduca en 10 minutos.)</p>}
      <div style={{ maxWidth: 620 }}>
        <label className="campo">{c ? "Cambiar certificado (por ejemplo, al renovarlo)" : "Certificado de la empresa (.p12 o .pfx)"}
          <input type="file" accept=".p12,.pfx,application/x-pkcs12" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        </label>
        <label className="campo">Contraseña del certificado
          <input type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        <p className="pf" style={{ marginTop: 0 }}>Se comprueba que el certificado vale y que sella bien antes de guardarlo. Queda guardado en el servidor, sin acceso desde la app de las trabajadoras.</p>
        <button className="btn-p" disabled={busy} onClick={guardar}>{busy ? "Comprobando…" : "Guardar certificado"}</button>
      </div>
    </>
  );
}

const EV = { subido: "Subido", notificado: "Avisada", abierto: "Lo abrió", descargado: "Lo descargó", recibido: "Confirmó que lo ha recibido", codigo_enviado: "Se le envió el código de firma", codigo_erroneo: "Código incorrecto", firmado: "Firmado", copia_enviada: "Copia firmada enviada a su correo", recordatorio: "Recordatorio de firma", anulado: "Anulado", admin_abrir: "Abierto por dirección", admin_descargar: "Descargado por dirección" };

function Detalle({ doc, onClose, onCambio }) {
  const [ev, setEv] = useState(null);
  const [anular, setAnular] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fn("eventos", { id: doc.id }).then((r) => setEv(r.eventos)).catch((e) => { avisar(e.message, "mal"); setEv([]); }); }, [doc.id]);
  const abrir = async (cual) => {
    const w = window.open("", "_blank");
    try { const r = await fn("abrir", { id: doc.id, cual }); if (w) w.location.href = r.url; else window.location.href = r.url; }
    catch (e) { if (w) w.close(); avisar(e.message, "mal"); }
  };
  const hacerAnular = async () => {
    setBusy(true);
    try { await fn("anular", { id: doc.id, motivo }); avisar("Documento anulado"); onCambio(); } catch (e) { avisar(e.message, "mal"); }
    setBusy(false);
  };
  const recordar = async () => { try { await fn("recordar_firma", { id: doc.id }); avisar("Aviso enviado"); } catch (e) { avisar(e.message, "mal"); } };
  const filas = useMemo(() => ev || [], [ev]);
  return (
    <Panel titulo={doc.titulo} sub={`${doc.usuarios?.nombre} · ${TIPO[doc.tipo]?.t}`} onClose={onClose}
      pie={<>
        <button className="btn-p" onClick={() => abrir("original")}>Abrir PDF</button>
        {doc.ruta_firmado && <button className="btn-l" onClick={() => abrir("firmado")}>PDF firmado</button>}
        {doc.ruta_evidencias && <button className="btn-l" onClick={() => abrir("evidencias")}>Evidencias</button>}
      </>}>
      <p style={{ margin: "0 0 10px" }}><Estado d={doc} /></p>
      {doc.requiere === "firma" && doc.estado !== "firmado" && doc.estado !== "anulado" && <button className="btn-l" style={{ marginBottom: 12 }} onClick={recordar}>Recordarle que lo firme</button>}
      <div className="pf" style={{ wordBreak: "break-all" }}>Huella del PDF (SHA-256): {doc.sha256}</div>
      {doc.nombre_archivo && <div className="pf">Archivo original: {doc.nombre_archivo}</div>}
      <h3 style={{ fontSize: 14, margin: "16px 0 6px" }}>Registro</h3>
      {!ev ? <Cargando /> : filas.length === 0 ? <p className="pf">Sin movimientos.</p> : (
        <div style={{ display: "grid", gap: 6 }}>
          {filas.map((e) => (
            <div key={e.id} style={{ fontSize: 13, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
              <b>{EV[e.evento] || e.evento}</b> · {fecha(e.en)} · {e.usuarios?.nombre || "sistema"}
              {(e.ip || e.agente) && <div className="pf">{e.ip ? `IP ${e.ip}` : ""}{e.agente ? ` · ${e.agente.slice(0, 90)}` : ""}</div>}
              {e.datos?.motivo && <div className="pf">Motivo: {e.datos.motivo}</div>}
            </div>
          ))}
        </div>
      )}
      {doc.estado !== "anulado" && (
        <div style={{ marginTop: 18 }}>
          {!anular ? <button className="btn-txt peligro" onClick={() => setAnular(true)}>Anular este documento</button> : (
            <>
              <label className="campo">¿Por qué se anula? (queda guardado; el PDF no se borra)<textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="p. ej. La gestoría mandó una nómina con un error; se sube la corregida" /></label>
              <button className="btn-l" disabled={busy || motivo.trim().length < 3} onClick={hacerAnular}>{busy ? "Anulando…" : "Anular"}</button> <button className="btn-txt" onClick={() => setAnular(false)}>Cancelar</button>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
