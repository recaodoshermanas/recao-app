import { useState, useEffect, useCallback } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
function fmtDia(f) { if (!f) return ""; const p = f.split("-"); const d = new Date(f + "T00:00:00"); return `${DOW[d.getDay()]} ${p[2]}/${p[1]}`; }
function fmtF(f) { if (!f) return ""; const p = f.split("-"); return `${p[2]}/${p[1]}/${p[0]}`; }
const NIVEL_L = { leve: "Leve", grave: "Grave", muy_grave: "Muy grave" };
function docSancion(s) {
  return `AMONESTACIÓN ESCRITA — Recao
Falta ${NIVEL_L[s.nivel] || s.nivel}
Fecha del hecho: ${fmtF(s.fecha)}
Artículo del convenio aplicado: ${s.articulo || "—"}
Hechos: ${s.hechos || "—"}
Convenio de referencia: mayoristas y minoristas de alimentación de Sevilla.
Acusar recibo no implica aceptar el contenido.`;
}
function comprimir(file, maxSide = 1200, q = 0.55) {
  return new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(u); let w = img.width, h = img.height; if (w >= h && w > maxSide) { h = Math.round(h * maxSide / w); w = maxSide; } else if (h > maxSide) { w = Math.round(w * maxSide / h); h = maxSide; } const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); res(c.toDataURL("image/jpeg", q)); };
    img.onerror = rej; img.src = u;
  });
}
function Countdown({ hasta }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const ms = new Date(hasta).getTime() - now;
  if (ms <= 0) return <span style={{ color: C.red, fontWeight: 700 }}>Plazo vencido</span>;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return <span style={{ color: h < 12 ? C.red : C.char, fontWeight: 700 }}>{h}h {m}m para alegar</span>;
}
const RES = { descartado: { label: "Descartado", bg: "#E7F3EC", fg: "#1E7A46" }, sin_fallo: { label: "Sin fallo", bg: "#EAF0F8", fg: "#3D6AA5" }, confirmado: { label: "Confirmado", bg: "#FBEAE7", fg: "#B23A2C" } };

