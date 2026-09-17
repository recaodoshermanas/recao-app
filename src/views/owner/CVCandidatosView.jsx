import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, SHADOW, avatar } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";

const CRIT = [["c_experiencia", "Experiencia", "Exp."], ["c_cercania", "Cercanía", "Cerca"], ["c_turnos", "Turnos", "Turnos"], ["c_incorporacion", "Incorporación", "Ya"]];
const TABS = [["revisar", "Por revisar"], ["interesa", "Interesan"], ["entrevista", "Entrevista"], ["descartada", "Descartadas"]];
const FILTROS = [["cual", "Cualificadas"], ["c_experiencia", "Experiencia"], ["c_cercania", "Cerca"], ["c_incorporacion", "Disponible ya"], ["sincv", "Sin CV legible"]];
const ESTADO_L = { revisar: "Por revisar", interesa: "Interesan", entrevista: "Entrevista", descartada: "Descartada" };
const puntos = (c) => CRIT.reduce((n, [k]) => n + (c[k] === "Sí" ? 1 : 0), 0);
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function fmtF(f) { if (!f) return ""; const d = new Date(f); return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function gmailUrl(id) { return `https://mail.google.com/mail/u/5/#all/${id}`; }

function Foto({ c, size }) {
  if (c.foto) return <img src={c.foto} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: size > 60 ? 12 : "999px", display: "block", flexShrink: 0 }} />;
  const a = avatar(c.nombre);
  return <span style={{ width: size, height: size, borderRadius: size > 60 ? 12 : "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.38), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

function Crit({ c }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
      {CRIT.map(([k, , sh]) => {
        const v = c[k];
        const bg = v === "Sí" ? "#E7F3EC" : v === "No" ? "#FBEAE7" : "#F0EADF";
        const fg = v === "Sí" ? "#1E7A46" : v === "No" ? "#B23A2C" : C.mut;
        return <span key={k} style={{ fontFamily: F, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: bg, color: fg }}>{sh}{v === "Sí" ? " ✓" : v === "No" ? " ✕" : " ?"}</span>;
      })}
    </div>
  );
}

export function CVCandidatosView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("revisar");
  const [vista, setVista] = useState("lista");
  const [q, setQ] = useState("");
  const [filtros, setFiltros] = useState({});
  const [abierto, setAbierto] = useState(null);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await sb.select("candidatos", "select=*&order=fecha_correo.desc")); } catch (e) { flash(e.message || "Error"); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleF = (k) => setFiltros(p => { const n = { ...p }; if (n[k]) delete n[k]; else n[k] = true; return n; });

  const mover = async (c, estado) => {
    setBusy(true);
    setRows(prev => prev.map(x => x.id === c.id ? { ...x, estado } : x));
    setAbierto(a => a && a.id === c.id ? { ...a, estado } : a);
    try { await sb.update("candidatos", `id=eq.${c.id}`, { estado, actualizado_en: new Date().toISOString() }); flash(ESTADO_L[estado]); } catch (e) { flash(e.message || "Error"); load(); }
    setBusy(false);
  };
  const guardarNota = async (c) => {
    setBusy(true);
    setRows(prev => prev.map(x => x.id === c.id ? { ...x, nota } : x));
    try { await sb.update("candidatos", `id=eq.${c.id}`, { nota, actualizado_en: new Date().toISOString() }); flash("Nota guardada"); } catch (e) { flash(e.message || "Error"); }
    setBusy(false);
  };
  const abrir = (c) => { setAbierto(c); setNota(c.nota || ""); };

  const conteo = useMemo(() => { const m = {}; TABS.forEach(([k]) => m[k] = rows.filter(r => r.estado === k).length); return m; }, [rows]);
  const cualificadas = useMemo(() => rows.filter(r => r.estado !== "descartada" && puntos(r) >= 2).length, [rows]);

  const lista = useMemo(() => {
    const nq = norm(q);
    return rows.filter(c => {
      if (c.estado !== tab) return false;
      if (filtros.cual && puntos(c) < 2) return false;
      if (filtros.c_experiencia && c.c_experiencia !== "Sí") return false;
      if (filtros.c_cercania && c.c_cercania !== "Sí") return false;
      if (filtros.c_incorporacion && c.c_incorporacion !== "Sí") return false;
      if (filtros.sincv && c.cv_texto) return false;
      if (nq && !(norm(c.nombre).includes(nq) || norm(c.poblacion).includes(nq) || norm(c.resumen).includes(nq))) return false;
      return true;
    });
  }, [rows, tab, filtros, q]);

  const acciones = (c, full) => {
    const b = (bg, fg, est, txt) => <button key={est} onClick={() => mover(c, est)} disabled={busy} style={{ flex: full ? 1 : "none", background: bg, color: fg, border: "none", borderRadius: 10, padding: full ? "11px 10px" : "8px 12px", fontFamily: F, fontSize: full ? 13.5 : 12.5, fontWeight: 700, cursor: "pointer" }}>{txt}</button>;
    if (c.estado === "descartada") return <div style={{ display: "flex", gap: 8 }}>{b("#fff", C.mut, "revisar", "Devolver a revisar")}</div>;
    return <div style={{ display: "flex", gap: 8 }}>
      {c.estado !== "interesa" && b("#E7F3EC", "#1E7A46", "interesa", "Interesa")}
      {c.estado !== "entrevista" && b("#FBF0DA", "#8a6a1e", "entrevista", "Entrevista")}
      {b("#FBEAE7", "#B23A2C", "descartada", "Descartar")}
    </div>;
  };

  return (
    <div style={{ padding: "14px 14px 24px", maxWidth: 680, margin: "0 auto" }}>
      {msg && <div style={{ position: "sticky", top: 96, zIndex: 12, fontFamily: F, fontSize: 13, color: C.char, background: C.gold, padding: "8px 12px", borderRadius: 10, marginBottom: 12, textAlign: "center" }}>{msg}</div>}

      <div style={{ display: "flex", gap: 3, background: "#EFE9DD", borderRadius: 11, padding: 3, marginBottom: 12, overflowX: "auto" }}>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, whiteSpace: "nowrap", padding: "8px 8px", borderRadius: 8, border: "none", background: tab === k ? "#fff" : "transparent", color: tab === k ? C.char : C.mut, fontFamily: F, fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: tab === k ? SHADOW.card : "none" }}>{l} <span style={{ color: tab === k ? C.goldDark : C.mutL }}>{conteo[k] || 0}</span></button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre, población, experiencia…" style={{ flex: 1, boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 12px", fontFamily: F, fontSize: 13.5, color: C.char, outline: "none" }} />
        <div style={{ display: "flex", background: "#EFE9DD", borderRadius: 10, padding: 3 }}>
          {[["lista", "Lista"], ["fotos", "Fotos"]].map(([v, l]) => <button key={v} onClick={() => setVista(v)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: vista === v ? "#fff" : "transparent", color: vista === v ? C.char : C.mut, fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {FILTROS.map(([k, l]) => { const on = !!filtros[k]; return <button key={k} onClick={() => toggleF(k)} style={{ fontFamily: F, fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 999, cursor: "pointer", border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut }}>{l}{k === "cual" ? ` (${cualificadas})` : ""}</button>; })}
      </div>

      {loading ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 30 }}>Cargando…</div>
        : lista.length === 0 ? <div style={{ fontFamily: SF, fontSize: 15, color: C.mut, textAlign: "center", padding: 34 }}>{tab === "revisar" ? "No hay candidatas con estos filtros." : "Aún no hay nadie aquí. Muévelas desde «Por revisar»."}</div>
          : vista === "fotos" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
              {lista.map(c => (
                <button key={c.id} onClick={() => abrir(c)} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 8, cursor: "pointer", textAlign: "center", boxShadow: SHADOW.card }}>
                  <div style={{ display: "flex", justifyContent: "center" }}><Foto c={c} size={78} /></div>
                  <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 600, color: C.char, marginTop: 6, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nombre}</div>
                  <div style={{ fontFamily: F, fontSize: 10, color: puntos(c) >= 2 ? "#1E7A46" : C.mutL, marginTop: 2 }}>{puntos(c)}/4 criterios</div>
                </button>
              ))}
            </div>
          ) : (
            lista.map(c => (
              <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 14, marginBottom: 10, boxShadow: SHADOW.card }}>
                <div onClick={() => abrir(c)} style={{ display: "flex", gap: 12, cursor: "pointer" }}>
                  <Foto c={c} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{c.nombre}</span>
                      {puntos(c) >= 2 && <span style={{ fontFamily: F, fontSize: 10.5, fontWeight: 700, color: "#1E7A46", background: "#E7F3EC", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>Cualificada</span>}
                    </div>
                    <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 1 }}>{c.poblacion || "Población no indicada"}{c.fecha_correo ? ` · ${fmtF(c.fecha_correo)}` : ""}</div>
                    <Crit c={c} />
                  </div>
                </div>
                <div style={{ fontFamily: F, fontSize: 13, color: C.char, lineHeight: 1.45, marginTop: 10 }}>{c.resumen}</div>
                <div style={{ marginTop: 12 }}>{acciones(c, false)}</div>
              </div>
            ))
          )}

      {abierto && (
        <div onClick={() => setAbierto(null)} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 26px" }}>
            <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Foto c={abierto} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 20, color: C.char }}>{abierto.nombre}</div>
                <div style={{ fontFamily: F, fontSize: 12.5, color: C.mut, marginTop: 2 }}>{abierto.poblacion || "Población no indicada"}</div>
                <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, marginTop: 1 }}>Estado: {ESTADO_L[abierto.estado] || abierto.estado}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "11px 13px" }}>
              {abierto.telefono && <a href={`tel:${abierto.telefono.replace(/\s/g, "")}`} style={{ fontFamily: F, fontSize: 13.5, color: C.blu, textDecoration: "none" }}>📞 {abierto.telefono}</a>}
              {abierto.email && <a href={`mailto:${abierto.email}`} style={{ fontFamily: F, fontSize: 13.5, color: C.blu, textDecoration: "none", wordBreak: "break-all" }}>✉️ {abierto.email}</a>}
            </div>

            <Crit c={abierto} />

            <div style={{ fontFamily: F, fontSize: 13.5, color: C.char, lineHeight: 1.5, marginTop: 12, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12, padding: "12px 14px" }}>{abierto.resumen}</div>

            <a href={gmailUrl(abierto.gmail_id)} target="_blank" rel="noopener" style={{ display: "block", textAlign: "center", marginTop: 12, background: C.char, color: C.gold, borderRadius: 12, padding: 13, fontFamily: F, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>Ver CV en Gmail ↗</a>
            {abierto.cv_archivo && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mutL, textAlign: "center", marginTop: 6 }}>{abierto.cv_archivo}</div>}

            <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, margin: "16px 0 7px" }}>Notas de dirección</div>
            <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Anota lo que quieras sobre esta candidata…" rows={2} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 12, padding: "10px 12px", fontFamily: F, fontSize: 14, color: C.char, outline: "none", resize: "vertical" }} />
            {nota !== (abierto.nota || "") && <button onClick={() => guardarNota(abierto)} disabled={busy} style={{ marginTop: 8, background: "#fff", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "8px 14px", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>Guardar nota</button>}

            <div style={{ marginTop: 18 }}>{acciones(abierto, true)}</div>
            <button onClick={() => setAbierto(null)} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: C.mut, fontFamily: F, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
