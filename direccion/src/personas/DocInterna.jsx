// Personas · Documentos · Documentación interna (#206)
// Documentos de uso interno de dirección (hoja informativa de videovigilancia, modelos para firmar en papel, procedimientos…).
// No llegan a nadie: sin recibí, sin firma y sin avisos. Una sola versión vigente por documento; las anteriores se conservan.
// El PDF se sube desde el ordenador o con «Traer desde Drive» (carpeta «Documentación interna → Vigentes»).
// #207: dentro de cada documento se ven las copias firmadas en papel subidas a la ficha de cada persona.
import { useCallback, useEffect, useRef, useState } from "react";
import { sb, supabase } from "../../../src/lib/supabase.js";
import { Cargando, avisar } from "../ui.jsx";

const fn = (accion, datos = {}) => sb.fn("doc-interna", { accion, ...datos });
const fecha = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const dia = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const hoy = () => new Date().toISOString().slice(0, 10);
const abrirUrl = async (pedir) => {
  const w = window.open("", "_blank");
  try { const r = await pedir(); if (w) w.location.href = r.url; else window.location.href = r.url; } catch (e) { if (w) w.close(); avisar(e.message, "mal"); }
};

export function DocInterna() {
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(null);
  const [nueva, setNueva] = useState("");
  const cargar = useCallback(async () => { try { setD(await fn("panel")); } catch (e) { avisar(e.message || "No se ha podido cargar la documentación interna", "mal"); setD((x) => x || { documentos: [], versiones: [], copias: [] }); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return <Cargando texto="Cargando documentación interna…" />;

  const vigente = (id) => d.versiones.find((v) => v.doc_id === id && v.vigente);
  const copias = (id) => d.copias.filter((c) => c.doc_interno_id === id && c.estado !== "anulado");
  const crear = async () => {
    try { await fn("nuevo", { titulo: nueva }); setNueva(""); avisar("Documento creado"); cargar(); } catch (e) { avisar(e.message, "mal"); }
  };

  return (
    <>
      <div className="head"><div><h2>Documentación interna</h2><p className="sub">Documentos de uso interno de dirección. Solo los ve dirección: no llegan a ninguna trabajadora ni eventual, no se pide recibí ni firma y no se avisa a nadie. Al subir una versión nueva, la anterior queda guardada como versión anterior.</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Documento</th><th>Versión vigente</th><th>Copias firmadas</th><th></th></tr></thead>
          <tbody>
            {d.documentos.map((n) => {
              const v = vigente(n.id); const c = copias(n.id).length;
              return (
                <tr key={n.id}>
                  <td><span className="pn">{n.titulo}</span></td>
                  <td>{v ? <>v{v.version}<span className="pf">en vigor desde {dia(v.vigente_desde)}</span></> : <span className="pf">Sin subir</span>}</td>
                  <td>{c > 0 ? <b>{c}</b> : <span className="pf">—</span>}</td>
                  <td className="r">
                    {v && <button className="btn-l" style={{ marginRight: 6 }} onClick={() => abrirUrl(() => fn("abrir", { id: v.id }))}>Abrir PDF</button>}
                    <button className="btn-l" onClick={() => setSel(n)}>{v ? "Ver / nueva versión" : "Subir"}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
        <label className="campo" style={{ marginBottom: 0, minWidth: 260 }}>Crear otro documento<input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="p. ej. Registro de actividades de tratamiento" /></label>
        <button className="btn-l" disabled={nueva.trim().length < 3} onClick={crear}>Añadir</button>
      </div>
      {sel && <Detalle doc={sel} d={d} copias={copias(sel.id)} onClose={() => setSel(null)} onCambio={cargar} />}
    </>
  );
}

function Detalle({ doc, d, copias, onClose, onCambio }) {
  const vs = d.versiones.filter((v) => v.doc_id === doc.id);
  const actual = vs.find((v) => v.vigente);
  const [ver, setVer] = useState("");
  const [desde, setDesde] = useState(hoy());
  const [archivo, setArchivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drive, setDrive] = useState(null); // { cargando, carpeta, archivos }
  const [deDrive, setDeDrive] = useState(null);
  const input = useRef(null);
  const abrirDrive = async () => {
    setDrive({ cargando: true, archivos: [] });
    try { const r = await fn("drive_listar"); setDrive({ cargando: false, carpeta: r.carpeta, archivos: r.archivos || [] }); }
    catch (e) { setDrive(null); avisar(e.message || "No se ha podido leer Drive", "mal"); }
  };
  const elegirDrive = (f) => {
    setDeDrive(f); setArchivo(null); if (input.current) input.current.value = "";
    setVer(f.version || ""); setDesde(f.vigente_desde || hoy()); setDrive(null);
    if (!f.version) avisar("El nombre no sigue el formato: escribe la versión y la fecha a mano", "mal");
    else if (vs.some((v) => v.version === f.version)) avisar(`«${doc.titulo}» ya tiene una versión ${f.version}; no se duplicará`, "mal");
  };
  const subir = async () => {
    if (!ver.trim()) { avisar("Escribe la versión (por ejemplo 1.1)", "mal"); return; }
    if (!archivo && !deDrive) { avisar("Elige el PDF", "mal"); return; }
    if (archivo) {
      if (archivo.type && archivo.type !== "application/pdf") { avisar("Tiene que ser un PDF", "mal"); return; }
      if (archivo.size > 15 * 1024 * 1024) { avisar("El PDF pesa más de 15 MB", "mal"); return; }
    }
    if (vs.some((v) => v.version === ver.trim())) { avisar(`«${doc.titulo}» ya tiene una versión ${ver.trim()}. Escribe otra versión.`, "mal"); return; }
    setBusy(true);
    try {
      let ruta, nombre;
      if (deDrive && !archivo) {
        const t = await fn("drive_traer", { file_id: deDrive.id });
        ruta = t.ruta; nombre = t.nombre_archivo;
      } else {
        const s = await fn("subida");
        const { error } = await supabase.storage.from("personal").uploadToSignedUrl(s.ruta, s.token, archivo, { contentType: "application/pdf" });
        if (error) throw new Error("No se ha podido subir el PDF");
        ruta = s.ruta; nombre = archivo.name;
      }
      await fn("registrar", { doc_id: doc.id, version: ver.trim(), vigente_desde: desde, ruta, nombre_archivo: nombre });
      avisar("Subido. No se ha avisado a nadie.");
      setVer(""); setArchivo(null); setDeDrive(null); if (input.current) input.current.value = "";
      onCambio();
    } catch (e) { avisar(e.message || "No se ha podido subir", "mal"); }
    setBusy(false);
  };
  return (
    <div className="card mt" style={{ border: "1px solid var(--line)" }}>
      <div className="head"><div><h3 style={{ margin: 0 }}>{doc.titulo}</h3></div><button className="btn-txt" onClick={onClose}>Cerrar</button></div>
      <h4 style={{ margin: "8px 0 4px", fontSize: 14 }}>Subir {actual ? "una versión nueva" : "el documento"}</h4>
      {actual && <p className="pf" style={{ marginTop: 0 }}>La v{actual.version} pasará a versión anterior y seguirá disponible.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 14px", maxWidth: 640 }}>
        <label className="campo">Versión<input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="1.1" /></label>
        <label className="campo">En vigor desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
      </div>
      <label className="campo" style={{ maxWidth: 640 }}>PDF<input ref={input} type="file" accept="application/pdf,.pdf" onChange={(e) => { setArchivo(e.target.files?.[0] || null); setDeDrive(null); }} /></label>
      <div style={{ maxWidth: 640, margin: "0 0 12px" }}>
        <button className="btn-l" disabled={busy} onClick={abrirDrive}>Traer desde Drive</button>
        {deDrive && !archivo && <span className="pf" style={{ marginLeft: 10 }}>Elegido de Drive: <b>{deDrive.nombre}</b></span>}
        {drive && (
          <div className="card" style={{ marginTop: 8, border: "1px solid var(--line)" }}>
            {drive.cargando ? <Cargando texto="Leyendo la carpeta de Drive…" /> : !drive.carpeta ? (
              <p className="pf" style={{ margin: 0 }}>No encuentro la carpeta «Vigentes» (TIENDA - Recao → Recursos Humanos → Documentación interna → Vigentes). Hay que dar permiso de lectura sobre esa carpeta a la cuenta claude@recao-direccion.iam.gserviceaccount.com.</p>
            ) : drive.archivos.length === 0 ? (
              <p className="pf" style={{ margin: 0 }}>La carpeta «Vigentes» de Documentación interna no tiene ningún PDF.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {drive.archivos.map((f) => (
                  <div key={f.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                    <span style={{ flex: 1, minWidth: 200 }}><b>{f.nombre}</b>{f.version ? <span className="pf"> · v{f.version} · en vigor {dia(f.vigente_desde)}</span> : <span className="pf"> · nombre sin el formato esperado</span>}</span>
                    <button className="btn-l" onClick={() => elegirDrive(f)}>Elegir</button>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-txt" style={{ marginTop: 6 }} onClick={() => setDrive(null)}>Cerrar</button>
          </div>
        )}
      </div>
      <button className="btn-p" disabled={busy} onClick={subir}>{busy ? "Subiendo…" : "Subir (sin avisar a nadie)"}</button>

      {vs.length > 0 && <h4 style={{ margin: "20px 0 4px", fontSize: 14 }}>Versiones</h4>}
      {vs.map((v) => (
        <div key={v.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0", opacity: v.vigente ? 1 : 0.8, display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <b>v{v.version}</b>
          <span className="pf" style={{ color: "inherit" }}>{v.vigente ? "Vigente" : `Anterior (sustituida ${fecha(v.retirada_en)})`} · en vigor desde {dia(v.vigente_desde)} · subida {fecha(v.subido_en)}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="btn-l" onClick={() => abrirUrl(() => fn("abrir", { id: v.id }))}>Abrir PDF</button>
            <button className="btn-l" onClick={() => abrirUrl(() => fn("abrir", { id: v.id, descargar: true }))}>Descargar</button>
          </span>
        </div>
      ))}

      <h4 style={{ margin: "20px 0 4px", fontSize: 14 }}>Copias firmadas en papel</h4>
      {copias.length === 0 ? (
        <p className="pf" style={{ marginTop: 0 }}>Ninguna todavía. Se suben a la ficha de cada persona en «Subir documento», con tipo «Otro documento» o «Certificado», marcando «Ya firmado en papel» y eligiendo este documento.</p>
      ) : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Persona</th><th>Subida</th><th></th></tr></thead>
            <tbody>
              {copias.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.usuarios?.nombre}</b>{c.usuarios?.eventual && <span className="pf">Eventual</span>}</td>
                  <td>{fecha(c.subido_en)}</td>
                  <td className="r"><button className="btn-l" onClick={() => abrirUrl(() => sb.fn("documentos", { accion: "abrir", id: c.id, cual: "original" }))}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
