import { useState, useMemo, useEffect } from "react";
import { F, SF, C, inp, lbl, crd } from "../lib/styles.js";
import { fmt, fmt2, mkLabel, uid, pn } from "../lib/utils.js";
import { sb } from "../lib/supabase.js";
import { useConfirm } from "../hooks/useConfirm.jsx";

// #24 / #26: «Tarjeta» incluye las transferencias que mandamos nosotros; «Banco» = domiciliación o pago desde el banco
// #46: «Tarjeta / transferencia» y «Banco» eran lo mismo: ahora solo «Banco» (las facturas antiguas guardadas como «tarjeta» se tratan igual)
const TIPOS_PAGO = [["banco", "Banco"], ["efectivo", "Efectivo (caja)"], ["caja_fuerte", "Caja fuerte"]];
const pagoNorm = (t) => (t === "tarjeta" ? "banco" : t);
const TIPO_SOBRES = ["efectivo_sobres", "Efectivo sobres"]; // #14: solo los socios
const ESTILO_PAGO = { tarjeta: ["#E6F2F2", "#1F6262"], efectivo: ["#EAF3EC", "#2E7D4F"], caja_fuerte: ["#F3E9D6", "#6A4A08"], efectivo_sobres: ["#EDE4F5", "#5A3A7A"], banco: ["#E6F2F2", "#1F6262"] };
const NARANJA = ["#FDEBD3", "#9A4A00", "#E8913A"]; // fondo, texto, borde: factura pendiente de importe
const etiquetaPago = (t) => (t === "tarjeta" ? "Banco" : t === "efectivo" ? "Efectivo" : t === "caja_fuerte" ? "Caja fuerte" : t === "efectivo_sobres" ? "Efectivo sobres" : t === "banco" ? "Banco" : "");
// mismo proveedor aunque cambien mayúsculas, tildes o guiones («COCA COLA» = «Coca-Cola»)
const claveProv = (t) => String(t ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// «108,29», «1.108,29» y «108.29» valen lo mismo; acepta negativos (abonos)
const importeNum = (v) => { let t = String(v ?? "").trim().replace(/\s/g, "").replace(/[−–]/g, "-"); if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); const n = Number(t); return t !== "" && Number.isFinite(n) ? n : NaN; };
const sumaImportes = (fs) => fs.reduce((s, f) => s + (Number(f.importe) || 0), 0);

