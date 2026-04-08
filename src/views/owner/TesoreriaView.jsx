import { useState } from "react";
import { F, SF, C, inp, lbl, crd } from "../../lib/styles.js";
import { fmt, mkLabel, pn, calcMonth } from "../../lib/utils.js";
import { sb } from "../../lib/supabase.js";
import { useConfirm } from "../../hooks/useConfirm.jsx";

function Mini({ label, val, color }) {
  return (
    <div style={{ background: C.cream, borderRadius: "8px", padding: "10px 12px" }}>
      <div style={{ fontFamily: F, fontSize: "10px", color: C.mut, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontFamily: F, fontSize: "14px", fontWeight: 700, color: val === 0 ? "#ccc" : color }}>{fmt(val)}</div>
    </div>
  );
}

function SaldoSetup({ onReload }) {
  const [amount, setAmount] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    const v = pn(amount);
    if (v < 0) return;
    setSaving(true);
    try {
      await sb.upsert("config", { key: "saldo_inicial", value: { amount: v, fecha } }, "key");
      await onReload();
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };
  return (
    <div style={{ padding: "20px", maxWidth: 460, margin: "0 auto" }}>
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "20px" }}>Tesorería</h2>
      <div style={{ ...crd, border: `2px solid ${C.gold}`, padding: "24px" }}>
        <div style={{ fontFamily: F, fontSize: "15px", fontWeight: 600, color: C.char, marginBottom: "6px" }}>Punto de partida</div>
        <p style={{ fontFamily: F, fontSize: "13px", color: C.mut, lineHeight: 1.5, marginBottom: "20px" }}>Contad todo el dinero del negocio (sobres + banco). Solo se hace una vez.</p>
        <label style={lbl}>Fecha</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, marginBottom: "14px" }} />
        <label style={lbl}>Dinero total (€)</label>
        <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="15000" style={{ ...inp, marginBottom: "20px" }} />
        <button onClick={handleSave} disabled={!amount || saving} style={{ width: "100%", padding: "14px", border: "none", borderRadius: "10px", background: (!amount || saving) ? "#D8D0C4" : C.char, color: (!amount || saving) ? "#A09888" : C.gold, fontFamily: SF, fontSize: "15px", cursor: (!amount || saving) ? "default" : "pointer" }}>{saving ? "Guardando..." : "Fijar punto de partida"}</button>
      </div>
    </div>
  );
}

export function TesoreriaView({ facturas, monthlyData, config, onReload }) {
  const { ask, Dialog } = useConfirm();
  const months = Object.keys(monthlyData).sort();
  const saldoInicial = config.saldo_inicial;
  if (!saldoInicial) return <SaldoSetup onReload={onReload} />;

  let saldo = parseFloat(saldoInicial.amount);
  const rows = months.map(mk => {
    const c = calcMonth(facturas, monthlyData[mk], mk);
    const netoCaja = c.resultado - c.totalInversiones - c.reparto;
    saldo += netoCaja;
    return { mk, ...c, netoCaja, saldo };
  });
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;

  const handleReset = async () => {
    try { await sb.delete("config", `key=eq.saldo_inicial`); await onReload(); }
    catch (e) { alert("Error: " + e.message); }
  };

  return (
    <div style={{ padding: "20px", maxWidth: 600, margin: "0 auto" }}>
      <Dialog />
      <h2 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "4px" }}>Tesorería</h2>
      <p style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginBottom: "20px" }}>Dinero real: operaciones + inversiones + socios</p>
      <div style={{ background: `linear-gradient(135deg, ${C.char} 0%, #3D3D3D 100%)`, borderRadius: "16px", padding: "24px", marginBottom: "20px", color: "#fff" }}>
        <div style={{ fontFamily: F, fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: "4px" }}>Saldo estimado</div>
        <div style={{ fontFamily: SF, fontSize: "36px", color: C.gold }}>{fmt(latest ? latest.saldo : saldoInicial.amount)}</div>
        <div style={{ fontFamily: F, fontSize: "11px", color: "#666", marginTop: "8px" }}>Inicio: {fmt(saldoInicial.amount)} · {saldoInicial.fecha || ""}</div>
      </div>
      {[...rows].reverse().map(r => (
        <div key={r.mk} style={crd}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontFamily: SF, fontSize: "15px", color: C.char }}>{mkLabel(r.mk)}</span>
            <span style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: r.netoCaja >= 0 ? C.grn : C.red }}>{r.netoCaja >= 0 ? "+" : ""}{fmt(r.netoCaja)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <Mini label="Resultado op." val={r.resultado} color={C.grn} />
            <Mini label="Inversiones" val={r.totalInversiones} color={C.blu} />
            <Mini label="Socios" val={r.reparto} color={C.pur} />
            <Mini label="Saldo acum." val={r.saldo} color={C.char} />
          </div>
        </div>
      ))}
      <button onClick={() => ask("¿Reiniciar el saldo inicial?", handleReset)} style={{ display: "block", margin: "24px auto", padding: "8px 20px", border: `1px solid ${C.brd}`, borderRadius: "8px", background: "none", color: C.mut, fontFamily: F, fontSize: "11px", cursor: "pointer" }}>Reiniciar saldo inicial</button>
    </div>
  );
}
