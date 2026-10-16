import { useState, useEffect, useCallback } from "react";
import { F, SF, C, SHADOW, btnDark, btnGhost } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

// Mis documentos: nóminas, contratos y demás papeles que sube dirección (los hace la gestoría).
// Nómina: se abre y se confirma «La he recibido». Contrato/anexo/finiquito: se firma digitalmente.
const fn = (accion, datos = {}) => sb.fn("documentos", { accion, ...datos });
const TIPO = { nomina: "Nómina", contrato: "Contrato", anexo: "Anexo al contrato", finiquito: "Finiquito", certificado: "Certificado", otro: "Documento" };
const card = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, boxShadow: SHADOW.card };
const fecha = (ts) => new Date(ts).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const pendiente = (d) => (d.requiere === "recibi" && !d.recibido_en) || (d.requiere === "firma" && d.estado !== "firmado");

export function MisDocumentosView() {
  const [d, setD] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);
  const cargar = useCallback(async () => { try { setD(await fn("mis_documentos")); } catch (e) { setMsg(e.message || "No se han podido cargar tus documentos"); setD({ documentos: [], aceptado_electronico: null }); } }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const aceptar = async () => { setBusy("acepto"); try { await fn("aceptar_electronico"); await cargar(); } catch (e) { setMsg(e.message); } setBusy(null); };
  const abrir = async (x, cual) => {
    setMsg(""); const w = window.open("", "_blank");
    try { const r = await fn("abrir", { id: x.id, cual }); if (w) w.location.href = r.url; else window.location.href = r.url; await cargar(); }
    catch (e) { if (w) w.close(); setMsg(e.message || "No se ha podido abrir"); }
  };
  const recibido = async (x) => { setBusy(x.id); try { await fn("recibido", { id: x.id }); setMsg("Confirmado ✓"); await cargar(); } catch (e) { setMsg(e.message); } setBusy(null); };
  const firmar = async (x) => { setBusy(x.id); try { await fn("firmar", { id: x.id }); await cargar(); } catch (e) { setMsg(e.message); } setBusy(null); };

  const wrap = { padding: "16px 16px 28px", maxWidth: 540, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 };
  if (!d) return <div style={{ padding: 30, textAlign: "center", fontFamily: F, color: C.mut }}>Cargando…</div>;

  if (!d.aceptado_electronico) return (
    <div style={wrap}>
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontFamily: SF, fontSize: 20 }}>Tus documentos, en la app</div>
        <p style={{ margin: 0, fontFamily: F, fontSize: 14, lineHeight: 1.5 }}>Aquí recibirás tus nóminas, tu contrato y otros documentos de trabajo en PDF. Los podrás abrir y descargar siempre que quieras.</p>
        <p style={{ margin: 0, fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.5 }}>Si en algún momento prefieres una copia en papel, pídesela a dirección.</p>
        {msg && <div role="alert" style={{ fontFamily: F, fontSize: 13, color: "#A3362B" }}>{msg}</div>}
        <button type="button" disabled={busy === "acepto"} onClick={aceptar} style={{ ...btnDark, opacity: busy ? 0.6 : 1 }}>Acepto recibirlos en la app</button>
      </div>
    </div>
  );

  const docs = d.documentos;
  const pend = docs.filter(pendiente);
  const resto = docs.filter((x) => !pendiente(x));
  const Tarjeta = ({ x }) => {
    const p = pendiente(x);
    return (
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8, border: p ? "1.5px solid #E0B94A" : card.border }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, flex: 1 }}>{x.titulo}</span>
          <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}>{fecha(x.subido_en)}</span>
        </div>
        <div style={{ fontFamily: F, fontSize: 12.5, color: p ? "#8A5A0B" : "#1E6B3C", fontWeight: 600 }}>
          {x.requiere === "firma" ? (x.estado === "firmado" ? "Firmado" : "Pendiente de tu firma")
            : x.requiere === "recibi" ? (x.recibido_en ? `Recibido el ${fecha(x.recibido_en)}` : x.visto_en ? "Ábrelo y confirma que lo has recibido" : "Sin abrir")
            : x.firmado_en_papel ? "Firmado en papel" : TIPO[x.tipo]}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => abrir(x, "original")} style={{ ...btnGhost, padding: "9px 14px" }}>Abrir PDF</button>
          {x.ruta_firmado && <button type="button" onClick={() => abrir(x, "firmado")} style={{ ...btnGhost, padding: "9px 14px" }}>PDF firmado</button>}
          {x.requiere === "recibi" && !x.recibido_en && x.visto_en && <button type="button" disabled={busy === x.id} onClick={() => recibido(x)} style={{ ...btnDark, padding: "9px 14px", opacity: busy === x.id ? 0.6 : 1 }}>La he recibido</button>}
          {x.requiere === "firma" && x.estado !== "firmado" && <button type="button" disabled={busy === x.id} onClick={() => firmar(x)} style={{ ...btnDark, padding: "9px 14px", opacity: busy === x.id ? 0.6 : 1 }}>Firmar</button>}
        </div>
      </div>
    );
  };

  return (
    <div style={wrap}>
      {msg && <div role="status" style={{ fontFamily: F, fontSize: 13, borderRadius: 12, padding: "10px 12px", background: msg.includes("✓") ? "#EAF4EE" : "#FBEAE7", color: msg.includes("✓") ? "#1E6B3C" : "#A3362B" }}>{msg}</div>}
      {docs.length === 0 && <div style={{ ...card, fontFamily: F, fontSize: 14, color: C.mut, textAlign: "center" }}>Todavía no tienes documentos. Cuando dirección suba tu nómina o tu contrato te llegará un aviso.</div>}
      {pend.length > 0 && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: 0.4 }}>Pendientes</div>}
      {pend.map((x) => <Tarjeta key={x.id} x={x} />)}
      {resto.length > 0 && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 6 }}>Ya hechos</div>}
      {resto.map((x) => <Tarjeta key={x.id} x={x} />)}
    </div>
  );
}
