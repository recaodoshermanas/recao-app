import { useState, useMemo } from "react";
import { F, SF, C, SHADOW, avatar } from "../../lib/styles.js";
import { PUESTOS, resultadoGuardado } from "../../lib/evaluacionCandidatas.js";

const TagAnterior = () => <span style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: "#6b5a8a", background: "#EEE9F5", borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>plantilla anterior</span>;

function Foto({ c, size }) {
  if (c && c.foto) return <img src={c.foto} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: "999px", display: "block", flexShrink: 0 }} />;
  const a = avatar(c ? c.nombre : "?");
  return <span style={{ width: size, height: size, borderRadius: "999px", background: a.bg, color: a.fg, fontFamily: SF, fontSize: Math.round(size * 0.4), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.inicial}</span>;
}

export function RankingView({ candidatos, evaluaciones, onOpen }) {
  const [puesto, setPuesto] = useState("apoyo");
  const byId = useMemo(() => { const m = {}; candidatos.forEach((c) => { m[c.id] = c; }); return m; }, [candidatos]);

  const { rank, incompletas, descartadas, anteriores } = useMemo(() => {
    const rank = [], incompletas = [], descartadas = [], anteriores = [];
    (evaluaciones || []).forEach((ev) => {
      const cand = byId[ev.candidato_id];
      if (!cand) return;
      if ((ev.puesto || "apoyo") !== puesto) return;
      const calc = resultadoGuardado(ev);
      const item = { cand, ev, calc };
      if (calc.plantillaAnterior) anteriores.push(item);
      else if (calc.descartada) descartadas.push(item);
      else if (calc.completa) rank.push(item);
      else incompletas.push(item);
    });
    // Empate: mejor suma de ejercicios (C + K + B + X); si sigue, mejor experiencia.
    rank.sort((a, b) => (b.calc.notaFinal - a.calc.notaFinal) || (b.calc.sumaEjercicios - a.calc.sumaEjercicios) || (b.calc.exp - a.calc.exp) || a.cand.nombre.localeCompare(b.cand.nombre));
    anteriores.sort((a, b) => ((b.calc.notaFinal ?? -1) - (a.calc.notaFinal ?? -1)) || a.cand.nombre.localeCompare(b.cand.nombre));
    return { rank, incompletas, descartadas, anteriores };
  }, [evaluaciones, byId, puesto]);

  const mini = (calc) => {
    const m = calc.compMedias;
    const r1 = (x) => (x == null ? "—" : Math.round(x * 10) / 10);
    return `A ${calc.totalA}/6 · B ${calc.totalB}/${calc.maxB} · Proact. ${r1(m.proactividad)} · Trato ${r1(m.trato)} · Equipo ${r1(m.equipo)}`;
  };

  return (
    <div style={{ padding: "4px 2px 24px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {PUESTOS.map((p) => { const on = puesto === p.id; return (
          <button key={p.id} onClick={() => setPuesto(p.id)} style={{ flex: 1, padding: "9px 8px", borderRadius: 11, border: `1.5px solid ${on ? C.char : C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut, fontFamily: F, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{p.label}</button>
        ); })}
      </div>

      {rank.length === 0 && incompletas.length === 0 && descartadas.length === 0 && anteriores.length === 0 ? (
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
                {it.calc.perfil && <div style={{ fontFamily: F, fontSize: 12, color: C.char, fontStyle: "italic", marginTop: 2, lineHeight: 1.35 }}>{it.calc.perfil}</div>}
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
                    {it.calc.perfil && <div style={{ fontFamily: F, fontSize: 12, color: C.char, fontStyle: "italic", marginTop: 1 }}>{it.calc.perfil}</div>}
                    <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 1 }}>Evaluación incompleta · falta: {it.calc.falta.join(" · ")}</div>
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
                    {it.calc.perfil && <div style={{ fontFamily: F, fontSize: 12, color: C.char, fontStyle: "italic", marginTop: 1 }}>{it.calc.perfil}</div>}
                    <div style={{ fontFamily: F, fontSize: 11.5, color: "#B23A2C", marginTop: 1 }}>{it.calc.motivoDescarte}</div>
                    {it.calc.notaFinal != null && <div style={{ fontFamily: F, fontSize: 11, color: C.mut, marginTop: 1 }}>Nota {it.calc.notaFinal} (no cuenta: descartada)</div>}
                  </div>
                </button>
              ))}
            </>
          )}

          {anteriores.length > 0 && (
            <>
              <div style={{ fontFamily: F, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: C.mutL, margin: "18px 4px 4px" }}>Plantilla anterior ({anteriores.length})</div>
              <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, margin: "0 4px 9px", lineHeight: 1.4 }}>Evaluadas en septiembre con la hoja antigua. Su nota es la de entonces y no es comparable con las de la plantilla nueva.</div>
              {anteriores.map((it) => { const et = it.calc.etiqueta; return (
                <button key={it.ev.candidato_id} onClick={() => onOpen(it.cand)} style={{ width: "100%", textAlign: "left", background: "#FAF8FC", border: `1px dashed #D9D0E6`, borderRadius: 14, padding: 12, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 11 }}>
                  <Foto c={it.cand} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span style={{ fontFamily: SF, fontSize: 15, color: C.char }}>{it.cand.nombre}</span><TagAnterior /></div>
                    <div style={{ fontFamily: F, fontSize: 11.5, color: it.calc.descartada ? "#B23A2C" : C.mut, marginTop: 1 }}>{it.calc.descartada ? it.calc.motivoDescarte : it.calc.completa ? `A ${it.calc.totalA}/6 · B ${it.calc.totalB}/${it.calc.maxB}` : `Evaluación incompleta · falta: ${it.calc.falta.join(" · ")}`}</div>
                  </div>
                  {it.calc.notaFinal != null && !it.calc.descartada && (
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: SF, fontSize: 20, color: C.mut }}>{it.calc.notaFinal}</div>
                      {et && <div style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: et.fg, background: et.bg, borderRadius: 999, padding: "2px 8px", marginTop: 2, opacity: 0.85 }}>{et.label}</div>}
                    </div>
                  )}
                </button>
              ); })}
            </>
          )}
        </>
      )}
    </div>
  );
}
