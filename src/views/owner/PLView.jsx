import { F, SF, C, crd } from "../../lib/styles";
import { fmt, mkLabel, calcMonth } from "../../lib/utils";

export function PLView({ facturas, monthlyData }) {
  const months = Object.keys(monthlyData).sort().reverse();
  if (!months.length) return <div style={{ textAlign: "center", padding: "60px 20px", color: C.mut, fontFamily: F }}>No hay datos</div>;
  return (
    <div style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "4px" }}>Cuenta de resultados</h2>
      <p style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "20px" }}>Solo operaciones. Inversiones y repartos no aparecen aquí.</p>
      {months.map(mk => {
        const c = calcMonth(facturas, monthlyData[mk], mk);
        return (
          <div key={mk} style={{ ...crd, marginBottom: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontFamily: SF, fontSize: "16px", color: C.char }}>{mkLabel(mk)}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: F, fontSize: "18px", fontWeight: 700, color: c.resultado >= 0 ? C.grn : C.red }}>{fmt(c.resultado)}</div>
                <div style={{ fontFamily: F, fontSize: "11px", color: C.mut }}>Margen {c.margen.toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", marginBottom: "12px", background: "#f0ebe3" }}>
              {c.totalIngresos > 0 && <div style={{ width: `${Math.min((c.totalGastos / c.totalIngresos) * 100, 100)}%`, background: C.red, borderRadius: "3px 0 0 3px" }} />}
              {c.resultado > 0 && <div style={{ flex: 1, background: C.grn, borderRadius: "0 3px 3px 0" }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
