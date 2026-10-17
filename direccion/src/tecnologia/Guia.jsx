// Tecnología · Cómo pedir: instrucciones para que el Claude de cada socio prepare la solicitud.
// El texto vive en la tabla tec_textos (clave guia_claude) y se puede editar desde aquí.
import { useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { avisar, hace, Cargando } from "../ui.jsx";
import "./tecnologia.css";

const CLAVE = "guia_claude";

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch (e) {
    const t = document.createElement("textarea"); t.value = texto; document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (er) { ok = false; }
    t.remove(); return ok;
  }
}

export function TecGuia() {
  const [g, setG] = useState(null);
  const [editar, setEditar] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    sb.select("tec_textos", `select=*&clave=eq.${CLAVE}`).then((r) => setG(r[0] || { texto: "" })).catch(() => setG({ texto: "" }));
  }, []);
  if (!g) return <Cargando />;
  const guardar = async () => {
    setBusy(true);
    try {
      const r = await sb.upsert("tec_textos", { clave: CLAVE, texto: borrador }, "clave");
      setG((Array.isArray(r) ? r[0] : r) || { ...g, texto: borrador, actualizado_en: new Date().toISOString() });
      setEditar(false); avisar("Instrucciones guardadas");
    } catch (e) { avisar("No se han podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <div className="guia">
      <div className="guia-pasos">
        <div className="guia-paso"><i>1</i><b>Háblalo con tu Claude</b><p>Crea en Claude un Proyecto llamado «Recao · Solicitudes» y pega estas instrucciones en las instrucciones del proyecto. Cada chat que abras ahí ya sabe cómo es Recao y qué necesitamos. Si no usas proyectos, pégalas al empezar el chat.</p></div>
        <div className="guia-paso"><i>2</i><b>Crea la solicitud</b><p>Cuando tu Claude te dé el documento, cópialo, ve a Solicitudes → «+ Nueva solicitud» y pégalo en el recuadro de arriba. Se rellenan título, urgencia, tipo, dónde y área; revísalos y envía. Una necesidad, una solicitud.</p></div>
        <div className="guia-paso"><i>3</i><b>Sigue el estado</b><p>Te llega un aviso (campana y correo) si hay una pregunta, cuando está lista para revisar y cuando cambia de estado. Al revisarla, marca «Sí, funciona» o «Pedir cambios» y explica qué falla.</p></div>
      </div>

      <section className="guia-caja">
        <div className="guia-cab">
          <div><h2>Instrucciones para tu Claude</h2>{g.actualizado_en && <small>Última edición {hace(g.actualizado_en)}{g.actualizado_por ? ` · ${g.actualizado_por}` : ""}</small>}</div>
          {!editar ? (
            <div className="sol-botones">
              <button className="btn-txt" onClick={() => { setBorrador(g.texto || ""); setEditar(true); }}>Editar</button>
              <button className="btn-p" disabled={!g.texto} onClick={async () => avisar((await copiar(g.texto)) ? "Copiadas: pégalas en tu Claude" : "No se han podido copiar", "ok")}>Copiar instrucciones</button>
            </div>
          ) : (
            <div className="sol-botones">
              <button className="btn-txt" onClick={() => setEditar(false)}>Cancelar</button>
              <button className="btn-p" disabled={busy || !borrador.trim()} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          )}
        </div>
        {editar ? <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} aria-label="Instrucciones" /> : <pre className="guia-texto">{g.texto || "Todavía no hay instrucciones."}</pre>}
        <p className="guia-nota">Si cambias algo aquí (una norma nueva, una línea roja), los demás tienen que volver a copiarlas en su proyecto de Claude.</p>
      </section>
    </div>
  );
}
