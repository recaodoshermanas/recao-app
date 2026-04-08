import { useState, useMemo } from "react";
import { F, SF, C, inp, lbl, crd } from "../lib/styles.js";
import { fmt, fmt2, mkLabel, uid, pn } from "../lib/utils.js";
import { sb } from "../lib/supabase.js";
import { useConfirm } from "../hooks/useConfirm.jsx";

export function WorkerView({ facturas, proveedores, onReload }) {
  const [modo, setModo] = useState("lista");
  const [editId, setEditId] = useState(null);
  const [proveedor, setProveedor] = useState("");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isNewProv, setIsNewProv] = useState(false);
  const { ask, Dialog } = useConfirm();

  const resetForm = () => { setProveedor(""); setImporte(""); setFecha(new Date().toISOString().split("T")[0]); setNota(""); setEditId(null); setIsNewProv(false); };

  const allProveedores = useMemo(() => {
    const fromFacs = [...new Set(facturas.map(f => f.proveedor))];
    return [...new Set([...proveedores, ...fromFacs])].sort();
  }, [facturas, proveedores]);

  const handleSave = async () => {
    const amt = pn(importe);
    if (!proveedor.trim() || amt <= 0) return;
    setSaving(true);
    try {
      const payload = { proveedor: proveedor.trim(), importe: amt, fecha, nota: nota.trim() || null };
      if (editId) await sb.update("facturas_proveedores", `id=eq.${editId}`, payload);
      else {
        await sb.insert("facturas_proveedores", payload);
        if (isNewProv && !proveedores.includes(proveedor.trim())) {
          try { await sb.insert("proveedores", { nombre: proveedor.trim() }); } catch {}
        }
      }
      await onReload();
      resetForm();
      setSaved(true);
      setTimeout(() => { setSaved(false); setModo("lista"); }, 1000);
    } catch (e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const startEdit = (f) => { setEditId(f.id); setProveedor(f.proveedor); setImporte(String(f.importe)); setFecha(f.fecha); setNota(f.nota || ""); setModo("form"); };

  const handleDelete = async (id) => {
    try { await sb.delete("facturas_proveedores", `id=eq.${id}`); await onReload(); }
    catch (e) { alert("Error: " + e.message); }
  };

  const sorted = [...facturas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  const grouped = {};
  sorted.forEach(f => { const mk = f.fecha.substring(0, 7); if (!grouped[mk]) grouped[mk] = []; grouped[mk].push(f); });

  return (
    <div style={{ padding: "16px", maxWidth: 540, margin: "0 auto" }}>
      <Dialog />
      {modo === "lista" ? (
        <>
          <button onClick={() => { resetForm(); setModo("form"); }} style={{ width: "100%", padding: "18px", border: `2px dashed ${C.brd}`, borderRadius: "12px", background: "transparent", fontFamily: SF, fontSize: "16px", color: C.char, cursor: "pointer", marginBottom: "20px" }}>+ Nueva factura de proveedor</button>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: C.mut, fontFamily: F, fontSize: "14px" }}>No hay facturas registradas</div>
          ) : (
            Object.entries(grouped).map(([mk, items]) => (
              <div key={mk}>
                <div style={{ fontFamily: SF, fontSize: "15px", color: C.char, marginBottom: "10px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span>{mkLabel(mk)}</span>
                  <span style={{ fontFamily: F, fontSize: "13px", fontWeight: 700, color: C.mut }}>{fmt(items.reduce((s, f) => s + parseFloat(f.importe), 0))}</span>
                </div>
                {items.map(f => (
                  <div key={f.id} style={{ ...crd, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: "14px", fontWeight: 600, color: C.char, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.proveedor}</div>
                      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginTop: "2px" }}>{new Date(f.fecha).toLocaleDateString("es-ES")}{f.nota ? ` · ${f.nota}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "10px" }}>
                      <span style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: C.char }}>{fmt2(f.importe)}</span>
                      <button onClick={() => startEdit(f)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "14px", color: C.mut, padding: "4px" }}>✎</button>
                      <button onClick={() => ask("¿Eliminar esta factura?", () => handleDelete(f.id))} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "#ccc", padding: "4px" }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      ) : (
        <>
          <h3 style={{ fontFamily: SF, fontSize: "20px", color: C.char, marginBottom: "24px" }}>{editId ? "Editar factura" : "Nueva factura"}</h3>
          <label style={lbl}>Proveedor</label>
          {isNewProv ? (
            <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del nuevo proveedor" style={{ ...inp, flex: 1, marginBottom: 0 }} autoFocus />
              <button onClick={() => { setIsNewProv(false); setProveedor(""); }} style={{ border: `1.5px solid ${C.brd}`, background: "none", color: C.mut, fontFamily: F, fontSize: "12px", padding: "0 12px", borderRadius: "10px", cursor: "pointer" }}>Lista</button>
            </div>
          ) : (
            <select value={proveedor} onChange={e => { if (e.target.value === "__new__") { setIsNewProv(true); setProveedor(""); } else setProveedor(e.target.value); }} style={{ ...inp, marginBottom: "16px", appearance: "auto" }}>
              <option value="">Seleccionar proveedor</option>
              {allProveedores.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__new__">+ Nuevo proveedor...</option>
            </select>
          )}
          <label style={lbl}>Importe (€)</label>
          <input type="number" inputMode="decimal" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0,00" style={{ ...inp, marginBottom: "16px" }} />
          <label style={lbl}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, marginBottom: "16px" }} />
          <label style={lbl}>Nota (opcional)</label>
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nº factura, observaciones..." style={{ ...inp, marginBottom: "28px" }} />
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { resetForm(); setModo("lista"); }} style={{ flex: 1, padding: "14px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", background: "transparent", fontFamily: F, fontSize: "14px", fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>
            <button onClick={handleSave} disabled={!proveedor || !importe || saving} style={{ flex: 2, padding: "14px", border: "none", borderRadius: "10px", background: (!proveedor || !importe || saving) ? "#D8D0C4" : C.char, color: (!proveedor || !importe || saving) ? "#A09888" : C.gold, fontFamily: SF, fontSize: "15px", cursor: (!proveedor || !importe || saving) ? "default" : "pointer" }}>{saving ? "Guardando..." : saved ? "✓ Guardado" : (editId ? "Actualizar" : "Guardar")}</button>
          </div>
        </>
      )}
    </div>
  );
}
