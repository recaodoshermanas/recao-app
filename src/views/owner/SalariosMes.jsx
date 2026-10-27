// Cierre de mes → Salarios por persona (solicitud #18), desde octubre de 2026. Los meses anteriores siguen con la lista libre.
// #59: cada persona (de nómina, apoyo o eventual) tiene su bloque con la nómina (si la tiene), los extras manuales y lo que se le
// paga en efectivo con los sobres, por apartado: Eventuales, Horas extras, Plus de festivos, Plus del mes y Otros extras.
// Todo lo de los sobres sale de la misma fuente que Efectivo de sobres (extras_lineas) y ya cuenta en Personal desde allí:
// por eso en datos_mes.salarios, amount = nómina + extras manuales (las horas extras ya NO van en amount, se pagan con los sobres).
import { useEffect, useMemo, useState } from "react";
import { F, SF, C, inp, crd } from "../../lib/styles.js";
import { fmt2, uid } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";

const ROJO = "#B3261E";
const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const num = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN; };
const txt = (x) => (x == null || x === "" ? "" : String(x).replace(".", ","));
const APARTADOS = [["sueldo_horas", "Sueldo por horas"], ["eventuales", "Eventuales"], ["horas_extras", "Horas extras"], ["festivos", "Plus de festivos"], ["plus", "Plus del mes"], ["otros", "Otros extras"]];

