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
        <div className="guia-paso"><i>1</i><b>Pide el documento a tu Claude</b><p>En el chat donde lo estés hablando, cuando lo tengas claro, pega estas instrucciones. Te devuelve la solicitud con el formato que necesita Claude para construirla sin tener que preguntarte.</p></div>
        <div className="guia-paso"><i>2</i><b>Crea la solicitud</b><p>Cuando tu Claude te dé el documento, cópialo, ve a Solicitudes → «+ Nueva solicitud» y pégalo en el recuadro de arriba. Se rellenan título, urgencia, tipo, dónde y área; revísalos y envía. Una necesidad, una solicitud.</p></div>
        <div className="guia-paso"><i>3</i><b>Sigue el estado</b><p>Te llega un aviso (campana y correo) si hay una pregunta, cuando está lista para revisar y cuando cambia de estado. Al revisarla, marca «Sí, funciona» o «Pedir cambios» y explica qué falla.</p></div>
      </div>

      <section className="guia-caja">
        <div className="guia-cab">
          <div><h2>Formato de la solicitud</h2>{g.actualizado_en && <small>Última edición {hace(g.actualizado_en)}{g.actualizado_por ? ` · ${g.actualizado_por}` : ""}</small>}</div>
          {!editar ? (
            <div className="sol-botones">
              <button className="btn-txt" onClick={() => { setBorrador(g.texto || ""); setEditar(true); }}>Editar</button>
              <button className="btn-p" disabled={!g.texto} onClick={async () => avisar((await copiar(g.texto)) ? "Copiadas: pégalas en tu chat" : "No se han podido copiar", "ok")}>Copiar instrucciones</button>
            </div>
          ) : (
            <div className="sol-botones">
              <button className="btn-txt" onClick={() => setEditar(false)}>Cancelar</button>
              <button className="btn-p" disabled={busy || !borrador.trim()} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>
            </div>
          )}
        </div>
        {editar ? <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} aria-label="Instrucciones" /> : <pre className="guia-texto">{g.texto || "Todavía no hay instrucciones."}</pre>}
        <p className="guia-nota">Si cambias algo aquí (una norma nueva, una línea roja), los demás usarán la versión nueva la próxima vez que las copien.</p>
      </section>
      <Automatizacion />
    </div>
  );
}

// Claude atiende la cola solo: cada solicitud nueva (o que vuelve a «por hacer») lanza su tarea programada al momento.
// La llave de la tarea la genera Adrián en claude.ai/code/routines y se guarda aquí; nunca se vuelve a mostrar.
function Automatizacion() {
  const [e, setE] = useState(null);
  const [llave, setLlave] = useState("");
  const [busy, setBusy] = useState(false);
  const cargar = () => sb.rpc("tec_auto_estado").then(setE).catch(() => setE(false));
  useEffect(() => { cargar(); }, []);
  if (!e) return null;
  const guardar = async (valor) => {
    setBusy(true);
    try { setE(await sb.rpc("tec_auto_guardar_token", { p_token: valor })); setLlave(""); avisar(valor ? "Automatización conectada" : "Automatización desconectada"); }
    catch (er) { avisar(er.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  const ok = e.ultimo_status === 200;
  return (
    <section className="guia-caja" style={{ marginTop: 14 }}>
      <div className="guia-cab">
        <div><h2>Claude atiende la cola solo</h2><small>{e.conectada ? "Conectada" : "Sin conectar"}{e.ultimo_en ? ` · último aviso ${hace(e.ultimo_en)}${e.ultimo_status ? (ok ? " · recibido" : ` · error ${e.ultimo_status}`) : ""}` : ""}</small></div>
      </div>
      <p className="guia-nota" style={{ marginTop: 0 }}>Cuando entra una solicitud, se responde una pregunta o se piden cambios, Claude se pone con ella al momento: la construye, la publica y la deja en revisión. Si toca borrar o cambiar datos existentes, o permisos y seguridad, se para y pide el OK de Adrián en la propia solicitud.</p>
      {e.ultimo_error && <p className="guia-nota" style={{ color: "#A3362B" }}>El último aviso falló: {e.ultimo_error}</p>}
      {e.puede && (
        <div className="sol-botones" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <input type="password" autoComplete="off" value={llave} onChange={(ev) => setLlave(ev.target.value)} placeholder={e.conectada ? "Pega una llave nueva para cambiarla" : "Pega aquí la llave de la tarea (sk-ant-oat01-…)"} aria-label="Llave de la tarea" style={{ flex: "1 1 280px", font: "inherit", fontSize: 13.5, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 10, background: "var(--bg)", color: "var(--text)" }} />
          <button className="btn-p" disabled={busy || !llave.trim()} onClick={() => guardar(llave)}>{busy ? "Guardando…" : "Conectar"}</button>
          {e.conectada && <button className="btn-txt" disabled={busy} onClick={() => guardar("")}>Desconectar</button>}
        </div>
      )}
    </section>
  );
}
