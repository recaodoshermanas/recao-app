// Personas · Documentos · Nóminas de la gestoría (#30)
// La gestoría manda un PDF con las nóminas de todas. Se separa solo por NIF y mes; dirección lo revisa y pulsa
// «Aprobar y publicar»: cada nómina aparece en «Mis documentos» de su trabajadora y le llega el aviso de siempre.
// Lo que no se puede asignar (NIF sin dar de alta, sin NIF, sin periodo) no se publica y sale aquí como aviso.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb, supabase } from "../../../src/lib/supabase.js";
import { Cargando, avisar, hace } from "../ui.jsx";

const fn = (accion, datos = {}) => sb.fn("nominas", { accion, ...datos });
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesTxt = (m) => (m ? `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}` : "—");
const LETRAS = "TRWAGMYFPDXBNJZSQVHLCKE";
const limpiarNif = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
function nifValido(n) {
  const m = n.match(/^([XYZ]?)(\d{7,8})([A-Z])$/);
  if (!m || (m[1] ? m[2].length !== 7 : m[2].length !== 8)) return false;
  return LETRAS[Number((m[1] ? String("XYZ".indexOf(m[1])) : "") + m[2]) % 23] === m[3];
}
const ESTADO = {
  lista: { t: "Lista", c: "#2F5C8F" },
  publicada: { t: "Publicada", c: "var(--up)" },
  sin_asignar: { t: "Sin asignar", c: "var(--down)" },
  error: { t: "Error", c: "var(--down)" },
  a_mano: { t: "Gestionada a mano", c: "var(--muted)" },
};
const mesAnterior = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

async function abrirPdf(datos) {
  const w = window.open("", "_blank");
  try { const r = await fn("ver", datos); if (w) w.location.href = r.url; else window.location.href = r.url; }
  catch (e) { if (w) w.close(); avisar(e.message, "mal"); }
}