export function SalariosMes({ mes, guardado, onCambio, onModo }) {
  const [live, setLive] = useState(null);
  const [nominas, setNominas] = useState({}); // usuario_id → texto (solo las de nómina manual)
  const [extras, setExtras] = useState({});   // usuario_id → [{id, concepto, importe(texto)}]
  const [ed, setEd] = useState(null);         // #80: edición a mano del sueldo por horas {uid, importe, motivo, quitar}
  const [err, setErr] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cargar = () => sb.rpc("salarios_mes", { p_mes: mes }).then((d) => setLive(d)).catch(() => {});
  const guardarHoras = async () => {
    setErr("");
    const motivo = (ed.motivo || "").trim();
    const imp = num(ed.importe);
    if (!motivo) { setErr("El motivo es obligatorio."); return; }
    if (!ed.quitar && !Number.isFinite(imp)) { setErr("Pon un importe válido (por ejemplo 1128,00)."); return; }
    setOcupado(true);
    try {
      if (ed.quitar) await sb.rpc("sueldo_horas_quitar_ajuste", { p_mes: mes, p_uid: ed.uid, p_motivo: motivo });
      else await sb.rpc("sueldo_horas_ajustar", { p_mes: mes, p_uid: ed.uid, p_importe: imp, p_motivo: motivo });
      setEd(null);
      await cargar();
    } catch (e) { setErr(e?.message || "No se ha podido guardar."); }
    setOcupado(false);
  };
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
      const manual = t.nomina_fija == null && !t.por_horas;
      const nom = t.por_horas ? 0 : manual ? num(nominas[t.usuario_id]) : Number(t.nomina_fija);
      const ex = (extras[t.usuario_id] || []).map((e) => ({ ...e, valor: num(e.importe) }));
      const sumEx = ex.reduce((a, e) => a + (Number.isFinite(e.valor) ? e.valor : 0), 0);
      const sobres = (t.extras_sobres || []).reduce((a, e) => a + Number(e.importe), 0);
      const base = r2((Number.isFinite(nom) ? nom : 0) + sumEx);
      const s = g.get(t.usuario_id);
      const cambiado = !!s && (Number(s.importe_horas) > 0 || r2(s.extras_sobres) !== r2(sobres) || (!manual && !t.por_horas && r2(s.nomina) !== r2(t.nomina_fija)));
      return { t, manual, nom, ex, sumEx, sobres: r2(sobres), base, total: r2(base + sobres), falta: manual && !Number.isFinite(nom), cambiado };
    });
  }, [live, nominas, extras, guardado]);

  // Personas que no están en la lista de nóminas (eventuales, apoyos nuevos…): solo lo que cobran en efectivo con los sobres
  const otras = useMemo(() => (live && live.nuevo ? live.otras || [] : []), [live]);

  // Lo que se guarda en datos_mes.salarios
  useEffect(() => {
    if (!live || !live.nuevo) return;
    onCambio(filas.map((f) => ({
      id: `${mes}-${f.t.usuario_id}`, v: 2, usuario_id: f.t.usuario_id, nombre: f.t.nombre, amount: f.base,
      nomina: f.t.por_horas ? null : Number.isFinite(f.nom) ? f.nom : null, nomina_manual: f.manual, por_horas: !!f.t.por_horas, horas: 0, importe_horas: 0,
      precio_hora: Number(live.precio_hora), plus: 0, plus_calculado: Number(f.t.plus),
      extras: f.ex.filter((e) => e.concepto?.trim() && Number.isFinite(e.valor) && e.valor > 0).map((e) => ({ id: e.id, concepto: e.concepto.trim(), importe: e.valor })),
      extras_sobres: f.sobres,
    })));
  }, [filas]); // eslint-disable-line react-hooks/exhaustive-deps

  if (live === null) return <div style={{ ...crd, fontFamily: F, fontSize: 13, color: C.mut }}>Cargando salarios…</div>;
  if (!live || !live.nuevo) return null;

  const totBase = r2(filas.reduce((a, f) => a + f.base, 0));
  const totSobres = r2(filas.reduce((a, f) => a + f.sobres, 0) + otras.reduce((a, o) => a + Number(o.sobres_total), 0));
  const hayPlus = filas.some((f) => (f.t.extras_sobres || []).some((e) => e.apartado === "plus"));
  const incompleto = filas.some((f) => f.falta);
  const fila = (t, v, extra = {}) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontFamily: F, fontSize: 13, color: C.char, padding: "3px 0", ...extra }}><span>{t}</span><span style={{ whiteSpace: "nowrap" }}>{v}</span></div>;
  const setEx = (uidT, lista) => setExtras((p) => ({ ...p, [uidT]: lista }));
  // Lo que se paga en efectivo con los sobres, por apartado (solo lectura: se cambia en su origen o en Efectivo de sobres)
  const sobresBloque = (lineas) => {
    const ls = lineas || [];
    if (!ls.length) return null;
    return (
      <div style={{ borderTop: `1px dashed ${C.brdL}`, marginTop: 6, paddingTop: 4 }}>
        <div style={{ fontFamily: F, fontSize: 11.5, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.04em" }}>En efectivo con los sobres</div>
        {APARTADOS.map(([ap, titulo]) => {
          const del = ls.filter((e) => (e.apartado || "otros") === ap);
          if (!del.length) return null;
          return (
            <div key={ap} style={{ marginTop: 3 }}>
              {fila(<b>{titulo}</b>, <b>{fmt2(r2(del.reduce((a, e) => a + Number(e.importe), 0)))}</b>)}
              {del.map((e, i) => <div key={i}>{fila(<span style={{ paddingLeft: 10, display: "inline-block" }}>{e.concepto}</span>, fmt2(Number(e.importe)), { color: C.mut, fontSize: 12.5, padding: "1px 0" })}</div>)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      {filas.map((f) => (
        <div key={f.t.usuario_id} style={{ ...crd, border: f.falta ? `2px solid ${ROJO}` : crd.border }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{f.t.nombre}</span>
            <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.char }}>{fmt2(f.total)}</span>
          </div>
          {f.cambiado && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#7A4A0C", background: "#FFF1E0", borderRadius: 8, padding: "5px 8px", marginBottom: 6 }}>Han cambiado desde el último guardado: se actualizan solos.</div>}
          {f.t.por_horas && f.t.sueldo_horas && (() => {
            const h = f.t.sueldo_horas;
            const editando = ed && ed.uid === f.t.usuario_id;
            return (
              <div style={{ padding: "3px 0" }}>
                {fila(<span>Sueldo por horas <span style={{ fontSize: 11.5, color: C.mut }}>(sale del calendario; se paga con los sobres del día 1)</span></span>, h.manual != null ? fmt2(Number(h.manual)) : fmt2(Number(h.calculado_hoy)))}
                {h.manual != null && fila(<span style={{ fontSize: 12, color: C.mut }}>Cifra puesta a mano · {h.motivo}</span>, "", { padding: "0 0 2px" })}
                {h.aviso && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#7A4A0C", background: "#FFF1E0", borderRadius: 8, padding: "5px 8px", margin: "4px 0" }}>El calendario ha cambiado desde que se puso la cifra a mano: el cálculo por horas ahora da {fmt2(Number(h.calculado_mes))} (cuando se puso daba {fmt2(Number(h.calculado_al_ajustar))}) y se queda la cifra a mano {fmt2(Number(h.manual))}. Revísalo.</div>}
                {h.manual == null && Number(h.calculado_mes) !== Number(h.calculado_hoy) && <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut }}>Con todos los turnos del mes: {fmt2(Number(h.calculado_mes))}.</div>}
                {!editando && (
                  <div>
                    <button type="button" onClick={() => { setErr(""); setEd({ uid: f.t.usuario_id, importe: txt(h.manual ?? h.calculado_mes), motivo: "", quitar: false }); }} style={{ border: "none", background: "none", padding: "4px 0", fontFamily: F, fontSize: 12.5, fontWeight: 600, color: C.char, textDecoration: "underline", cursor: "pointer" }}>Modificar a mano</button>
                    {h.manual != null && <button type="button" onClick={() => { setErr(""); setEd({ uid: f.t.usuario_id, importe: "", motivo: "", quitar: true }); }} style={{ border: "none", background: "none", padding: "4px 8px", fontFamily: F, fontSize: 12.5, fontWeight: 600, color: C.char, textDecoration: "underline", cursor: "pointer" }}>Volver al cálculo</button>}
                  </div>
                )}
                {editando && (
                  <div style={{ background: "#F4EFE6", borderRadius: 8, padding: 8, margin: "4px 0" }}>
                    {!ed.quitar && <input inputMode="decimal" value={ed.importe} onChange={(e) => setEd({ ...ed, importe: e.target.value })} placeholder="Sueldo por horas del mes" aria-label="Sueldo por horas del mes" style={{ ...inp, padding: "6px 8px", fontSize: 13, marginBottom: 6, textAlign: "right" }} />}
                    <input value={ed.motivo} onChange={(e) => setEd({ ...ed, motivo: e.target.value })} placeholder="Motivo (obligatorio)" aria-label="Motivo" style={{ ...inp, padding: "6px 8px", fontSize: 13, marginBottom: 6 }} />
                    {err && <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: ROJO, marginBottom: 4 }}>{err}</div>}
                    <button type="button" disabled={ocupado} onClick={guardarHoras} style={{ border: "none", background: C.char, color: "#fff", borderRadius: 8, padding: "6px 12px", fontFamily: F, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{ed.quitar ? "Volver al cálculo" : "Guardar"}</button>
                    <button type="button" onClick={() => setEd(null)} style={{ border: "none", background: "none", padding: "6px 10px", fontFamily: F, fontSize: 12.5, cursor: "pointer", color: C.mut }}>Cancelar</button>
                  </div>
                )}
                {(h.historial || []).length > 0 && (
                  <details style={{ fontFamily: F, fontSize: 12, color: C.mut }}>
                    <summary style={{ cursor: "pointer" }}>Historial de cambios ({h.historial.length})</summary>
                    {h.historial.map((x, i) => <div key={i} style={{ padding: "2px 0" }}>{new Date(x.en).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {x.por || "—"} · {x.accion === "ajuste" ? `de ${fmt2(Number(x.antes))} a ${fmt2(Number(x.despues))} (cálculo: ${fmt2(Number(x.calculado))})` : `volvió al cálculo (${fmt2(Number(x.calculado))}; antes ${fmt2(Number(x.antes))})`} · {x.motivo}</div>)}
                  </details>
                )}
              </div>
            );
          })()}
          {f.manual ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontFamily: F, fontSize: 13, color: C.char, padding: "3px 0" }}>
              <span>Nómina (líquido){f.falta && <b style={{ color: ROJO }}> · Falta nómina</b>}</span>
              <input inputMode="decimal" value={nominas[f.t.usuario_id] ?? ""} onChange={(e) => setNominas({ ...nominas, [f.t.usuario_id]: e.target.value })} placeholder="0,00" aria-label={`Nómina de ${f.t.nombre}`} style={{ ...inp, width: 110, padding: "6px 8px", fontSize: 13, marginBottom: 0, textAlign: "right" }} />
            </div>
          ) : f.t.por_horas ? null : fila("Nómina (líquido)", fmt2(f.nom))}
          {!hayPlus && Number(f.t.plus) > 0 && fila(<span>Plus del mes previsto <span style={{ fontSize: 11.5 }}>(entra en los sobres el día 1, cuando acaba el mes)</span></span>, fmt2(f.t.plus), { color: C.mut })}
          {f.ex.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
              <input value={e.concepto} onChange={(ev) => setEx(f.t.usuario_id, f.ex.map((x, j) => (j === i ? { ...x, concepto: ev.target.value } : x)))} placeholder="Concepto del extra" style={{ ...inp, flex: 1, padding: "6px 8px", fontSize: 13, marginBottom: 0 }} />
              <input inputMode="decimal" value={e.importe} onChange={(ev) => setEx(f.t.usuario_id, f.ex.map((x, j) => (j === i ? { ...x, importe: ev.target.value } : x)))} placeholder="0,00" style={{ ...inp, width: 90, padding: "6px 8px", fontSize: 13, marginBottom: 0, textAlign: "right", borderColor: e.importe && !(e.valor > 0) ? ROJO : inp.borderColor }} />
              <button type="button" aria-label="Quitar extra" onClick={() => setEx(f.t.usuario_id, f.ex.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: "#bbb", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setEx(f.t.usuario_id, [...f.ex, { id: uid(), concepto: "", importe: "" }])} style={{ border: "none", background: "none", padding: "4px 0", fontFamily: F, fontSize: 12.5, fontWeight: 600, color: C.char, textDecoration: "underline", cursor: "pointer" }}>+ Extra manual</button>
          {sobresBloque(f.t.extras_sobres)}
        </div>
      ))}
      {otras.length > 0 && (
        <>
          <div style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: C.mut, textTransform: "uppercase", letterSpacing: "0.04em", margin: "14px 2px 6px" }}>Eventuales y otras personas</div>
          {otras.map((o) => (
            <div key={o.usuario_id || o.nombre} style={crd}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                <span style={{ fontFamily: SF, fontSize: 16, color: C.char }}>{o.nombre}{o.eventual && <span style={{ fontFamily: F, fontSize: 12, color: C.mut }}> · eventual</span>}</span>
                <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, color: C.char }}>{fmt2(Number(o.sobres_total))}</span>
              </div>
              {fila("Sin nómina en la lista: cobra en efectivo", "", { color: C.mut, fontSize: 12 })}
              {sobresBloque(o.extras_sobres)}
            </div>
          ))}
        </>
      )}
      <div style={{ ...crd, background: "#F4EFE6", border: "none" }}>
        {fila("Nóminas y extras manuales", fmt2(totBase))}
        {totSobres > 0 && fila("En efectivo con los sobres (eventuales, horas extras, festivos, plus y otros)", fmt2(totSobres))}
        {fila("Total salarios del mes", fmt2(r2(totBase + totSobres)), { fontSize: 15, fontWeight: 800, borderTop: `1px solid ${C.brdL}`, marginTop: 4, paddingTop: 6 })}
        {incompleto && <div style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: ROJO, marginTop: 4 }}>Incompleto: falta alguna nómina (sale en la lista de cierre).</div>}
        <div style={{ fontFamily: F, fontSize: 11.5, color: C.mut, marginTop: 6, lineHeight: 1.4 }}>Lo de los sobres sale solo del horario, las horas extras, los festivos y el plus, y se ve también en Finanzas → Efectivo de sobres. En la Cuenta de resultados entra una sola vez, dentro de Personal.</div>
      </div>
    </div>
  );
}
