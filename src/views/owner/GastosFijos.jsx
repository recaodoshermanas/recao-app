// Cierre de mes → Gastos fijos rellenados con los pagos del banco (solicitud #28).
// La búsqueda la hace gf_buscar (reglas en la tabla gf_reglas); lo guardado por concepto, gf_cierre vía gf_guardar.
import { useEffect, useRef, useState } from "react";
import { F, C, inp } from "../../lib/styles.js";
import { fmt2, pn } from "../../lib/utils.js";
import { GASTOS_FIJOS_TPL } from "../../lib/constants.js";
import { sb } from "../../lib/supabase.js";

const DESDE = "2026-10"; // los cierres anteriores ya guardados no se tocan solos
const fecha = (f) => new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const CLAVES = ["alquiler", "asesoria", "luz", "agua", "ss", "securitas", "epos"];
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

export function GastosFijos({ mes, valores, onValores, guardarRef }) {
  const [busq, setBusq] = useState(null); // null cargando · false sin banco · {clave: resultado}
  const [src, setSrc] = useState({}); // por concepto: { origen: "banco" | "a_mano", movs: [], sin_cargo }
  const cargado = useRef("");
  const valoresRef = useRef(valores);
  valoresRef.current = valores;

  useEffect(() => {
    if (mes < DESDE) { setBusq(false); return; }
    let vivo = true;
    setBusq(null); setSrc({});
    Promise.all([sb.rpc("gf_buscar", { p_mes: mes }), sb.select("gf_cierre", `select=concepto,origen,importe,movimientos&mes=eq.${mes}`)])
      .then(([res, guardados]) => {
        if (!vivo) return;
        const por = Object.fromEntries((res || []).map((r) => [r.clave, r]));
        const gu = Object.fromEntries((guardados || []).map((g) => [g.concepto, g]));
        const s = {}; const nuevos = {};
        for (const c of CLAVES) {
          const r = por[c]; if (!r) continue;
          if (gu[c]) {
            const vistos = [...(r.movs || []), ...(r.opciones || []).map((o) => o.mov)];
            s[c] = { origen: gu[c].origen, movs: (gu[c].movimientos || []).map((id) => vistos.find((m) => m.id === id) || { id }), sin_cargo: false };
            continue;
          }
          const actual = num(valoresRef.current[c]);
          if (actual > 0) continue; // ya hay un importe metido antes: no se pisa
          if (r.estado === "encontrado" || r.estado === "sin_cargo") {
            s[c] = { origen: "banco", movs: r.movs || [], sin_cargo: r.estado === "sin_cargo" };
            nuevos[c] = r.importe;
            if (c === "alquiler") nuevos.iva_alquiler = r.iva;
          }
        }
        cargado.current = mes;
        setBusq(por); setSrc(s);
        if (Object.keys(nuevos).length) onValores(nuevos);
      })
      .catch(() => { if (vivo) setBusq(false); });
    return () => { vivo = false; };
  }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  // El cierre llama a esto al guardar: apunta el origen y los movimientos usados de cada concepto
  useEffect(() => {
    guardarRef.current = async () => {
      if (!busq || cargado.current !== mes) return;
      const items = CLAVES.filter((c) => src[c]).map((c) => ({ concepto: c, origen: src[c].origen, importe: num(valoresRef.current[c]), movimientos: src[c].origen === "banco" ? src[c].movs.map((m) => m.id) : [] }));
      if (items.length) await sb.rpc("gf_guardar", { p_mes: mes, p_items: items });
    };
  });

  const escribir = (k, v) => {
    const c = k === "iva_alquiler" ? "alquiler" : k;
    onValores({ [k]: pn(v) });
    if (CLAVES.includes(c) && busq) setSrc((s) => ({ ...s, [c]: { origen: "a_mano", movs: [], sin_cargo: false } }));
  };
  const elegir = (c, o) => {
    setSrc((s) => ({ ...s, [c]: { origen: "banco", movs: [o.mov], sin_cargo: false } }));
    onValores({ [c]: o.importe, ...(c === "alquiler" ? { iva_alquiler: o.iva } : {}) });
  };
  const buscarOtraVez = (c) => {
    const r = busq[c]; if (!r) return;
    if (r.estado === "encontrado" || r.estado === "sin_cargo") {
      setSrc((s) => ({ ...s, [c]: { origen: "banco", movs: r.movs || [], sin_cargo: r.estado === "sin_cargo" } }));
      onValores({ [c]: r.importe, ...(c === "alquiler" ? { iva_alquiler: r.iva } : {}) });
    } else {
      setSrc((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== c)));
      onValores({ [c]: "", ...(c === "alquiler" ? { iva_alquiler: "" } : {}) });
    }
  };

  const nota = { fontFamily: F, fontSize: "11.5px", color: C.mut, lineHeight: 1.4 };
  const chip = (txt, bg, fg) => <span style={{ fontFamily: F, fontSize: "10.5px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: bg, color: fg }}>{txt}</span>;

  return (
    <>
      {busq === null && <div style={{ ...nota, marginBottom: "10px" }}>Buscando los pagos en el banco…</div>}
      {GASTOS_FIJOS_TPL.map((g) => {
        const c = g.key === "iva_alquiler" ? "alquiler" : g.key;
        const r = busq && busq[c];
        const s = src[c];
        const propio = g.key !== "iva_alquiler"; // el IVA del alquiler cuelga de la línea del alquiler
        return (
          <div key={g.key} style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: F, fontSize: "13px", color: C.char, flex: 1 }}>{g.label}</span>
              {propio && s?.origen === "banco" && chip(s.sin_cargo ? "Sin cargo este mes" : "Del banco", "#E7F3EC", "#1E7A46")}
              {propio && s?.origen === "a_mano" && chip("A mano", "#F0ECE2", "#5E5444")}
              <input type="number" inputMode="decimal" value={valores[g.key] || ""} onChange={(e) => escribir(g.key, e.target.value)} placeholder="0" style={{ ...inp, width: "110px", padding: "8px 10px", fontSize: "13px", marginBottom: 0, textAlign: "right" }} />
            </div>
            {propio && r && (
              <div style={{ marginTop: "4px" }}>
                {s?.origen === "banco" && s.movs.some((m) => m.fecha) && (
                  <details style={nota}><summary style={{ cursor: "pointer" }}>{s.movs.length === 1 ? `${fecha(s.movs[0].fecha)} · ${fmt2(s.movs[0].importe)}` : `${s.movs.length} movimientos`}</summary>
                    {s.movs.map((m) => <div key={m.id}>{fecha(m.fecha)} · {fmt2(m.importe)} · {m.concepto}</div>)}
                  </details>
                )}
                {!s && r.estado === "opciones" && (
                  <div style={{ ...nota, color: "#8A6410" }}>Hay más de un pago que encaja. Elige cuál vale:
                    {r.opciones.map((o) => (
                      <button key={o.mov.id} onClick={() => elegir(c, o)} style={{ display: "block", marginTop: "4px", background: "#FBF0DA", border: "none", borderRadius: "8px", padding: "6px 10px", fontFamily: F, fontSize: "12px", cursor: "pointer", textAlign: "left" }}>
                        {fecha(o.mov.fecha)} · {fmt2(o.mov.importe)} · {o.mov.concepto}
                      </button>
                    ))}
                  </div>
                )}
                {!s && r.estado === "no_encontrado" && <div style={{ ...nota, color: "#B23A2C" }}>No encontrado en el banco: mételo a mano.</div>}
                {(s?.origen === "a_mano" || (!s && num(valores[g.key]) > 0 && r.estado !== "no_encontrado")) && (
                  <button onClick={() => buscarOtraVez(c)} style={{ background: "none", border: "none", padding: 0, fontFamily: F, fontSize: "12px", fontWeight: 600, color: C.blu, cursor: "pointer" }}>Volver a buscar en el banco</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
