import { useState } from "react";
import { F, SF, C, crd } from "../../lib/styles.js";
import { fmt, fmt2, mkLabel, calcMonth, gastoFijoLabel } from "../../lib/utils.js";
import { PAQUETERIA } from "../../lib/constants.js";

function Row({ label, val, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontFamily: F, fontSize: "13px", color: C.char, fontWeight: bold ? 700 : 400, borderBottom: bold ? `1px solid ${C.brd}` : "none" }}>
      <span style={{ color: bold ? C.char : C.mut }}>{label}</span>
      <span>{fmt2(val)}</span>
    </div>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginTop: "14px" }}>
      <div style={{ fontFamily: F, fontSize: "10px", fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>{title}</div>
      {children}
    </div>
  );
}

export function PLView({ facturas, monthlyData, onEditMonth }) {
  const [expanded, setExpanded] = useState(null);
  const months = Object.keys(monthlyData).sort().reverse();
  if (!months.length) return <div style={{ textAlign: "center", padding: "60px 20px", color: C.mut, fontFamily: F }}>No hay datos</div>;

  return (
    <div style={{ padding: "20px", maxWidth: 600, margin: "0 auto", paddingBottom: "40px" }}>
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "4px" }}>Cuenta de resultados</h2>
      <p style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "20px" }}>Solo operaciones. Pulsa cualquier mes para ver el desglose completo.</p>
      {months.map(mk => {
        const md = monthlyData[mk] || {};
        const c = calcMonth(facturas, md, mk);
        const isOpen = expanded === mk;
        const facsMes = facturas.filter(f => f.fecha?.startsWith(mk));
        return (
          <div key={mk} style={{ ...crd, marginBottom: "14px", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : mk)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: SF, fontSize: "16px", color: C.char }}>{mkLabel(mk)}{c.isSummary && <span style={{ fontFamily: F, fontSize: "10px", color: C.mut, marginLeft: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>resumen</span>}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: F, fontSize: "18px", fontWeight: 700, color: c.resultado >= 0 ? C.grn : C.red }}>{fmt(c.resultado)}</div>
                <div style={{ fontFamily: F, fontSize: "11px", color: C.mut }}>Margen {c.margen.toFixed(1)}% · {isOpen ? "▲" : "▼"}</div>
              </div>
            </div>
            <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", marginTop: "12px", background: "#f0ebe3" }}>
              {c.totalIngresos > 0 && <div style={{ width: `${Math.min((c.totalGastos / c.totalIngresos) * 100, 100)}%`, background: C.red, borderRadius: "3px 0 0 3px" }} />}
              {c.resultado > 0 && <div style={{ flex: 1, background: C.grn, borderRadius: "0 3px 3px 0" }} />}
            </div>

            {isOpen && (
              <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${C.brd}` }} onClick={e => e.stopPropagation()}>
                {c.isSummary ? (
                  <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, padding: "8px 0", lineHeight: 1.5 }}>
                    Este mes solo tiene datos resumidos. Pulsa <strong>Editar datos del mes</strong> para rellenar el desglose completo.
                  </div>
                ) : (
                  <>
                    <SubSection title="Ingresos">
                      <Row label="Ventas EPOS" val={parseFloat(md.ventas_epos || 0)} />
                      {Object.entries(md.paqueteria || {}).filter(([, v]) => parseFloat(v) > 0).map(([k, v]) => (<Row key={k} label={`Paquetería · ${k}`} val={parseFloat(v)} />))}
                      <Row label="Total ingresos" val={c.totalIngresos} bold />
                    </SubSection>
                    <SubSection title="Facturas proveedores">
                      {facsMes.length === 0 && <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, padding: "6px 0" }}>Sin facturas</div>}
                      {facsMes.map(f => (<Row key={f.id} label={f.proveedor} val={parseFloat(f.importe)} />))}
                      <Row label="Total facturas" val={c.totalFacturas} bold />
                    </SubSection>
                    <SubSection title="Salarios">
                      {(md.salarios || []).filter(s => parseFloat(s.amount) > 0).map(s => (<Row key={s.id} label={s.nombre || "(sin nombre)"} val={parseFloat(s.amount)} />))}
                      <Row label="Total salarios" val={c.totalSalarios} bold />
                    </SubSection>
                    <SubSection title="Gastos fijos">
                      {Object.entries(md.gastos_fijos || {}).filter(([, v]) => parseFloat(v) > 0).map(([k, v]) => (<Row key={k} label={gastoFijoLabel(k)} val={parseFloat(v)} />))}
                      <Row label="Total fijos" val={c.totalGastosFijos} bold />
                    </SubSection>
                    <SubSection title="Otros gastos">
                      {(md.otros_gastos || []).filter(o => parseFloat(o.amount) > 0).map(o => (<Row key={o.id} label={o.concepto || "(sin concepto)"} val={parseFloat(o.amount)} />))}
                      <Row label="Total otros" val={c.totalOtros} bold />
                    </SubSection>
                    <div style={{ marginTop: "16px", padding: "12px", background: C.cream, borderRadius: "8px" }}>
                      <Row label="Total ingresos" val={c.totalIngresos} />
                      <Row label="Total gastos" val={c.totalGastos} />
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontFamily: SF, fontSize: "15px", color: c.resultado >= 0 ? C.grn : C.red, borderTop: `2px solid ${C.brd}`, marginTop: "6px" }}>
                        <span>Resultado</span><span>{fmt2(c.resultado)}</span>
                      </div>
                    </div>
                  </>
                )}
                <button onClick={(e) => { e.stopPropagation(); onEditMonth && onEditMonth(mk); }} style={{ width: "100%", marginTop: "14px", padding: "12px", border: "none", borderRadius: "10px", background: C.char, color: C.gold, fontFamily: SF, fontSize: "14px", cursor: "pointer" }}>Editar datos del mes →</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
