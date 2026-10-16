// Personas · Documentos (dirección)
// Nóminas, contratos, anexos y finiquitos que hace la gestoría. Se suben aquí en PDF y cada trabajadora los ve en su app.
// Nóminas: la trabajadora confirma que la ha recibido. Contratos/anexos/finiquitos: firma digital con prestador cualificado.
// Nada se borra: se anula, y cada paso (subida, apertura, recibí, firma) queda registrado con fecha, IP y dispositivo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb, supabase } from "../../../src/lib/supabase.js";
import { Panel, Pestanas, Cargando, avisar, hace } from "../ui.jsx";

const fn = (accion, datos = {}) => sb.fn("documentos", { accion, ...datos });
const TIPOS = [
  { id: "nomina", t: "Nómina", firma: false },
  { id: "contrato", t: "Contrato", firma: true },
  { id: "anexo", t: "Anexo al contrato", firma: true },
  { id: "finiquito", t: "Finiquito", firma: true },
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

export function Documentos() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("pendientes");
  const [quien, setQuien] = useState("");
  const [ver, setVer] = useState(null);
  const cargar = useCallback(async () => { try { setD(await fn("panel")); } catch (e) { avisar(e.message || "No se han podido cargar los documentos", "mal"); setD((x) => x || { documentos: [], trabajadoras: [] }); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return <Cargando texto="Cargando documentos…" />;

  const activas = d.trabajadoras.filter((u) => u.activo);
  const pend = d.documentos.filter(esPendiente);
  const sinAceptar = activas.filter((u) => !u.documentos_electronicos_en);
  const lista = (tab === "pendientes" ? pend : d.documentos).filter((x) => !quien || x.usuario_id === quien);
  const opciones = [
    { id: "pendientes", label: "Pendientes", n: pend.length },
    { id: "todos", label: "Todos" },
    { id: "subir", label: "Subir documento" },
  ];

  return (
    <>
      <div className="head" style={{ alignItems: "center" }}>
        <p className="sub" style={{ margin: 0 }}>Nóminas y contratos de la gestoría. Cada trabajadora ve los suyos en «Mis documentos» de la app. Nada se borra: se anula, y cada paso queda registrado.</p>
      </div>
      {!d.firma_proveedor && <p className="b-nota">La firma digital de contratos todavía no está conectada (falta contratar el prestador). Mientras tanto, los contratos se pueden subir para que la trabajadora los vea, o marcarlos como «firmado en papel» si ya lo están.</p>}
      {sinAceptar.length > 0 && <p className="b-nota">Aún no han aceptado recibir documentos en la app: {sinAceptar.map((u) => u.nombre).join(", ")}. Se les pide la primera vez que entran en «Mis documentos».</p>}
      <Pestanas valor={tab} opciones={opciones} onChange={setTab} etiqueta="Secciones de documentos" />
      <div className="card mt">
        {tab === "subir" ? <Subir trabajadoras={activas} onHecho={() => { cargar(); }} /> : (
          <>
            <div className="head">
              <div><h2>{tab === "pendientes" ? "Pendientes de recibir o firmar" : "Todos los documentos"}</h2></div>
              <label className="campo" style={{ marginBottom: 0 }}>Trabajadora
                <select value={quien} onChange={(e) => setQuien(e.target.value)}>
                  <option value="">Todas</option>
                  {d.trabajadoras.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.activo ? "" : " (baja)"}</option>)}
                </select>
              </label>
            </div>
            {lista.length === 0 ? <p className="empty">{tab === "pendientes" ? "Nada pendiente." : "Todavía no hay documentos. Súbelos desde «Subir documento»."}</p> : (
              <div className="tabla-scroll">
                <table className="ranking">
                  <thead><tr><th>Documento</th><th>Trabajadora</th><th>Subido</th><th>Estado</th><th></th></tr></thead>
                  <tbody>
                    {lista.map((x) => (
                      <tr key={x.id} style={{ opacity: x.estado === "anulado" ? 0.55 : 1 }}>
                        <td><span className="pn">{x.titulo}</span><span className="pf">{TIPO[x.tipo]?.t}</span></td>
                        <td>{x.usuarios?.nombre}</td>
                        <td><span className="pf" style={{ color: "inherit" }}>{hace(x.subido_en)}</span></td>
                        <td><Estado d={x} />{x.estado === "anulado" && x.anulado_motivo && <span className="pf">{x.anulado_motivo}</span>}</td>
                        <td className="r"><button className="btn-l" onClick={() => setVer(x)}>Ver</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      {ver && <Detalle doc={ver} onClose={() => setVer(null)} onCambio={() => { setVer(null); cargar(); }} />}
    </>
  );
}

function Subir({ trabajadoras, onHecho }) {
  const [usuario, setUsuario] = useState("");
  const [tipo, setTipo] = useState("nomina");
  const [periodo, setPeriodo] = useState(mesAnterior());
  const [titulo, setTitulo] = useState("");
  const [papel, setPapel] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hechos, setHechos] = useState([]);
  const input = useRef(null);
  const t = TIPO[tipo];

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
      const r = await fn("registrar", { usuario_id: usuario, ruta: s.ruta, tipo, periodo: tipo === "nomina" ? periodo : undefined, titulo: titulo.trim() || undefined, firmado_en_papel: t.firma && papel, nombre_archivo: archivo.name });
      const nombre = trabajadoras.find((u) => u.id === usuario)?.nombre;
      setHechos((h) => [{ id: r.documento.id, texto: `${r.documento.titulo} · ${nombre}` }, ...h]);
      avisar(`Subido y avisada ${nombre}`);
      // listo para la siguiente: se queda el tipo y el mes
      setUsuario(""); setArchivo(null); setTitulo(""); setPapel(false); if (input.current) input.current.value = "";
      onHecho();
    } catch (e) { avisar(e.message || "No se ha podido subir", "mal"); }
    setBusy(false);
  };

  return (
    <>
      <div className="head"><div><h2>Subir documento</h2><p className="sub">Un PDF por trabajadora. Al subirlo se le avisa en la app y por WhatsApp. Para las nóminas del mes, el tipo y el mes se quedan puestos: solo cambia la trabajadora y el archivo.</p></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 14px", maxWidth: 760 }}>
        <label className="campo">Tipo
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPapel(false); }}>
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
      {t.firma && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 14 }}>
          <input type="checkbox" checked={papel} onChange={(e) => setPapel(e.target.checked)} /> Ya está firmado en papel (solo se guarda y ella lo puede consultar)
        </label>
      )}
      <p className="pf" style={{ marginTop: 0 }}>{t.firma ? (papel ? "Se guarda como firmado." : "Quedará pendiente de firma digital.") : "Ella lo abre en la app y confirma que lo ha recibido."}</p>
      <button className="btn-p" disabled={busy} onClick={subir}>{busy ? "Subiendo…" : "Subir y avisar"}</button>
      {hechos.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="pf" style={{ fontWeight: 700 }}>Subidos ahora</div>
          {hechos.map((h) => <div key={h.id} style={{ fontSize: 13.5, padding: "3px 0" }}>✓ {h.texto}</div>)}
        </div>
      )}
    </>
  );
}

