import { useState, useMemo } from "react";
import { F, SF, C } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import {
  PUESTOS, ELIMINATORIOS, INFORMATIVOS, EXP_OPCIONES, TRANSPORTE_OPCIONES,
  ESCALA_B, PARADAS, PRUEBA, COMPETENCIAS, UMBRALES, RESULTADO_L,
  calcularEvaluacion, comps,
} from "../../lib/evaluacionCandidatas.js";

const ETQ = Object.fromEntries(UMBRALES.map((u) => [u.id, u]));
const nowISO = () => new Date().toISOString();
const fmtEn = (s) => { if (!s) return ""; try { return new Date(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

// Selector de botones (1-4, o valores con .5, o Sí/No, o opciones libres)
function Selector({ value, opciones, onPick, cols }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols || opciones.length}, 1fr)`, gap: 6 }}>
      {opciones.map((o) => {
        const on = value === o.v;
        return (
          <button key={String(o.v)} type="button" onClick={() => onPick(on ? null : o.v)}
            style={{ padding: "11px 6px", borderRadius: 11, border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut, fontFamily: F, fontSize: o.small ? 12.5 : 15, fontWeight: 700, cursor: "pointer", lineHeight: 1.15 }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const OP_14 = [1, 2, 3, 4].map((v) => ({ v, label: String(v) }));
const OP_W = [1, 1.5, 2, 2.5, 3, 3.5, 4].map((v) => ({ v, label: String(v), small: true }));
const OP_SINO = [{ v: "si", label: "Sí" }, { v: "no", label: "No" }];

function Label({ children, sub }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char, lineHeight: 1.4 }}>{children}</div>
      {sub && <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}
function Anclas({ a1, a4 }) {
  return (
    <div style={{ display: "flex", gap: 8, margin: "7px 0 8px" }}>
      <div style={{ flex: 1, fontFamily: F, fontSize: 11, color: "#B23A2C", background: "#FBEAE7", borderRadius: 8, padding: "6px 8px", lineHeight: 1.3 }}><b>1 ·</b> {a1}</div>
      <div style={{ flex: 1, fontFamily: F, fontSize: 11, color: "#1E7A46", background: "#E7F3EC", borderRadius: 8, padding: "6px 8px", lineHeight: 1.3 }}><b>4 ·</b> {a4}</div>
    </div>
  );
}
const box = { background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: "13px 14px", marginBottom: 11 };
const secTit = { fontFamily: SF, fontSize: 17, color: C.char, margin: "18px 2px 10px" };
const ta = { width: "100%", boxSizing: "border-box", border: `1.5px solid ${C.brd}`, borderRadius: 10, padding: "9px 11px", fontFamily: F, fontSize: 13.5, color: C.char, outline: "none", resize: "vertical" };

export function EvaluacionSheet({ candidato, evaluacion, currentUser, onClose, onSaved }) {
  const ev0 = evaluacion || {};
  const [puesto, setPuesto] = useState(ev0.puesto || null);
  const [A, setA] = useState(ev0.parte_a || {});
  const [B, setB] = useState(ev0.parte_b || {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2600); };

  const setAk = (k, v) => setA((p) => ({ ...p, [k]: v }));
  const setBk = (k, v) => setB((p) => ({ ...p, [k]: v }));
  const setNota = (parada, v) => setB((p) => ({ ...p, notas: { ...(p.notas || {}), [parada]: v } }));

  const calc = useMemo(() => calcularEvaluacion(puesto || "apoyo", A, B), [puesto, A, B]);
  const cs = comps(puesto || "apoyo");

  const guardar = async () => {
    if (!puesto) { flash("Elige el puesto primero"); return; }
    setBusy(true);
    const aTocada = Object.keys(A).length > 0;
    const bTocada = Object.keys(B).some((k) => k !== "notas" ? B[k] != null : Object.keys(B.notas || {}).length);
    const row = {
      candidato_id: candidato.id,
      puesto,
      parte_a: A,
      parte_b: B,
      total_a: calc.totalA,
      total_b: calc.totalB,
      nota_final: calc.notaFinal,
      etiqueta: calc.etiqueta ? calc.etiqueta.id : null,
      resultado: calc.resultado,
      motivo_descarte: calc.motivoDescarte,
      a_completa: calc.aCompleta,
      b_completa: calc.bCompleta,
      actualizado_en: nowISO(),
    };
    const quien = (currentUser && currentUser.nombre) || "dirección";
    if (aTocada) { row.parte_a_por = ev0.parte_a_por || quien; row.parte_a_en = nowISO(); }
    if (bTocada) { row.parte_b_por = ev0.parte_b_por || quien; row.parte_b_en = nowISO(); }
    try {
      await sb.upsert("evaluaciones_candidato", row, "candidato_id");
      flash("Guardado");
      if (onSaved) await onSaved();
      setTimeout(onClose, 500);
    } catch (e) { flash(e.message || "Error al guardar"); }
    setBusy(false);
  };

  const et = calc.etiqueta;
  const resColor = calc.descartada ? "#B23A2C" : calc.completa ? "#1E7A46" : C.mut;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 620, maxHeight: "94vh", display: "flex", flexDirection: "column", borderRadius: "20px 20px 0 0" }}>
        {/* Cabecera fija */}
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.brdL}` }}>
          <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 14px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SF, fontSize: 19, color: C.char }}>{candidato.nombre}</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.mut }}>Evaluación · {candidato.poblacion || "—"}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontFamily: F, fontSize: 22, color: C.mut, cursor: "pointer", lineHeight: 1, padding: 2 }}>×</button>
          </div>
          {/* Puesto */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {PUESTOS.map((p) => { const on = puesto === p.id; return (
              <button key={p.id} onClick={() => setPuesto(p.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 11, border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{p.label}</button>
            ); })}
          </div>
        </div>

        {/* Cuerpo con scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
          {!puesto ? (
            <div style={{ fontFamily: SF, fontSize: 15, color: C.mut, textAlign: "center", padding: "34px 10px" }}>Elige el puesto (apoyo o principal) para empezar la evaluación.</div>
          ) : (
            <>
              {/* ---------- PARTE A ---------- */}
              <div style={secTit}>Parte A · CV + llamada</div>

              <div style={box}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, marginBottom: 10 }}>Eliminatorios</div>
                {ELIMINATORIOS.map((e) => (
                  <div key={e.id} style={{ marginBottom: 12 }}>
                    <Label sub={e.ayuda}>{e.texto}</Label>
                    <Selector value={A[e.id]} opciones={OP_SINO} onPick={(v) => setAk(e.id, v)} />
                    {A[e.id] === e.descartaSi && <div style={{ fontFamily: F, fontSize: 11.5, color: "#B23A2C", marginTop: 6 }}>⚠ Descarta: {e.motivo}</div>}
                  </div>
                ))}
              </div>

              <div style={box}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, marginBottom: 10 }}>Datos (no puntúan)</div>
                <Label>{INFORMATIVOS.L3.texto}</Label>
                <input type="date" value={A.L3 || ""} onChange={(e) => setAk("L3", e.target.value)} style={{ ...ta, marginBottom: 12 }} />
                {puesto === "apoyo" && (
                  <div style={{ marginBottom: 12 }}>
                    <Label>{INFORMATIVOS.L5.texto}</Label>
                    <Selector value={A.L5} opciones={OP_SINO} onPick={(v) => setAk("L5", v)} />
                    {A.L5 === "si" && <div style={{ fontFamily: F, fontSize: 11.5, color: "#8a6a1e", marginTop: 6 }}>Aviso: quiere 40 h (no descarta)</div>}
                  </div>
                )}
                <Label>{INFORMATIVOS.L6.texto}</Label>
                <Selector value={A.L6} opciones={OP_SINO} onPick={(v) => setAk("L6", v)} />
                <textarea value={A.L6_nota || ""} onChange={(e) => setAk("L6_nota", e.target.value)} placeholder="¿Qué preguntó? (opcional)" rows={2} style={{ ...ta, marginTop: 8 }} />
                <Label>Cómo habla por teléfono (nota libre)</Label>
                <textarea value={A.nota_llamada || ""} onChange={(e) => setAk("nota_llamada", e.target.value)} placeholder="Hechos concretos…" rows={2} style={ta} />
              </div>

              <div style={box}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, marginBottom: 10 }}>Puntúa (Total A · máx. 6)</div>
                <Label>Experiencia de cara al público <span style={{ color: C.mutL }}>(× 2)</span></Label>
                <Selector cols={1} value={A.exp} opciones={EXP_OPCIONES.map((o) => ({ v: o.v, label: `${o.v} · ${o.label}`, small: true }))} onPick={(v) => setAk("exp", v)} />
                <div style={{ height: 12 }} />
                <Label>Transporte <span style={{ color: C.mutL }}>(× 1)</span></Label>
                <Selector cols={1} value={A.transporte} opciones={TRANSPORTE_OPCIONES.map((o) => ({ v: o.v, label: `${o.v} · ${o.label}`, small: true }))} onPick={(v) => setAk("transporte", v)} />
              </div>

              {/* ---------- PARTE B ---------- */}
              <div style={secTit}>Parte B · Entrevista + prueba</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.mut, background: "#F5F0E6", borderRadius: 10, padding: "9px 12px", marginBottom: 11, lineHeight: 1.45 }}>{ESCALA_B}</div>

              {PARADAS.map((par) => {
                const items = par.items.filter((it) => !it.soloPrincipal || puesto === "principal");
                if (!items.length) return null;
                return (
                  <div key={par.id} style={box}>
                    <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, marginBottom: 12 }}>{par.label}</div>
                    {items.map((it) => (
                      <div key={it.id} style={{ marginBottom: 16 }}>
                        <Label>{it.texto}</Label>
                        <Anclas a1={it.a1} a4={it.a4} />
                        <Selector value={B[it.id]} opciones={OP_14} onPick={(v) => setBk(it.id, v)} />
                      </div>
                    ))}
                    <textarea value={(B.notas && B.notas[par.id]) || ""} onChange={(e) => setNota(par.id, e.target.value)} placeholder="Notas de la parada (hechos concretos)…" rows={2} style={ta} />
                  </div>
                );
              })}

              <div style={box}>
                <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: C.mutL, marginBottom: 4 }}>{PRUEBA.label}</div>
                <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginBottom: 12, lineHeight: 1.4 }}>{PRUEBA.ayuda}</div>
                {PRUEBA.items.map((it) => (
                  <div key={it.id} style={{ marginBottom: 16 }}>
                    <Label>{it.texto}</Label>
                    <Anclas a1={it.a1} a4={it.a4} />
                    <Selector value={B[it.id]} opciones={OP_W} onPick={(v) => setBk(it.id, v)} />
                  </div>
                ))}
              </div>

              {/* autoría */}
              {(ev0.parte_a_por || ev0.parte_b_por) && (
                <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textAlign: "center", margin: "4px 0 10px", lineHeight: 1.5 }}>
                  {ev0.parte_a_por && <div>Parte A · {ev0.parte_a_por} · {fmtEn(ev0.parte_a_en)}</div>}
                  {ev0.parte_b_por && <div>Parte B · {ev0.parte_b_por} · {fmtEn(ev0.parte_b_en)}</div>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pie fijo: resumen en vivo + guardar */}
        {puesto && (
          <div style={{ borderTop: `1px solid ${C.brdL}`, background: "#fff", padding: "12px 16px 16px" }}>
            {msg && <div style={{ fontFamily: F, fontSize: 12.5, color: C.char, background: C.gold, padding: "6px 10px", borderRadius: 9, marginBottom: 10, textAlign: "center" }}>{msg}</div>}
            {calc.descartada ? (
              <div style={{ fontFamily: F, fontSize: 13, color: "#B23A2C", background: "#FBEAE7", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}>Descartada · {calc.motivoDescarte}</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: SF, fontSize: 30, color: calc.notaFinal == null ? C.mutL : C.char }}>{calc.notaFinal == null ? "—" : calc.notaFinal}</span>
                  <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}>/ 100</span>
                </div>
                {et && <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: et.fg, background: et.bg, borderRadius: 999, padding: "4px 12px" }}>{et.label}</span>}
                <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginLeft: "auto" }}>A {calc.totalA}/6 · B {calc.totalB}/{calc.maxB}</div>
              </div>
            )}
            {calc.aviso40h && <div style={{ fontFamily: F, fontSize: 11.5, color: "#8a6a1e", marginBottom: 8 }}>Quiere 40 h</div>}
            {!calc.completa && !calc.descartada && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginBottom: 10 }}>Falta: {calc.falta.join(" · ")}</div>}
            {/* desglose competencias */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {cs.map((c) => { const m = calc.compMedias[c.id]; return (
                <span key={c.id} style={{ fontFamily: F, fontSize: 11, color: C.mut, background: "#F1EDE3", borderRadius: 999, padding: "3px 9px" }}>{c.label} {m == null ? "—" : Math.round(m * 10) / 10}<span style={{ color: C.mutL }}> ×{c.peso}</span></span>
              ); })}
            </div>
            <button onClick={guardar} disabled={busy} style={{ width: "100%", background: C.char, color: C.gold, border: "none", borderRadius: 12, padding: 14, fontFamily: F, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar evaluación"}</button>
            <div style={{ fontFamily: F, fontSize: 11, color: C.mutL, textAlign: "center", marginTop: 7 }}>{RESULTADO_L[calc.resultado]} · puedes guardar a medias</div>
          </div>
        )}
      </div>
    </div>
  );
}
