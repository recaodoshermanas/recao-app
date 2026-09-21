import { useState, useMemo } from "react";
import { F, SF, C, SHADOW, avatar } from "../../lib/styles.js";
import { PUESTOS, COMPETENCIAS, calcularEvaluacion } from "../../lib/evaluacionCandidatas.js";

function Foto({ c, size }) {
  if (c && c.foto) return <img src={c.foto} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: "999px", display: "block", flexShrink: 0 }} />;
  const a = avatar(c ? c.nombre : "?");
  return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.4), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

export function RankingView({ candidatos, evaluaciones, onOpen }) {
  const [puesto, setPuesto] = useState("apoyo");
  const byId = useMemo(() => { const m = {}; candidatos.forEach((c) => { m[c.id] = c; }); return m; }, [candidatos]);

  const { rank, incompletas, descartadas } = useMemo(() => {
    const rank = [], incompletas = [], descartadas = [];
    (evaluaciones || []).forEach((ev) => {
      const cand = byId[ev.candidato_id];
      if (!cand) return;
      if ((ev.puesto || "apoyo") !== puesto) return;
      const calc = calcularEvaluacion(ev.puesto, ev.parte_a || {}, ev.parte_b || {});
      const item = { cand, ev, calc };
      if (calc.descartada) descartadas.push(item);
      else if (calc.completa) rank.push(item);
      else incompletas.push(item);
    });
    rank.sort((a, b) => (b.calc.notaFinal - a.calc.notaFinal) || (b.calc.sumaW - a.calc.sumaW) || (b.calc.exp - a.calc.exp) || a.cand.nombre.localeCompare(b.cand.nombre));
    return { rank, incompletas, descartadas };
  }, [evaluaciones, byId, puesto]);

  const mini = (calc) => {
    const p = calc.compMedias.proactividad, t = calc.compMedias.trato;
    const r1 = (x) => (x == null ? "—" : Math.round(x * 10) / 10);
    return `A ${calc.totalA}/6 · B ${calc.totalB}/${calc.maxB} · Proact. ${r1(p)} · Trato ${r1(t)}`;
  };

  return (
    <div style={{ padding: "4px 2px 24px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {PUESTOS.map((p) => { const on = puesto === p.id; return (
          <button key={p.id} onClick={() => setPuesto(p.id)} style={{ flex: 1, padding: "9px 8px", borderRadius: 11, border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{p.label}</button>
        ); })}
      </div>

      {rank.length === 0 && incompletas.length === 0 && descartadas.length === 0 ? (
        <div style={{ fontFamily: SF, fontSize: 15, color: C.mut, textAlign: "center", padding: 34 }}>Aún no hay evaluaciones para {puesto === "apoyo" ? "Apoyo" : "Principal"}. Evalúa a las candidatas en «Entrevista».</div>
      ) : (
        <>
          {rank.map((it, i) => { const et = it.calc.etiqueta; return (
            <button key={it.ev.candidato_id} onClick={() => onOpen(it.cand)} style={{ width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 16, padding: 13, marginBottom: 9, boxShadow: SHADOW.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: SF, fontSize: 20, color: C.mutL, width: 24, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
              <Foto c={it.cand} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: SF, fontSize: 16, color: C.char, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.cand.nombre}</span>
                  {it.calc.aviso40h && <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: "#8a6a1e", background: "#FBF0DA", borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>quiere 40 h</span>}
                </div>
                <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mini(it.calc)}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: SF, fontSize: 22, color: C.char }}>{it.calc.notaFinal}</div>
                {et && <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: et.fg, background: et.bg, borderRadius: 999, padding: "2px 8px", marginTop: 2 }}>{et.label}</div>}
              </div>
            </button>
          ); })}

          {incompletas.length > 0 && (
            <>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, margin: "18px 4px 9px" }}>Incompletas ({incompletas.length})</div>
              {incompletas.map((it) => (
                <button key={it.ev.candidato_id} onClick={() => onOpen(it.cand)} style={{ width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 11 }}>
                  <Foto c={it.cand} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 15, color: C.char }}>{it.cand.nombre}</div>
                    <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 1 }}>Falta: {it.calc.falta.join(" · ")}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {descartadas.length > 0 && (
            <>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, margin: "18px 4px 9px" }}>Descartadas ({descartadas.length})</div>
              {descartadas.map((it) => (
                <button key={it.ev.candidato_id} onClick={() => onOpen(it.cand)} style={{ width: "100%", textAlign: "left", background: "#FBF7F5", border: `1px solid #EDD9D3`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 11, opacity: 0.9 }}>
                  <Foto c={it.cand} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SF, fontSize: 15, color: C.char }}>{it.cand.nombre}</div>
                    <div style={{ fontFamily: F, fontSize: 11.5, color: "#B23A2C", marginTop: 1 }}>{it.calc.motivoDescarte}</div>
                  </div>
                </button>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