const EV = { subido: "Subido", notificado: "Avisada", abierto: "Lo abrió", descargado: "Lo descargó", recibido: "Confirmó que lo ha recibido", enviado_firma: "Enviado a firmar", firmado: "Firmado", rechazado: "Rechazó la firma", anulado: "Anulado", admin_abrir: "Abierto por dirección", admin_descargar: "Descargado por dirección" };

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
  const enviarFirma = async () => { try { await fn("enviar_firma", { id: doc.id }); avisar("Enviado a firmar"); onCambio(); } catch (e) { avisar(e.message, "mal"); } };
  const filas = useMemo(() => ev || [], [ev]);
  return (
    <Panel titulo={doc.titulo} sub={`${doc.usuarios?.nombre} · ${TIPO[doc.tipo]?.t}`} onClose={onClose}
      pie={<>
        <button className="btn-p" onClick={() => abrir("original")}>Abrir PDF</button>
        {doc.ruta_firmado && <button className="btn-l" onClick={() => abrir("firmado")}>PDF firmado</button>}
        {doc.ruta_evidencias && <button className="btn-l" onClick={() => abrir("evidencias")}>Certificado de firma</button>}
      </>}>
      <p style={{ margin: "0 0 10px" }}><Estado d={doc} /></p>
      {doc.requiere === "firma" && doc.estado !== "firmado" && doc.estado !== "anulado" && <button className="btn-l" style={{ marginBottom: 12 }} onClick={enviarFirma}>Enviar a firmar</button>}
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