export function WorkerView({ facturas, proveedores, onReload, user }) {
  const [modo, setModo] = useState("lista");
  const [editId, setEditId] = useState(null);
  const [proveedor, setProveedor] = useState("");
  const [importe, setImporte] = useState("");
  const [tipoPago, setTipoPago] = useState("efectivo");
  const [lista, setLista] = useState(null); // proveedores de recepción + otros gastos (#24)
  const [pagoDefecto, setPagoDefecto] = useState({}); // #26
  const [nombres, setNombres] = useState({}); // dirección: quién estaba en el turno
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [nota, setNota] = useState("");
  const [numero, setNumero] = useState(""); // #50: número de factura (doc_numero)
  const [modoPago, setModoPago] = useState({}); // proveedor → transferencia | domiciliacion
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isNewProv, setIsNewProv] = useState(false);
  const { ask, Dialog } = useConfirm();

  const isAdmin = user?.rol === "admin";

  useEffect(() => {
    sb.rpc("facturas_proveedores_lista").then((r) => setLista(Array.isArray(r) ? r : null)).catch(() => setLista(null));
    sb.select("proveedor_pago_defecto", "select=nombre,pago,modo").then((r) => { setPagoDefecto(Object.fromEntries((r || []).map((x) => [claveProv(x.nombre), x.pago]))); setModoPago(Object.fromEntries((r || []).map((x) => [claveProv(x.nombre), x.modo]))); }).catch(() => {});
    if (isAdmin) sb.select("usuarios", "select=id,nombre").then((r) => setNombres(Object.fromEntries((r || []).map((u) => [u.id, (u.nombre || "").split(" ")[0]])))).catch(() => {});
  }, [isAdmin]);

  const hoy = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const resetForm = () => { setProveedor(""); setImporte(""); setTipoPago("efectivo"); setFecha(hoy()); setNota(""); setNumero(""); setEditId(null); setIsNewProv(false); };

  // Lista para «Añadir factura»: los de recepción + los de otros gastos, sin repetir el mismo proveedor escrito de dos formas
  const allProveedores = useMemo(() => {
    const vistos = new Set(); const out = [];
    for (const p of [...(lista || []), ...proveedores, ...(lista ? [] : facturas.map(f => f.proveedor))]) {
      const k = claveProv(p); if (!k || vistos.has(k)) continue; vistos.add(k); out.push(p);
    }
    return out.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }, [lista, facturas, proveedores]);

  // #26: al elegir proveedor, su forma de pago predefinida (se puede cambiar)
  const elegirProveedor = (p) => { setProveedor(p); const d = pagoDefecto[claveProv(p)]; if (d && !editId) setTipoPago(pagoNorm(d)); };

  const guardar = async (amt) => {
    setSaving(true);
    try {
      const payload = { proveedor: proveedor.trim(), importe: amt, tipo_pago: tipoPago, fecha, nota: nota.trim() || null, doc_numero: numero.trim() || null };
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

  // #50: pagada por banco a un proveedor de transferencia → el número de factura es obligatorio
  const numeroObligatorio = pagoNorm(tipoPago) === "banco" && modoPago[claveProv(proveedor)] === "transferencia";
  const handleSave = () => {
    const amt = Math.round(importeNum(importe) * 100) / 100;
    if (!proveedor.trim() || !Number.isFinite(amt) || amt === 0) return;
    if (numeroObligatorio && !numero.trim()) { alert("Pon el número de factura: dirección lo necesita para la transferencia."); return; }
    // #24: aviso si ya entró por la recepción de pedidos (mismo proveedor, día e importe)
    const dup = !editId && facturas.find(f => f.recepcion_id && claveProv(f.proveedor) === claveProv(proveedor) && f.fecha === fecha && f.importe != null && Math.abs(Number(f.importe) - amt) < 0.005);
    if (dup) { ask("Esta factura ya se registró en la recepción de pedidos. ¿Quieres apuntarla otra vez?", () => guardar(amt)); return; }
    guardar(amt);
  };

  const verDoc = async (f) => {
    const w = window.open("", "_blank");
    try {
      const r = await sb.fn("recepcion", { accion: "abrir", id: f.recepcion_id });
      const url = r?.recepcion?.doc_url || r?.recepcion?.foto_url;
      if (!url) throw new Error("no hay foto ni PDF");
      if (w) w.location = url; else window.location.href = url;
    }
    catch (e) { if (w) w.close(); alert("No se puede abrir el documento: " + e.message); }
  };

  const startEdit = (f) => { setEditId(f.id); setProveedor(f.proveedor); setImporte(f.importe == null ? "" : String(f.importe).replace(".", ",")); setTipoPago(pagoNorm(f.tipo_pago) || "efectivo"); setFecha(f.fecha); setNota(f.nota || ""); setNumero(f.doc_numero || ""); setModo("form"); };

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
                  <span style={{ fontFamily: F, fontSize: "13px", fontWeight: 700, color: C.mut }}>{fmt(sumaImportes(items))}{items.some(f => f.importe == null) ? " + pendientes" : ""}</span>
                </div>
                {items.map(f => {
                  const canEdit = isAdmin || (!!user && f.creado_por_id === user.id);
                  const pendiente = f.importe == null;
                  return (
                  <div key={f.id} style={{ ...crd, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", ...(pendiente ? { background: NARANJA[0], border: `1.5px solid ${NARANJA[2]}` } : {}) }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: F, fontSize: "14px", fontWeight: 600, color: C.char, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.proveedor}</div>
                      <div style={{ fontFamily: F, fontSize: "12px", color: C.mut, marginTop: "3px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span>{new Date(f.fecha).toLocaleDateString("es-ES")}</span>
                        {f.turno && <span style={{ textTransform: "capitalize" }}>· {f.turno}{isAdmin && f.trabajadora_id && nombres[f.trabajadora_id] ? ` (${nombres[f.trabajadora_id]})` : ""}</span>}
                        {f.recepcion_id && <span style={{ fontSize: "11px", fontWeight: 600, padding: "1px 7px", borderRadius: "999px", background: "#F0ECE2", color: "#5E5444" }}>Recepción</span>}
                        {f.tipo_pago && <span style={{ fontSize: "11px", fontWeight: 600, padding: "1px 7px", borderRadius: "999px", background: (ESTILO_PAGO[f.tipo_pago] || ESTILO_PAGO.efectivo)[0], color: (ESTILO_PAGO[f.tipo_pago] || ESTILO_PAGO.efectivo)[1] }}>{etiquetaPago(f.tipo_pago)}</span>}
                        {f.doc_numero && <span>· {f.doc_numero}</span>}
                        {f.doc_numero && f.recepcion_id && /^[A-Z0-9]{3}\d{6}(-\d+)?$/.test(f.doc_numero) && <span style={{ fontSize: "11px", fontWeight: 600, padding: "1px 7px", borderRadius: "999px", background: "#F0ECE2", color: "#5E5444" }}>código interno</span>}
                        {f.nota && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {f.nota}</span>}
                        {!canEdit && <span style={{ fontStyle: "italic", color: C.mutL }}>· de otra persona</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "10px" }}>
                      {f.doc_path && f.recepcion_id && <button onClick={() => verDoc(f)} title="Ver la factura" aria-label="Ver la factura" style={{ border: "none", background: "none", cursor: "pointer", fontSize: "15px", color: C.mut, padding: "4px" }}>📄</button>}
                      {pendiente
                        ? <span style={{ fontFamily: F, fontSize: "12px", fontWeight: 700, color: NARANJA[1], textAlign: "right", lineHeight: 1.2 }}>Pendiente<br />de importe</span>
                        : <span style={{ fontFamily: F, fontSize: "15px", fontWeight: 700, color: Number(f.importe) < 0 ? C.grn : C.char }}>{fmt2(f.importe)}</span>}
                      {canEdit && <>
                        <button onClick={() => startEdit(f)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "14px", color: C.mut, padding: "4px" }}>✎</button>
                        <button onClick={() => ask("¿Eliminar esta factura?", () => handleDelete(f.id))} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "18px", color: "#ccc", padding: "4px" }}>×</button>
                      </>}
                    </div>
                  </div>
                  );
                })}
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
            <select value={proveedor} onChange={e => { if (e.target.value === "__new__") { setIsNewProv(true); setProveedor(""); } else elegirProveedor(e.target.value); }} style={{ ...inp, marginBottom: "16px", appearance: "auto" }}>
              <option value="">Seleccionar proveedor</option>
              {proveedor && !allProveedores.includes(proveedor) && <option value={proveedor}>{proveedor}</option>}
              {allProveedores.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__new__">+ Nuevo proveedor...</option>
            </select>
          )}
          <label style={lbl}>Importe total a pagar, con IVA (€)</label>
          <input inputMode="decimal" value={importe} onChange={e => setImporte(e.target.value)} placeholder={editId && !importe ? "Pendiente de importe" : "0,00"} style={{ ...inp, marginBottom: "4px", ...(editId && !importe ? { borderColor: NARANJA[2], background: NARANJA[0] } : {}) }} />
          <div style={{ fontFamily: F, fontSize: "11.5px", color: C.mut, marginBottom: "8px" }}>Abonos o devoluciones en negativo (por ejemplo −12,50).</div>
          <div style={{ fontFamily: F, fontSize: "12.5px", color: "#6A4A08", background: "#FBF0DA", borderRadius: "10px", padding: "9px 12px", marginBottom: "16px", lineHeight: 1.4 }}>¿Es una inversión (maquinaria, mobiliario, obras, decoración…)? No la metas aquí: dirección la apunta en Finanzas → Inversiones.</div>
          <label style={lbl}>Tipo de pago</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: tipoPago === "caja_fuerte" || tipoPago === "efectivo_sobres" ? "8px" : "16px" }}>
            {(user?.es_socio ? [...TIPOS_PAGO, TIPO_SOBRES] : TIPOS_PAGO).map(([val, label]) => {
              const on = tipoPago === val;
              return <button key={val} onClick={() => setTipoPago(val)} style={{ flex: 1, minWidth: "40%", padding: "13px 6px", borderRadius: "10px", cursor: "pointer", fontFamily: F, fontSize: "14px", fontWeight: 700, border: on ? `2px solid ${C.char}` : `1.5px solid ${C.brd}`, background: on ? C.char : "#fff", color: on ? C.gold : C.mut }}>{label}</button>;
            })}
          </div>
          {tipoPago === "efectivo_sobres" && <div style={{ fontFamily: F, fontSize: "12.5px", color: "#5A3A7A", background: "#F3EDF8", borderRadius: "10px", padding: "9px 12px", marginBottom: "16px", lineHeight: 1.4 }}>Compra suelta o reparación pagada con el efectivo de los sobres: sale sola en Finanzas → Efectivo de sobres.</div>}
          {tipoPago === "banco" && <div style={{ fontFamily: F, fontSize: "12.5px", color: "#1F6262", background: "#E6F2F2", borderRadius: "10px", padding: "9px 12px", marginBottom: "16px", lineHeight: 1.4 }}>Se paga desde el banco (transferencia o domiciliación): no sale dinero de la tienda.</div>}
          {tipoPago === "caja_fuerte" && <div style={{ fontFamily: F, fontSize: "12.5px", color: "#6A4A08", background: "#FBF0DA", borderRadius: "10px", padding: "9px 12px", marginBottom: "16px", lineHeight: 1.4 }}>Este dinero sale de la caja fuerte: no sale de la caja registradora ni va al sobre del cierre.</div>}
          {!editId && <div style={{ fontFamily: F, fontSize: "11.5px", color: C.mut, marginTop: "-8px", marginBottom: "16px" }}>El turno se apunta solo por la hora a la que la guardas.</div>}
          <label style={lbl}>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, marginBottom: "16px" }} />
          <label style={lbl}>Número de factura{numeroObligatorio ? "" : " (opcional)"}</label>
          <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Tal cual sale en la factura" style={{ ...inp, marginBottom: numeroObligatorio ? "4px" : "16px", ...(numeroObligatorio && !numero.trim() ? { borderColor: NARANJA[2], background: NARANJA[0] } : {}) }} />
          {numeroObligatorio && <div style={{ fontFamily: F, fontSize: "11.5px", color: C.mut, marginBottom: "16px" }}>Obligatorio: este proveedor se paga por transferencia y dirección pone el número en el concepto.</div>}
          <label style={lbl}>Nota (opcional)</label>
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Observaciones..." style={{ ...inp, marginBottom: "28px" }} />
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { resetForm(); setModo("lista"); }} style={{ flex: 1, padding: "14px", border: `1.5px solid ${C.brd}`, borderRadius: "10px", background: "transparent", fontFamily: F, fontSize: "14px", fontWeight: 600, color: C.mut, cursor: "pointer" }}>Cancelar</button>
            <button onClick={handleSave} disabled={!proveedor || !importe || saving} style={{ flex: 2, padding: "14px", border: "none", borderRadius: "10px", background: (!proveedor || !importe || saving) ? "#D8D0C4" : C.char, color: (!proveedor || !importe || saving) ? "#A09888" : C.gold, fontFamily: SF, fontSize: "15px", cursor: (!proveedor || !importe || saving) ? "default" : "pointer" }}>{saving ? "Guardando..." : saved ? "✓ Guardado" : (editId ? "Actualizar" : "Guardar")}</button>
          </div>
        </>
      )}
    </div>
  );
}