export function MisAvisosView({ user }) {
  const [avisos, setAvisos] = useState([]);
  const [sanciones, setSanciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(null);
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState([]);
  const [pruebas, setPruebas] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await sb.fn("disciplina", { action: "mis_avisos" }); setAvisos(r.avisos || []); } catch (e) { /* noop */ }
    try { const s = await sb.fn("disciplina", { action: "mis_sanciones" }); setSanciones(s.sanciones || []); } catch (e) { /* noop */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const abrir = async (a) => {
    if (abierto === a.id) { setAbierto(null); return; }
    setAbierto(a.id); setTexto(""); setFotos([]);
    if (!a.leido_en) { try { await sb.fn("disciplina", { action: "acuse", aviso_id: a.id }); setAvisos(prev => prev.map(x => x.id === a.id ? { ...x, leido_en: new Date().toISOString() } : x)); } catch (e) { /* noop */ } }
  };
  const verPrueba = async (a) => { setPruebas(p => ({ ...p, [a.id]: "loading" })); try { const r = await sb.fn("disciplina", { action: "prueba", aviso_id: a.id }); setPruebas(p => ({ ...p, [a.id]: r.foto || null })); } catch (e) { setPruebas(p => ({ ...p, [a.id]: null })); } };
  const onFoto = async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { const d = await comprimir(f); setFotos(prev => [...prev, d]); } catch { /* noop */ } };
  const alegar = async (a) => { if (!texto.trim() && !fotos.length) { flash("Escribe tu alegación"); return; } setBusy(true); try { await sb.fn("disciplina", { action: "alegar", aviso_id: a.id, texto: texto.trim() || null, archivos: fotos }); flash("Alegación presentada"); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };
  const acusar = async (s, tipo) => { setBusy(true); try { await sb.fn("disciplina", { action: "acuse_sancion", falta_id: s.id, tipo, documento: docSancion(s), dispositivo: (navigator.userAgent || "").slice(0, 200) }); flash(tipo === "no_conforme" ? "Recibí firmado (no conforme)" : "Recibí firmado"); await load(); } catch (e) { flash(e.message || "Error"); } setBusy(false); };

  const sancPend = sanciones.filter(s => !s.acuse_en);

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      {msg && <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : <>
          {sancPend.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.red, marginBottom: 9 }}>Sanciones por firmar el recibí</div>
              {sancPend.map(s => (
                <div key={s.id} style={{ background: "#fff", border: `1.5px solid ${C.red}`, borderRadius: 16, padding: 15, marginBottom: 11 }}>
                  <div style={{ fontFamily: SF, fontSize: 17, color: C.char }}>Amonestación · Falta {NIVEL_L[s.nivel] || s.nivel}</div>
                  <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 3 }}>Del {fmtF(s.fecha)}{s.articulo ? ` · art. ${s.articulo}` : ""}</div>
                  <div style={{ fontFamily: F, fontSize: 13, color: C.char, background: "#FAF7F2", borderRadius: 10, padding: "10px 12px", marginTop: 10, lineHeight: 1.45 }}>{s.hechos || "(sin descripción)"}</div>
                  <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 10, lineHeight: 1.4 }}>Al pulsar dejas constancia de que has recibido este documento. <b>Acusar recibo no implica aceptar su contenido.</b></div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => acusar(s, "recibido")} disabled={busy} style={{ flex: 1, background: C.char, color: C.gold, border: "none", borderRadius: 10, padding: 12, fontFamily: F, fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Recibido</button>
                    <button onClick={() => acusar(s, "no_conforme")} disabled={busy} style={{ flex: 1, background: "#fff", color: C.red, border: `1.5px solid #EDC9C3`, borderRadius: 10, padding: 12, fontFamily: F, fontSize: 13.5, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>Recibido, no conforme</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {avisos.length === 0 ? (sancPend.length === 0 && <div style={{ fontFamily: SF, fontSize: 16, color: "#1E7A46", textAlign: "center", padding: 30 }}>No tienes ningún aviso ✓</div>)
            : avisos.map(a => {
              const open = abierto === a.id;
              const emitido = a.estado === "emitido";
              const alegado = !!a.alegacion_en;
              const pr = pruebas[a.id];
              const res = RES[a.resultado];
              return (
                <div key={a.id} style={{ background: "#fff", border: `1.5px solid ${emitido ? C.gold : C.brdL}`, borderRadius: 16, padding: 15, marginBottom: 11 }}>
                  <div onClick={() => abrir(a)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: SF, fontSize: 16, color: C.char }}>Aviso · {fmtDia(a.fecha)}</div>
                      <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 1, textTransform: "capitalize" }}>Turno {a.turno}</div>
                    </div>
                    {emitido
                      ? <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: "#FBF0DA", color: "#8a6a1e", whiteSpace: "nowrap" }}>{alegado ? "Alegado" : "Por responder"}</span>
                      : <span style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, background: res ? res.bg : "#eee", color: res ? res.fg : C.mut, whiteSpace: "nowrap" }}>{res ? res.label : "Resuelto"}</span>}
                  </div>

                  {open && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.brdL}` }}>
                      <div style={{ fontFamily: F, fontSize: 12, color: "#7A5C1A", background: "#FBF4E6", border: "1px solid #EAD9AE", borderRadius: 10, padding: "9px 12px", marginBottom: 12, lineHeight: 1.4 }}>Esto <b>no es una sanción</b>. Es un paso previo: puedes dar tu versión antes de que dirección decida.</div>
                      <div style={{ fontFamily: F, fontSize: 14, color: C.char, lineHeight: 1.4 }}>{a.descripcion}</div>
                      {a.tarea_texto && <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginTop: 6 }}>Tarea: {a.tarea_texto}</div>}
                      {a.incidencia_id && (
                        <div style={{ marginTop: 10 }}>
                          {pr === undefined && <button onClick={() => verPrueba(a)} style={{ background: C.char, color: C.gold, border: "none", borderRadius: 9, padding: "7px 14px", fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Ver prueba</button>}
                          {pr === "loading" && <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}>Cargando…</span>}
                          {pr === null && <span style={{ fontFamily: F, fontSize: 12, color: C.mutL }}>Sin prueba</span>}
                          {pr && pr !== "loading" && <img src={pr} alt="" style={{ width: "100%", borderRadius: 12, marginTop: 4, display: "block" }} />}
                        </div>
                      )}
                      {emitido ? (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontFamily: F, fontSize: 12.5, marginBottom: 10 }}><Countdown hasta={a.plazo_alegacion} /></div>
                          {alegado ? (
                            <div style={{ background: "#F7F4EE", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px" }}>
                              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, marginBottom: 5 }}>Tu alegación</div>
                              <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, lineHeight: 1.4 }}>{a.alegacion || "(sin texto)"}</div>
                            </div>
                          ) : (
                            <div>
                              <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Tu versión de lo ocurrido…" rows={3} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", resize: "vertical", marginBottom: 8 }} />
                              {fotos.length > 0 && <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>{fotos.map((f, i) => <img key={i} src={f} alt="" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8 }} />)}</div>}
                              <div style={{ display: "flex", gap: 8 }}>
                                <label style={{ flex: "0 0 auto", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "10px 14px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.mut, cursor: "pointer" }}>+ Foto<input type="file" accept="image/*" onChange={onFoto} style={{ display: "none" }} /></label>
                                <button onClick={() => alegar(a)} disabled={busy} style={{ flex: 1, background: C.char, color: C.gold, border: "none", borderRadius: 10, padding: 12, fontFamily: F, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>{busy ? "Enviando…" : "Presentar alegación"}</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ marginTop: 14, background: "#F7F4EE", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px" }}>
                          <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, marginBottom: 5 }}>Resolución de dirección</div>
                          <div style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>{res ? res.label : a.resultado}{a.nivel ? ` · falta ${NIVEL_L[a.nivel] || a.nivel}` : ""}{a.articulo ? ` (art. ${a.articulo})` : ""}</div>
                          {a.resolucion_nota && <div style={{ fontFamily: F, fontSize: 13, color: C.mut, marginTop: 5, lineHeight: 1.4 }}>{a.resolucion_nota}</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </>}
    </div>
  );
}
