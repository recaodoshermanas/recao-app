// Personas · Solicitudes · Ventanas · Sorteo de verano (#184)
// Dirección anuncia de qué número público saldrá el sorteo, lo resuelve con ese número (se puede repetir hasta publicar),
// publica el cuadro (pone las vacaciones aprobadas en el calendario) y registra los intercambios acordados.
import { useEffect, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { avisar, fechaCorta, Cargando } from "../ui.jsx";

const errMsg = (e) => { const t = String(e?.message || e || ""); const i = t.indexOf("{"); if (i >= 0) { try { return JSON.parse(t.slice(i)).message || t; } catch (x) { /* noop */ } } return t || "No se ha podido"; };
export const VIA = {
  principal: "Su principal, sin empate", principal_sorteo: "Su principal, ganó el sorteo", principal_prioridad: "Su principal, por prioridad del año anterior",
  secundario: "Su secundario", secundario_sorteo: "Su secundario, ganó el sorteo", secundario_prioridad: "Su secundario, por prioridad",
  libre: "Bloque libre (sin principal ni secundario)", libre_sin_presentar: "Bloque libre (no presentó)", intercambio: "Intercambio acordado", sin_bloque: "Sin bloque",
};

export function SorteoVerano({ ventanaId, onCambio }) {
  const [d, setD] = useState(null);
  const [fuente, setFuente] = useState("");
  const [fecha, setFecha] = useState("");
  const [numero, setNumero] = useState("");
  const [busy, setBusy] = useState(false);
  const [inter, setInter] = useState({ a: "", b: "" });
  const cargar = useCallback(async () => {
    try {
      const r = await sb.rpc("vac_sorteo_panel", { p_ventana: ventanaId });
      setD(r); setFuente(r.sorteo?.fuente || ""); setFecha(r.sorteo?.fecha_sorteo || ""); setNumero(r.sorteo?.numero || "");
    } catch (e) { avisar(errMsg(e), "mal"); setD({ error: true }); }
  }, [ventanaId]);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return <Cargando />;
  if (d.error) return null;
  const s = d.sorteo || {};
  const publicado = !!s.publicado_en;
  const bloques = d.ventana.bloques || [];
  const porBloque = {};
  d.personas.forEach((p) => { if (p.principal) (porBloque[p.principal] ||= []).push(p.nombre); });
  const faltan = d.personas.filter((p) => !p.principal);
  const hacer = async (fn, ok) => { setBusy(true); try { await fn(); avisar(ok); await cargar(); onCambio && onCambio(); } catch (e) { avisar(errMsg(e), "mal"); } setBusy(false); };
  const anunciar = () => hacer(() => sb.rpc("vac_sorteo_anunciar", { p_ventana: ventanaId, p_fuente: fuente, p_fecha: fecha || null }), "Anuncio guardado: ya lo ven en la app");
  const resolver = () => hacer(() => sb.rpc("vac_sorteo_resolver", { p_ventana: ventanaId, p_numero: numero }), "Reparto calculado. Revísalo y publícalo");
  const publicar = () => { if (window.confirm("Se pondrán los bloques como vacaciones aprobadas en el calendario (14 días cada una) y se avisará a cada trabajadora. ¿Publicar el cuadro?")) hacer(() => sb.rpc("vac_sorteo_publicar", { p_ventana: ventanaId }), "Cuadro publicado y puesto en el calendario"); };
  const intercambiar = () => {
    if (!inter.a || !inter.b || inter.a === inter.b) { avisar("Elige dos personas distintas", "mal"); return; }
    hacer(async () => {
      const r = await sb.rpc("vac_sorteo_intercambiar", { p_ventana: ventanaId, p_a: inter.a, p_b: inter.b });
      if (r && r.dias_sin_turno_guardado > 0) avisar(`Hecho. Revisa a mano ${r.dias_sin_turno_guardado} días que no tenían turno guardado debajo`, "mal");
      setInter({ a: "", b: "" });
    }, publicado ? "Intercambio hecho y calendario actualizado" : "Intercambio anotado en el reparto");
  };

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
      <h3 style={{ margin: "0 0 6px" }}>Sorteo y reparto de los bloques</h3>
      <p className="sub" style={{ marginTop: 0 }}>
        Cómo se sortea (lo ven también las trabajadoras): para cada bloque empatado se calcula la huella SHA-256 del texto «número|año|bloque|nombre» (por ejemplo «48213|{d.ventana.anio}|3|Nombre Apellido») y gana la huella más baja. Quien no consiguió su bloque principal el año anterior gana el empate sin sortear; si son varias, se sortea solo entre ellas. Quien pierde va a su secundario; quien se queda sin los dos, y después quien no presentó, recibe el primer bloque libre por el orden de la huella «número|año|orden|nombre». Con el mismo número sale siempre lo mismo, y cualquiera puede comprobarlo con una calculadora SHA-256 de internet.
      </p>

      <p className="sub" style={{ margin: "8px 0" }}>
        {bloques.map((b) => <span key={b.n} style={{ display: "inline-block", marginRight: 12 }}>B{b.n}: {porBloque[b.n] ? <b style={{ color: porBloque[b.n].length > 1 ? "#8A5A0B" : undefined }}>{porBloque[b.n].join(", ")}{porBloque[b.n].length > 1 ? " (empate)" : ""}</b> : "nadie de principal"}</span>)}
        {faltan.length > 0 && <span style={{ display: "block", marginTop: 4 }}>Sin presentar: <b>{faltan.map((p) => p.nombre).join(", ")}</b></span>}
        {d.personas.some((p) => p.prioridad) && <span style={{ display: "block", marginTop: 4 }}>Con prioridad por el año anterior: <b>{d.personas.filter((p) => p.prioridad).map((p) => p.nombre).join(", ")}</b></span>}
      </p>

      {!publicado && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label className="campo" style={{ marginBottom: 0, minWidth: 240 }}>De dónde sale el número<input value={fuente} onChange={(e) => setFuente(e.target.value)} placeholder="Cupón de la ONCE del 1 de diciembre" /></label>
          <label className="campo" style={{ marginBottom: 0 }}>Fecha del sorteo<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
          <button className="btn-l" disabled={busy || fuente.trim().length < 3} onClick={anunciar}>Guardar el anuncio</button>
        </div>
      )}
      {!publicado && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="campo" style={{ marginBottom: 0 }}>Número premiado<input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="48213" /></label>
          <button className="btn-l" disabled={busy || !numero.trim() || !d.cerrada} onClick={resolver}>{s.resultado ? "Volver a calcular" : "Calcular el reparto"}</button>
          {!d.cerrada && <small>Se puede calcular cuando cierre la ventana ({fechaCorta(d.ventana.cierra)}).</small>}
        </div>
      )}

      {s.resultado && (
        <>
          <h4 style={{ margin: "14px 0 4px", fontSize: 14 }}>{publicado ? `Cuadro publicado el ${fechaCorta(s.publicado_en)}` : "Reparto calculado (sin publicar)"} · número {s.numero}{s.fuente ? ` (${s.fuente})` : ""}</h4>
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Bloque</th><th>Persona</th><th>Cómo</th><th>Pidió</th></tr></thead>
              <tbody>
                {s.resultado.map((x) => (
                  <tr key={x.usuario_id}>
                    <td><b>{x.bloque ? `B${x.bloque}` : "–"}</b>{x.ini && <span className="pf">{fechaCorta(x.ini)} – {fechaCorta(x.fin)}</span>}</td>
                    <td>{x.nombre}</td>
                    <td>{VIA[x.via] || x.via}</td>
                    <td>{x.principal ? `B${x.principal} / B${x.secundario}` : "No presentó"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(s.pasos || []).length > 0 && (
            <ul className="sub" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {s.pasos.map((p, i) => <li key={i}>{p.texto}</li>)}
            </ul>
          )}
          {!publicado && <div style={{ marginTop: 10 }}><button className="btn-p" disabled={busy} onClick={publicar}>Publicar el cuadro y ponerlo en el calendario</button></div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 14 }}>
            <span className="sub" style={{ width: "100%", margin: 0 }}>Intercambio acordado entre dos compañeras{publicado ? " (se cambia también en el calendario)" : ""}:</span>
            {["a", "b"].map((k) => (
              <select key={k} value={inter[k]} onChange={(e) => setInter({ ...inter, [k]: e.target.value })}>
                <option value="">Elige…</option>
                {s.resultado.filter((x) => x.bloque).map((x) => <option key={x.usuario_id} value={x.usuario_id}>{x.nombre} (B{x.bloque})</option>)}
              </select>
            ))}
            <button className="btn-l" disabled={busy} onClick={intercambiar}>Intercambiar</button>
          </div>
        </>
      )}
    </div>
  );
}
