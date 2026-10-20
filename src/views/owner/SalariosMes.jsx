// Cierre de mes → Salarios por trabajadora (solicitud #18), desde octubre de 2026. Los meses anteriores siguen con la lista libre.
// Tarjeta: nómina (fija de configuración o a mano) + horas extras × precio + plus del mes + extras manuales, y los extras
// que se pagan con los sobres (#17). Al guardar, cada línea de datos_mes.salarios lleva amount = nómina + horas + plus + manuales
// y el desglose; los extras de sobres NO van en amount porque ya cuentan en Personal desde Efectivo de sobres (no se cuentan dos veces).
// Esporádicas (#21): quien tenga horas extras en el mes y no sea de plantilla sale aparte con horas × precio; su línea lleva esporadica: true.
import { useEffect, useMemo, useState } from "react";
import { F, SF, C, inp, crd } from "../../lib/styles.js";
import { fmt2, uid } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const num = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN; };
const txt = (x) => (x == null || x === "" ? "" : String(x).replace(".", ","));

export function SalariosMes({ mes, guardado, onCambio, onModo }) {
  const [live, setLive] = useState(null);
  const [nominas, setNominas] = useState({}); // usuario_id → texto (solo las de nómina manual)
  const [extras, setExtras] = useState({});   // usuario_id → [{id, concepto, importe(texto)}]
  useEffect(() => {
    let vivo = true;
    setLive(null);
    sb.rpc("salarios_mes", { p_mes: mes }).then((d) => { if (vivo) { setLive(d); onModo?.(!!d?.nuevo); } }).catch(() => { if (vivo) { setLive(false); onModo?.(false); } });
    return () => { vivo = false; };
  }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps
  // Lo guardado del mes (formato nuevo) rellena nóminas manuales y extras manuales
  useEffect(() => {
    const g = (guardado || []).filter((s) => s.v === 2);
    setNominas(Object.fromEntries(g.filter((s) => s.nomina_manual).map((s) => [s.usuario_id, txt(s.nomina)])));
    setExtras(Object.fromEntries(g.map((s) => [s.usuario_id, (s.extras || []).map((e) => ({ ...e, importe: txt(e.importe) }))])));
  }, [mes, live]); // eslint-disable-line react-hooks/exhaustive-deps

  const filas = useMemo(() => {
    if (!live || !live.nuevo) return [];
    const g = new Map((guardado || []).filter((s) => s.v === 2 && !s.esporadica).map((s) => [s.usuario_id, s]));
    return live.trabajadoras.map((t) => {
      const manual = t.nomina_fija == null;
      const nom = manual ? num(nominas[t.usuario_id]) : Number(t.nomina_fija);
      const ex = (extras[t.usuario_id] || []).map((e) => ({ ...e, valor: num(e.importe) }));
      const sumEx = ex.reduce((a, e) => a + (Number.isFinite(e.valor) ? e.valor : 0), 0);
      const sobres = t.extras_sobres.reduce((a, e) => a + Number(e.importe), 0);
      const base = r2((Number.isFinite(nom) ? nom : 0) + Number(t.importe_horas) + Number(t.plus) + sumEx);
      const s = g.get(t.usuario_id);
      const cambiado = !!s && (r2(s.horas) !== r2(t.horas) || r2(s.plus) !== r2(t.plus) || (!manual && r2(s.nomina) !== r2(t.nomina_fija)));
      return { t, manual, nom, ex, sumEx, sobres: r2(sobres), base, total: r2(base + sobres), falta: manual && !Number.isFinite(nom), cambiado };
    });
  }, [live, nominas, extras, guardado]);

  // Esporádicas: las del mes y, si había alguna guardada que ya no tiene horas, se ve a 0 h hasta que se guarde (entonces desaparece)
  const espo = useMemo(() => {
    if (!live || !live.nuevo) return [];
    const g = new Map((guardado || []).filter((s) => s.v === 2 && s.esporadica).map((s) => [s.usuario_id, s]));
    const vivas = (live.esporadicas || []).map((t) => { const s = g.get(t.usuario_id); return { ...t, horas: Number(t.horas), importe_horas: Number(t.importe_horas), cambiado: !!s && r2(s.horas) !== r2(t.horas), quitada: false }; });
    const ids = new Set(vivas.map((t) => t.usuario_id));
    const idas = [...g.values()].filter((s) => !ids.has(s.usuario_id)).map((s) => ({ usuario_id: s.usuario_id, nombre: s.nombre, horas: 0, importe_horas: 0, cambiado: true, quitada: true }));
    return [...vivas, ...idas].sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
  }, [live, guardado]);

  // Lo que se guarda en datos_mes.salarios
  useEffect(() => {
    if (!live || !live.nuevo) return;
    onCambio(filas.map((f) => ({
      id: `${mes}-${f.t.usuario_id}`, v: 2, usuario_id: f.t.usuario_id, nombre: f.t.nombre, amount: f.base,
      nomina: Number.isFinite(f.nom) ? f.nom : null, nomina_manual: f.manual, horas: Number(f.t.horas), importe_horas: Number(f.t.importe_horas),
      precio_hora: Number(live.precio_hora), plus: Number(f.t.plus),
      extras: f.ex.filter((e) => e.concepto?.trim() && Number.isFinite(e.valor) && e.valor > 0).map((e) => ({ id: e.id, concepto: e.concepto.trim(), importe: e.valor })),
      extras_sobres: f.sobres,
    })).concat(espo.filter((e) => !e.quitada).map((e) => ({
      id: `${mes}-${e.usuario_id}`, v: 2, esporadica: true, usuario_id: e.usuario_id, nombre: e.nombre, amount: r2(e.importe_horas),
      nomina: null, nomina_manual: false, horas: e.horas, importe_horas: r2(e.importe_horas), precio_hora: Number(live.precio_hora), plus: 0, extras: [], extras_sobres: 0,
    }))));
  }, [filas, espo]); // eslint-disable-line react-hooks/exhaustive-deps

  if (live === null) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando salarios…</div>;
  if (!live || !live.nuevo) return null;

  const totEspo = r2(espo.filter((e) => !e.quitada).reduce((a, e) => a + e.importe_horas, 0));
  const totBase = r2(filas.reduce((a, f) => a + f.base, 0) + totEspo);
  const totSobres = r2(filas.reduce((a, f) => a + f.sobres, 0));
  const incompleto = filas.some((f) => f.falta);
  const fila = (t, v, extra = {}) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontFamily: F, fontSize: 13, color: C.char, padding: "3px 0", ...extra }}><span>{t}</span><span style={{ whiteSpace: "nowrap" }}>{v}</span></div>;
  const setEx = (uidT, lista) => setExtras((p) => ({ ...p, [uidT]: lista }));

  return (
    <div>
      {filas.map((f) => (
        <div key={f.t.usuario_id} style={{ ...crd, border: f.falta ? `2px solid ${ROJO}` : crd.border }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{f.t.nombre}</span>
            <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.char }}>{fmt2(f.total)}</span>
          </div>
          {f.cambiado && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#7A4A0C", background: "#FFF1E0", borderRadius: 8, padding: "5px 8px", marginBottom: 6 }}>Han cambiado desde el último guardado: al guardar se actualizan.</div>}
          {f.manual ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontFamily: F, fontSize: 13, color: C.char, padding: "3px 0" }}>
              <span>Nómina (líquido){f.falta && <b style={{ color: ROJO }}> · Falta nómina</b>}</span>
              <input inputMode="decimal" value={nominas[f.t.usuario_id] ?? ""} onChange={(e) => setNominas({ ...nominas, [f.t.usuario_id]: e.target.value })} placeholder="0,00" aria-label={`Nómina de ${f.t.nombre}`} style={{ ...inp, width: 110, padding: "6px 8px", fontSize: 13, marginBottom: 0, textAlign: "right" }} />
            </div>
          ) : fila("Nómina (líquido)", fmt2(f.nom))}
          {fila(`Horas extras: ${txt(f.t.horas)} h × ${fmt2(live.precio_hora)}`, fmt2(f.t.importe_horas))}
          {fila("Plus del mes", fmt2(f.t.plus))}
          {f.ex.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
              <input value={e.concepto} onChange={(ev) => setEx(f.t.usuario_id, f.ex.map((x, j) => (j === i ? { ...x, concepto: ev.target.value } : x)))} placeholder="Concepto del extra" style={{ ...inp, flex: 1, padding: "6px 8px", fontSize: 13, marginBottom: 0 }} />
              <input inputMode="decimal" value={e.importe} onChange={(ev) => setEx(f.t.usuario_id, f.ex.map((x, j) => (j === i ? { ...x, importe: ev.target.value } : x)))} placeholder="0,00" style={{ ...inp, width: 90, padding: "6px 8px", fontSize: 13, marginBottom: 0, textAlign: "right", borderColor: e.importe && !(e.valor > 0) ? ROJO : inp.borderColor }} />
              <button type="button" aria-label="Quitar extra" onClick={() => setEx(f.t.usuario_id, f.ex.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: "#bbb", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setEx(f.t.usuario_id, [...f.ex, { id: uid(), concepto: "", importe: "" }])} style={{ border: "none", background: "none", padding: "4px 0", fontFamily: F, fontSize: 12.5, fontWeight: 600, color: C.char, textDecoration: "underline", cursor: "pointer" }}>+ Extra manual</button>
          {f.t.extras_sobres.length > 0 && (
            <div style={{ borderTop: `1px dashed ${C.brdL}`, marginTop: 6, paddingTop: 4 }}>
              <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.04em" }}>Extras pagados con los sobres</div>
              {f.t.extras_sobres.map((e, i) => <div key={i}>{fila(e.concepto, fmt2(e.importe), { color: C.mut })}</div>)}
            </div>
          )}
        </div>
      ))}
      {espo.length > 0 && (
        <>
          <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.04em", margin: "14px 2px 6px" }}>Esporádicas</div>
          {espo.map((e) => (
            <div key={e.usuario_id} style={{ ...crd, opacity: e.quitada ? 0.6 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{e.nombre}</span>
                <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.char }}>{fmt2(e.importe_horas)}</span>
              </div>
              {e.cambiado && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#7A4A0C", background: "#FFF1E0", borderRadius: 8, padding: "5px 8px", marginBottom: 6 }}>{e.quitada ? "Ya no tiene horas extras este mes: al guardar desaparece." : "Han cambiado desde el último guardado: al guardar se actualizan."}</div>}
              {fila(`Horas extras: ${txt(e.horas)} h × ${fmt2(live.precio_hora)}`, fmt2(e.importe_horas))}
            </div>
          ))}
        </>
      )}
      <div style={{ ...crd, background: "#F4EFE6", border: "none" }}>
        {fila(totEspo > 0 ? "Nóminas, horas, plus, extras manuales y esporádicas" : "Nóminas, horas, plus y extras manuales", fmt2(totBase))}
        {totSobres > 0 && fila("Extras pagados con los sobres", fmt2(totSobres))}
        {fila("Total salarios del mes", fmt2(r2(totBase + totSobres)), { fontSize: 15, fontWeight: 800, borderTop: `1px solid ${C.brdL}`, marginTop: 4, paddingTop: 6 })}
        {incompleto && <div style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: ROJO, marginTop: 4 }}>Incompleto: falta alguna nómina. Se puede guardar igual.</div>}
        <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 6, lineHeight: 1.4 }}>Los extras de los sobres se cambian en Finanzas → Efectivo de sobres. En la Cuenta de resultados entran una sola vez, dentro de Personal.</div>
      </div>
    </div>
  );
}