export function NominasGestoria({ trabajadoras }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);
  const cargar = useCallback(async () => {
    try {
      const [lotes, partes, nifs] = await Promise.all([
        sb.select("nominas_lotes", "select=*&order=recibido_en.desc&limit=60"),
        sb.select("nominas_partes", "select=*&order=id.asc&limit=2000"),
        sb.select("usuarios_nif", "select=usuario_id,nif"),
      ]);
      setD({ lotes, partes, nifs });
    } catch (e) { avisar(e.message || "No se han podido cargar las nóminas", "mal"); setD((x) => x || { lotes: [], partes: [], nifs: [] }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const nombre = useMemo(() => Object.fromEntries((trabajadoras || []).map((u) => [u.id, u.nombre])), [trabajadoras]);
  if (!d) return <Cargando texto="Cargando nóminas…" />;

  const porLote = (id) => d.partes.filter((p) => p.lote_id === id);
  const lotesVivos = d.lotes.filter((l) => l.estado !== "descartado");
  const porAprobar = lotesVivos.filter((l) => l.estado === "por_aprobar");
  const publicados = lotesVivos.filter((l) => l.estado === "publicado");
  const lotePorId = Object.fromEntries(d.lotes.map((l) => [l.id, l]));
  const problemas = d.partes.filter((p) => ["sin_asignar", "error"].includes(p.estado) && lotePorId[p.lote_id] && lotePorId[p.lote_id].estado !== "descartado");
  // Aviso del día 10: las nóminas del mes anterior siguen sin publicar
  const hoy = new Date();
  const mesAnt = `${mesAnterior()}-01`;
  const publicadasMesAnt = d.partes.some((p) => p.mes === mesAnt && p.estado === "publicada");
  const listasMesAnt = d.partes.some((p) => p.mes === mesAnt && p.estado === "lista");
  const avisoDia10 = hoy.getDate() >= 10 && !publicadasMesAnt;

  const aprobar = async (l) => {
    const n = porLote(l.id).filter((p) => ["lista", "error"].includes(p.estado) && p.usuario_id && p.mes).length;
    if (!n) { avisar("No hay ninguna nómina asignada en este lote", "mal"); return; }
    if (!window.confirm(l.sin_avisar ? `Se guardan ${n} nóminas en «Mis documentos» de cada trabajadora SIN avisarles (carga inicial). ¿Seguimos?` : `Se publican ${n} nóminas en la app y a cada trabajadora le llega el aviso de que tiene su nómina. ¿Seguimos?`)) return;
    setBusy(`a${l.id}`);
    try { const r = await fn("aprobar", { lote_id: l.id }); avisar(r.errores?.length ? `Publicadas ${r.publicadas}; ${r.errores.length} con error (se reintentan mañana)` : `Publicadas ${r.publicadas} nóminas`, r.errores?.length ? "mal" : "ok"); await cargar(); }
    catch (e) { avisar(e.message, "mal"); }
    setBusy(null);
  };
  const descartar = async (l) => {
    if (!window.confirm("Se descarta este PDF: no se publica nada de él. ¿Seguimos?")) return;
    setBusy(`d${l.id}`);
    try { await fn("descartar", { lote_id: l.id }); avisar("Descartado"); await cargar(); } catch (e) { avisar(e.message, "mal"); }
    setBusy(null);
  };

  return (
    <>
      <div className="head"><div><h2>Nóminas de la gestoría</h2><p className="sub">La gestoría manda un PDF con todas las nóminas. Se separa solo por NIF y mes. Revísalo y pulsa «Aprobar y publicar»: cada trabajadora la verá en «Mis documentos» y le llegará el aviso. Nada se publica sin aprobarlo aquí.</p></div></div>

      {(avisoDia10 || problemas.length > 0) && (
        <div style={{ border: "1.5px solid var(--down)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Avisos</div>
          {avisoDia10 && <div style={{ fontSize: 13.5, marginBottom: 6 }}>Las nóminas de {mesTxt(mesAnt)} no se han enviado. Motivo: {listasMesAnt ? "no se ha aprobado el envío." : "no ha llegado el correo de la gestoría (o no se ha subido el PDF)."}</div>}
          {problemas.map((p) => <Problema key={p.id} p={p} lote={lotePorId[p.lote_id]} trabajadoras={trabajadoras} nombre={nombre} onHecho={cargar} />)}
        </div>
      )}

      {porAprobar.length === 0 ? <p className="empty">No hay nóminas pendientes de aprobar.</p> : porAprobar.map((l) => (
        <Lote key={l.id} l={l} partes={porLote(l.id)} nombre={nombre}
          acciones={<>
            <button className="btn-p" disabled={!!busy} onClick={() => aprobar(l)}>{busy === `a${l.id}` ? "Publicando…" : l.sin_avisar ? "Aprobar y guardar sin avisar" : "Aprobar y publicar"}</button>
            <button className="btn-txt" disabled={!!busy} onClick={() => descartar(l)}>Descartar</button>
          </>} />
      ))}

      <Subir onHecho={cargar} />
      <Nifs trabajadoras={trabajadoras} nifs={d.nifs} onHecho={cargar} />
      <Correo />

      {publicados.length > 0 && (
        <details style={{ marginTop: 18 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Publicadas ({publicados.length})</summary>
          {publicados.map((l) => <Lote key={l.id} l={l} partes={porLote(l.id)} nombre={nombre} />)}
        </details>
      )}
    </>
  );
}

function Lote({ l, partes, nombre, acciones }) {
  const meses = [...new Set(partes.map((p) => p.mes).filter(Boolean))].sort();
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14, margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <b>Nóminas de {meses.map(mesTxt).join(" y ") || "mes sin leer"}</b>
          <span className="pf">{l.origen === "gmail" ? "Del correo de la gestoría" : "Subido a mano"} · {hace(l.recibido_en)} · {l.paginas} página{l.paginas === 1 ? "" : "s"}{l.sin_avisar ? " · carga inicial: sin avisar" : ""}{l.estado === "publicado" && l.aprobado_en ? ` · aprobado ${hace(l.aprobado_en)}` : ""}</span>
        </div>
        <button className="btn-txt" onClick={() => abrirPdf({ lote_id: l.id })}>PDF completo</button>
      </div>
      <div className="tabla-scroll">
        <table className="ranking" style={{ marginTop: 8 }}>
          <thead><tr><th>Trabajadora</th><th>Mes</th><th>Páginas</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {partes.map((p) => (
              <tr key={p.id}>
                <td>{p.usuario_id ? (nombre[p.usuario_id] || "—") : <span className="pf" style={{ color: "inherit" }}>{p.nif ? `NIF ${p.nif}` : "Sin NIF"}</span>}</td>
                <td>{mesTxt(p.mes)}</td>
                <td>{p.paginas.join(", ")}</td>
                <td><span style={{ color: ESTADO[p.estado]?.c, fontWeight: 700, fontSize: 13 }}>{ESTADO[p.estado]?.t || p.estado}</span>{p.motivo && <span className="pf">{p.motivo}</span>}</td>
                <td className="r"><button className="btn-l" onClick={() => abrirPdf({ parte_id: p.id })}>Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {acciones && <div className="sol-botones" style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>{acciones}</div>}
    </div>
  );
}

function Problema({ p, lote, trabajadoras, nombre, onHecho }) {
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState(p.usuario_id || "");
  const [mes, setMes] = useState(p.mes ? p.mes.slice(0, 7) : mesAnterior());
  const [busy, setBusy] = useState(false);
  const hacer = async (accion, datos, ok) => {
    setBusy(true);
    try { const r = await fn(accion, { parte_id: p.id, ...datos }); avisar(typeof ok === "function" ? ok(r) : ok); onHecho(); } catch (e) { avisar(e.message, "mal"); }
    setBusy(false);
  };
  return (
    <div style={{ fontSize: 13.5, borderTop: "1px solid var(--line)", padding: "8px 0" }}>
      <div><b>{p.estado === "error" ? "No se ha podido publicar" : "Sin asignar"}</b> · pág. {p.paginas.join(", ")} del PDF de {mesTxt(p.mes)} ({hace(lote.recibido_en)}) · {p.motivo}{p.usuario_id ? ` · ${nombre[p.usuario_id] || ""}` : p.nif ? ` · NIF ${p.nif}` : ""}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        <button className="btn-l" onClick={() => abrirPdf({ parte_id: p.id })}>Ver página</button>
        <button className="btn-l" onClick={() => setAbierto((x) => !x)}>Asignar a una trabajadora</button>
        <button className="btn-txt" disabled={busy} onClick={() => window.confirm("Se marca como gestionada a mano (por ejemplo, una eventual a la que se la das tú). El aviso desaparece. ¿Seguimos?") && hacer("a_mano", {}, "Marcada como gestionada a mano")}>Gestionada a mano</button>
      </div>
      {abierto && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
          <label className="campo" style={{ marginBottom: 0 }}>Trabajadora
            <select value={usuario} onChange={(e) => setUsuario(e.target.value)}>
              <option value="">Elige…</option>
              {trabajadoras.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.activo ? "" : " (baja)"}</option>)}
            </select>
          </label>
          <label className="campo" style={{ marginBottom: 0 }}>Mes<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
          <button className="btn-p" disabled={busy || !usuario} onClick={() => hacer("asignar", { usuario_id: usuario, mes }, (r) => (r.publicada ? "Asignada y publicada" : "Asignada: se publica al aprobar el lote"))}>{busy ? "Guardando…" : "Asignar"}</button>
        </div>
      )}
    </div>
  );
}

function Subir({ onHecho }) {
  const [archivo, setArchivo] = useState(null);
  const [sinAvisar, setSinAvisar] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const subir = async () => {
    if (!archivo) { avisar("Elige el PDF de la gestoría", "mal"); return; }
    if (archivo.type && archivo.type !== "application/pdf") { avisar("Tiene que ser un PDF", "mal"); return; }
    if (archivo.size > 20 * 1024 * 1024) { avisar("El PDF pesa más de 20 MB", "mal"); return; }
    setBusy(true);
    try {
      const s = await fn("subida");
      const { error } = await supabase.storage.from("personal").uploadToSignedUrl(s.ruta, s.token, archivo, { contentType: "application/pdf" });
      if (error) throw new Error("No se ha podido subir el PDF");
      const r = await fn("procesar", { ruta: s.ruta, nombre: archivo.name, sin_avisar: sinAvisar });
      avisar(r.repetido ? "Ese PDF ya estaba cargado" : `Separadas ${r.listas} nóminas${r.sin_asignar ? `; ${r.sin_asignar} página${r.sin_asignar === 1 ? "" : "s"} sin asignar` : ""}. Revísalas y aprueba.`, r.sin_asignar ? "mal" : "ok");
      setArchivo(null); setSinAvisar(false); if (input.current) input.current.value = "";
      onHecho();
    } catch (e) { avisar(e.message || "No se ha podido procesar", "mal"); }
    setBusy(false);
  };
  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 14 }}>
      <h3 style={{ fontSize: 15, margin: "0 0 4px" }}>Subir el PDF de la gestoría</h3>
      <p className="pf" style={{ marginTop: 0 }}>Si el correo automático no está conectado, o para cargar meses antiguos. Se separa igual y queda pendiente de aprobar.</p>
      <label className="campo" style={{ maxWidth: 560 }}>PDF con las nóminas<input ref={input} type="file" accept="application/pdf,.pdf" onChange={(e) => setArchivo(e.target.files?.[0] || null)} /></label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 12 }}>
        <input type="checkbox" checked={sinAvisar} onChange={(e) => setSinAvisar(e.target.checked)} /> Meses antiguos: guardar sin avisar a las trabajadoras
      </label>
      <button className="btn-p" disabled={busy} onClick={subir}>{busy ? "Separando…" : "Subir y separar"}</button>
    </div>
  );
}

function Nifs({ trabajadoras, nifs, onHecho }) {
  const actual = useMemo(() => Object.fromEntries(nifs.map((n) => [n.usuario_id, n.nif])), [nifs]);
  const [val, setVal] = useState({});
  const [busy, setBusy] = useState(null);
  const lista = [...trabajadoras].sort((a, b) => (b.activo - a.activo) || a.nombre.localeCompare(b.nombre, "es"));
  const guardar = async (u) => {
    const nif = limpiarNif(val[u.id]);
    if (!nifValido(nif)) { avisar("Ese NIF no es válido (revisa la letra)", "mal"); return; }
    setBusy(u.id);
    try { await sb.upsert("usuarios_nif", { usuario_id: u.id, nif, actualizado_en: new Date().toISOString() }, "usuario_id"); avisar(`NIF de ${u.nombre} guardado`); setVal((v) => ({ ...v, [u.id]: undefined })); onHecho(); }
    catch (e) { avisar(/duplicate|unique/i.test(e.message || "") ? "Ese NIF ya lo tiene otra trabajadora" : e.message || "No se ha podido guardar", "mal"); }
    setBusy(null);
  };
  const conNif = lista.filter((u) => actual[u.id]).length;
  return (
    <details style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 14 }} open={conNif === 0}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 15 }}>NIF de las trabajadoras ({conNif} dados de alta)</summary>
      <p className="pf">Cada nómina se asigna por el NIF que trae la página, nunca por el nombre. Da de alta solo a quien deba recibirla en la app; las eventuales sin NIF aquí quedan «Sin asignar» y las gestionas tú. Solo lo ve dirección.</p>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Trabajadora</th><th>NIF</th><th></th></tr></thead>
          <tbody>
            {lista.map((u) => {
              const v = val[u.id] ?? actual[u.id] ?? "";
              const cambiado = val[u.id] !== undefined && limpiarNif(val[u.id]) !== (actual[u.id] || "");
              return (
                <tr key={u.id}>
                  <td>{u.nombre}{u.activo ? "" : <span className="pf">baja</span>}</td>
                  <td><input value={v} onChange={(e) => setVal((x) => ({ ...x, [u.id]: e.target.value }))} placeholder="12345678Z" aria-label={`NIF de ${u.nombre}`} style={{ width: 130, textTransform: "uppercase" }} /></td>
                  <td className="r">{cambiado && <button className="btn-l" disabled={busy === u.id} onClick={() => guardar(u)}>{busy === u.id ? "Guardando…" : "Guardar"}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Correo() {
  const [s, setS] = useState(null);
  const ver = async () => { try { setS(await fn("script")); } catch (e) { avisar(e.message, "mal"); } };
  const codigo = s && `// Recao · Nóminas de la gestoría → panel de dirección. Se ejecuta solo una vez al día.
const URL_NOMINAS = '${s.url}';
const CLAVE = '${s.clave}';
const REMITENTE = '${s.remitente}';
const ETIQUETA = 'recao-nominas-procesadas';

function revisarNominas() {
  const etiqueta = GmailApp.getUserLabelByName(ETIQUETA) || GmailApp.createLabel(ETIQUETA);
  const hilos = GmailApp.search('from:' + REMITENTE + ' has:attachment filename:pdf -label:' + ETIQUETA + ' newer_than:400d', 0, 20);
  hilos.forEach(function (hilo) {
    let ok = true;
    hilo.getMessages().forEach(function (m) {
      if (m.getFrom().toLowerCase().indexOf(REMITENTE) < 0) return;
      const pdfs = m.getAttachments({ includeInlineImages: false }).filter(function (a) { return /pdf/i.test(a.getContentType()) || /\\.pdf$/i.test(a.getName()); });
      if (!pdfs.length) return;
      const r = UrlFetchApp.fetch(URL_NOMINAS, {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-ingesta-key': CLAVE },
        payload: JSON.stringify({ accion: 'ingesta', message_id: m.getId(), subject: m.getSubject(), from: m.getFrom(), fecha: m.getDate().toISOString(),
          adjuntos: pdfs.map(function (a) { return { nombre: a.getName(), mime: a.getContentType(), base64: Utilities.base64Encode(a.getBytes()) }; }) })
      });
      if (r.getResponseCode() !== 200) ok = false;
    });
    if (ok) hilo.addLabel(etiqueta);
  });
}

// Ejecuta esta función UNA vez: deja programada la revisión diaria (8–9 h) y hace la primera ahora
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'revisarNominas') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('revisarNominas').timeBased().everyDays(1).atHour(8).create();
  revisarNominas();
}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(codigo); avisar("Copiado"); } catch (e) { avisar("No se ha podido copiar; selecciónalo a mano", "mal"); } };
  return (
    <details style={{ borderTop: "1px solid var(--line)", marginTop: 18, paddingTop: 14 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 15 }}>Correo automático de la gestoría</summary>
      <p className="pf">Un pequeño programa dentro de la cuenta de Google de Recao revisa el correo cada mañana y manda aquí los PDF de nóminas de la gestoría. Solo mira los correos de ese remitente. No caduca ni hay que renovarlo.</p>
      <ol style={{ fontSize: 13.5, lineHeight: 1.6, paddingLeft: 18 }}>
        <li>Con la sesión de recao.doshermanas@gmail.com abierta, entra en <b>script.google.com</b> → «Nuevo proyecto» y llámalo «Nóminas Recao».</li>
        <li>Borra lo que haya y pega el código de abajo. Guarda.</li>
        <li>Arriba elige la función <b>instalar</b> y pulsa «Ejecutar». Google pedirá permiso: acepta con la cuenta de Recao (si sale «Google no ha verificado esta aplicación», pulsa «Configuración avanzada» → «Ir a Nóminas Recao»: es vuestro propio programa).</li>
        <li>Listo. La primera vez carga también las nóminas antiguas (hasta septiembre de 2026 se guardan sin avisar a nadie) y aparecen aquí para aprobar.</li>
      </ol>
      {!s ? <button className="btn-l" onClick={ver}>Ver el código</button> : (
        <>
          <p className="pf" style={{ color: "var(--down)" }}>El código lleva una clave privada: no lo compartas ni lo pegues en chats.</p>
          <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, maxHeight: 260, overflow: "auto" }}>{codigo}</pre>
          <button className="btn-p" onClick={copiar}>Copiar código</button>
        </>
      )}
    </details>
  );
}
