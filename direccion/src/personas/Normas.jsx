// Personas · Documentos · Normas y protocolos (#179)
// Se sube una sola vez y llega a toda la plantilla (principales y apoyos; las eventuales no). Se pide recibí, no firma.
// Una sola versión vigente por documento; las anteriores se conservan con sus recibís como prueba de entrega.
import { useCallback, useEffect, useRef, useState } from "react";
import { sb, supabase } from "../../../src/lib/supabase.js";
import { Cargando, avisar } from "../ui.jsx";

const fn = (accion, datos = {}) => sb.fn("normas", { accion, ...datos });
const fecha = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const dia = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const hoy = () => new Date().toISOString().slice(0, 10);

export function Normas() {
  const [d, setD] = useState(null);
  const [sel, setSel] = useState(null);
  const [nueva, setNueva] = useState("");
  const cargar = useCallback(async () => { try { setD(await fn("panel")); } catch (e) { avisar(e.message || "No se han podido cargar las normas", "mal"); setD((x) => x || { normas: [], versiones: [], recibos: [], plantilla: [] }); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return <Cargando texto="Cargando normas…" />;

  const vigente = (id) => d.versiones.find((v) => v.norma_id === id && v.vigente);
  const resumen = (v) => {
    const rs = d.recibos.filter((r) => r.version_id === v.id);
    const por = new Map(rs.map((r) => [r.usuario_id, r]));
    return { total: d.plantilla.length, ok: d.plantilla.filter((u) => por.get(u.id)?.recibido_en).length, por };
  };
  const crear = async () => {
    try { await fn("nueva_norma", { titulo: nueva }); setNueva(""); avisar("Documento creado"); cargar(); } catch (e) { avisar(e.message, "mal"); }
  };
  const abrir = async (v) => {
    const w = window.open("", "_blank");
    try { const r = await fn("abrir", { id: v.id }); if (w) w.location.href = r.url; else window.location.href = r.url; } catch (e) { if (w) w.close(); avisar(e.message, "mal"); }
  };

  return (
    <>
      <div className="head"><div><h2>Normas y protocolos</h2><p className="sub">Se suben una sola vez y llegan a toda la plantilla ({d.plantilla.length} personas, principales y apoyos). Las eventuales no las reciben. Se pide recibí, no firma. Al subir una versión nueva, la anterior deja de verse en la app pero queda guardada con todos sus recibís.</p></div></div>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Documento</th><th>Versión vigente</th><th>Recibís</th><th></th></tr></thead>
          <tbody>
            {d.normas.map((n) => {
              const v = vigente(n.id); const r = v && resumen(v);
              return (
                <tr key={n.id}>
                  <td><span className="pn">{n.titulo}</span></td>
                  <td>{v ? <>v{v.version}<span className="pf">en vigor desde {dia(v.vigente_desde)}</span></> : <span className="pf">Sin subir</span>}</td>
                  <td>{v ? <b style={{ color: r.ok === r.total ? "var(--up)" : "#8A5A0B" }}>{r.ok} de {r.total}</b> : "—"}</td>
                  <td className="r"><button className="btn-l" onClick={() => setSel(n)}>{v ? "Ver / nueva versión" : "Subir"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
        <label className="campo" style={{ marginBottom: 0, minWidth: 260 }}>Crear otro documento<input value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="p. ej. Protocolo de apertura y cierre" /></label>
        <button className="btn-l" disabled={nueva.trim().length < 3} onClick={crear}>Añadir</button>
      </div>
      {sel && <Detalle norma={sel} d={d} resumen={resumen} abrir={abrir} onClose={() => setSel(null)} onCambio={() => { cargar(); }} />}
    </>
  );
}

function Detalle({ norma, d, resumen, abrir, onClose, onCambio }) {
  const vs = d.versiones.filter((v) => v.norma_id === norma.id);
  const actual = vs.find((v) => v.vigente);
  const [ver, setVer] = useState("");
  const [desde, setDesde] = useState(hoy());
  const [archivo, setArchivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drive, setDrive] = useState(null); // { cargando, carpeta, archivos } al abrir «Traer desde Drive»
  const [deDrive, setDeDrive] = useState(null); // archivo elegido en Drive
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
    else if (vs.some((v) => v.version === f.version)) avisar(`«${norma.titulo}» ya tiene una versión ${f.version}; no se duplicará`, "mal");
  };
  const subir = async () => {
    if (!ver.trim()) { avisar("Escribe la versión (por ejemplo 2.1)", "mal"); return; }
    if (!archivo && !deDrive) { avisar("Elige el PDF", "mal"); return; }
    if (archivo) {
      if (archivo.type && archivo.type !== "application/pdf") { avisar("Tiene que ser un PDF", "mal"); return; }
      if (archivo.size > 15 * 1024 * 1024) { avisar("El PDF pesa más de 15 MB", "mal"); return; }
    }
    if (vs.some((v) => v.version === ver.trim())) { avisar(`«${norma.titulo}» ya tiene una versión ${ver.trim()}. Escribe otra versión.`, "mal"); return; }
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
      const r = await fn("registrar", { norma_id: norma.id, version: ver.trim(), vigente_desde: desde, ruta, nombre_archivo: nombre });
      avisar(`Subida. Avisadas ${r.avisadas} personas de la plantilla`);
      setVer(""); setArchivo(null); setDeDrive(null); if (input.current) input.current.value = "";
      onCambio();
    } catch (e) { avisar(e.message || "No se ha podido subir", "mal"); }
    setBusy(false);
  };
  const Seguimiento = ({ v }) => {
    const { por } = resumen(v);
    return (
      <div style={{ display: "grid", gap: 4, margin: "8px 0 12px" }}>
        {d.plantilla.map((u) => {
          const r = por.get(u.id);
          const t = r?.recibido_en ? `Recibida el ${fecha(r.recibido_en)}` : r?.visto_en ? `La abrió el ${fecha(r.visto_en)}, sin confirmar` : !u.documentos_electronicos_en ? "Aún no ha aceptado recibir documentos en la app" : "No la ha abierto";
          return <div key={u.id} style={{ fontSize: 13, display: "flex", gap: 8 }}><span style={{ color: r?.recibido_en ? "var(--up)" : "#8A5A0B", fontWeight: 700 }}>{r?.recibido_en ? "✓" : "•"}</span><span><b>{u.nombre}</b> · {t}</span></div>;
        })}
      </div>
    );
  };
  return (
    <div className="card mt" style={{ border: "1px solid var(--line)" }}>
      <div className="head"><div><h3 style={{ margin: 0 }}>{norma.titulo}</h3></div><button className="btn-txt" onClick={onClose}>Cerrar</button></div>
      <h4 style={{ margin: "8px 0 4px", fontSize: 14 }}>Subir {actual ? "una versión nueva" : "el documento"}</h4>
      {actual && <p className="pf" style={{ marginTop: 0 }}>La v{actual.version} dejará de verse en la app y la nueva aparecerá como pendiente para toda la plantilla.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 14px", maxWidth: 640 }}>
        <label className="campo">Versión<input value={ver} onChange={(e) => setVer(e.target.value)} placeholder="2.1" /></label>
        <label className="campo">En vigor desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
      </div>
      <label className="campo" style={{ maxWidth: 640 }}>PDF<input ref={input} type="file" accept="application/pdf,.pdf" onChange={(e) => { setArchivo(e.target.files?.[0] || null); setDeDrive(null); }} /></label>
      <div style={{ maxWidth: 640, margin: "0 0 12px" }}>
        <button className="btn-l" disabled={busy} onClick={abrirDrive}>Traer desde Drive</button>
        {deDrive && !archivo && <span className="pf" style={{ marginLeft: 10 }}>Elegido de Drive: <b>{deDrive.nombre}</b></span>}
        {drive && (
          <div className="card" style={{ marginTop: 8, border: "1px solid var(--line)" }}>
            {drive.cargando ? <Cargando texto="Leyendo la carpeta de Drive…" /> : !drive.carpeta ? (
              <p className="pf" style={{ margin: 0 }}>No encuentro la carpeta «Vigentes» (TIENDA - Recao → Recursos Humanos → Normas y protocolos → Vigentes). Hay que dar permiso de lectura sobre esa carpeta a la cuenta claude@recao-direccion.iam.gserviceaccount.com.</p>
            ) : drive.archivos.length === 0 ? (
              <p className="pf" style={{ margin: 0 }}>La carpeta «Vigentes» no tiene ningún PDF.</p>
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
      <button className="btn-p" disabled={busy} onClick={subir}>{busy ? "Subiendo…" : "Subir y pedir el recibí"}</button>
      {vs.length > 0 && <h4 style={{ margin: "20px 0 4px", fontSize: 14 }}>Versiones y seguimiento</h4>}
      {vs.map((v) => {
        const r = resumen(v);
        return (
          <div key={v.id} style={{ borderTop: "1px solid var(--line)", padding: "10px 0", opacity: v.vigente ? 1 : 0.8 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <b>v{v.version}</b>
              <span className="pf" style={{ color: "inherit" }}>{v.vigente ? "Vigente" : `Anterior (retirada ${fecha(v.retirada_en)})`} · en vigor desde {dia(v.vigente_desde)} · subida {fecha(v.subido_en)}</span>
              <b style={{ marginLeft: "auto" }}>{r.ok} de {r.total}</b>
              <button className="btn-l" onClick={() => abrir(v)}>Abrir PDF</button>
            </div>
            <Seguimiento v={v} />
            {!v.vigente && <p className="pf" style={{ margin: 0 }}>Solo se muestran quienes siguen en plantilla; los recibís de quien ya no lo está siguen guardados.</p>}
          </div>
        );
      })}
    </div>
  );
}
