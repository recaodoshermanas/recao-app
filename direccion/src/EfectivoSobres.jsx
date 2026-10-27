// Finanzas → Efectivo de sobres (solicitud #14): a dónde va el efectivo de los sobres. Solo los 4 socios.
// Entrada del mes = lo contado al abrir los sobres del mes anterior (se abren el día 1 de este mes).
// Salidas: reparto a socios, extras a trabajadoras, ingresos al banco, reposición de la caja fuerte y compras con «Efectivo sobres» (desde Facturas).
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../src/lib/supabase.js";
import { Panel, avisar, hoyStr, fechaCorta, Cargando } from "./ui.jsx";
import { eur, mesAnio } from "./fmt.js";
import { ExtrasSobres } from "../../src/views/owner/ExtrasSobres.jsx"; // #17
import { useCambioEfectivo, avisarCambioEfectivo, EfectivoVivo } from "./finanzas/EfectivoVivo.jsx"; // #84

const TIPOS = {
  reparto: { label: "Reparto", chip: "rep" }, extra: { label: "Extra", chip: "ext" }, compra: { label: "Compra", chip: "com" },
  banco: { label: "Banco", chip: "ban" }, caja_fuerte: { label: "Caja fuerte", chip: "cf" }, inversion: { label: "Inversión", chip: "rep" }, mantenimiento: { label: "Mantenimiento", chip: "cf" },
};
const numero = (v) => { const s = String(v ?? "").trim().replace(/\s/g, ""); const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; const x = Number(t); return t !== "" && /^\d+(\.\d{1,2})?$/.test(t) && Number.isFinite(x) ? x : NaN; };
const masMes = (m, n) => { const d = new Date(`${m}-15T12:00:00`); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const diaDelMes = (mes) => { const hoy = hoyStr(); return hoy.slice(0, 7) === mes ? hoy : `${mes}-01`; };

export function EfectivoSobres() {
  const [mes, setMes] = useState(hoyStr().slice(0, 7));
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(null);
  const [panel, setPanel] = useState(null); // {tipo} | {editar: salida} | {config:true} | {partida:true}
  const [evo, setEvo] = useState(null);
  const cargarEvo = useCallback(() => { sb.rpc("efectivo_evolucion").then(setEvo).catch(() => setEvo([])); }, []);
  useEffect(() => { cargarEvo(); }, [cargarEvo, d?.saldo]);
  const cargar = useCallback(async () => {
    setD(null);
    try { setD(await sb.rpc("efectivo_sobres_mes", { p_mes: mes })); setFallo(null); }
    catch (e) { setFallo(/socios/i.test(e.message || "") ? "socios" : "error"); }
  }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);
  const refrescar = useCallback(async () => { try { setD(await sb.rpc("efectivo_sobres_mes", { p_mes: mes })); } catch (e) { /* se ve al recargar */ } }, [mes]);
  useCambioEfectivo(refrescar); // #84: recargas de la caja fuerte y retiradas del banco cambian el saldo

  if (fallo === "socios") return <div className="card"><h2>Efectivo de sobres</h2><p className="empty">Esta sección es solo para los socios.</p></div>;
  if (fallo) return <div className="card"><h2>Efectivo de sobres</h2><p className="empty">No se ha podido cargar.</p></div>;
  if (!d) return <div className="card"><Cargando /></div>;

  const saldo = Number(d.saldo);
  const pt = d.por_tipo || {};
  const listo = (r) => { setD(r); setPanel(null); avisarCambioEfectivo(); };
  const otras = d.entradas_otras || [];
  const sp = d.saldo_partida; // solo en octubre de 2026
  return (
    <>
      <EfectivoVivo />
      <div className="card es">
        <div className="head">
          <div><h2>Efectivo de sobres · {mesAnio(`${mes}-01`)}</h2><p className="sub">Lo que entra de los sobres y en qué se va. Solo lo veis los socios.</p></div>
          <div className="nav-sem">
            <button className="btn-l" onClick={() => setMes(masMes(mes, -1))} aria-label="Mes anterior">‹</button>
            {mes !== hoyStr().slice(0, 7) && <button className="btn-l" onClick={() => setMes(hoyStr().slice(0, 7))}>Este mes</button>}
            <button className="btn-l" onClick={() => setMes(masMes(mes, 1))} aria-label="Mes siguiente">›</button>
          </div>
        </div>
        {!d.apertura_registrada && <p className="es-aviso">Falta registrar la apertura de los sobres de {mesAnio(`${d.mes_sobres}-01`).toLowerCase()} (Cierre de mes → Apertura de sobres). Hasta entonces la entrada cuenta 0 €.</p>}
        {saldo < 0 && <p className="es-rojo">Se ha registrado más salida que efectivo: el saldo está en negativo.</p>}
        <div className="es-kpis">
          {sp ? (
            <div><small>Saldo de partida</small><b>{sp.registrado ? eur(sp.importe, 2) : "Sin poner"}</b>
              <span>{sp.registrado ? `Efectivo guardado a 1 de octubre${sp.nota ? ` · ${sp.nota}` : ""}${sp.quien ? ` · ${sp.quien}` : ""}` : "El efectivo que ya se tenía guardado de meses anteriores"}</span>
              <button className="btn-l" onClick={() => setPanel({ partida: true })}>{sp.registrado ? "Corregir saldo de partida" : "Poner saldo de partida"}</button></div>
          ) : (
            <div><small>Saldo inicial</small><b>{eur(d.saldo_inicial, 2)}</b><span>Lo que quedó del mes anterior</span></div>
          )}
          <div><small>{sp ? "Sobres de septiembre" : "Entrada"}</small><b>{eur(d.entrada, 2)}</b><span>Sobres de {mesAnio(`${d.mes_sobres}-01`).toLowerCase()}, abiertos el día 1{sp ? " (se meten en Cierre de mes → Apertura de sobres)" : ""}</span></div>
          {Number(d.otras_entradas) > 0 && <div><small>Otras entradas</small><b>{eur(d.otras_entradas, 2)}</b><span>Retiradas del banco que fueron a efectivo guardado (se asignan en Caja)</span></div>}
          <div><small>Salidas</small><b>{eur(d.total_salidas, 2)}</b><span>{d.salidas.length} movimiento{d.salidas.length === 1 ? "" : "s"}</span></div>
          <div className={`es-saldo${saldo < 0 ? " neg" : ""}`}><small>Queda guardado</small><b>{eur(saldo, 2)}</b></div>
        </div>
        <div className="es-acciones">
          <button className="btn-p" onClick={() => setPanel({ tipo: "reparto" })}>{d.reparto_hecho ? "Registrar otro reparto" : "Registrar reparto"}</button>
          <button className="btn-l" onClick={() => setPanel({ tipo: "extra" })}>+ Extra a trabajadora</button>
          <button className="btn-l" onClick={() => setPanel({ tipo: "banco" })}>+ Ingreso al banco</button>
          <button className="btn-txt" onClick={() => setPanel({ config: true })}>Importes del reparto</button>
        </div>
        <p className="sub">Las compras sueltas y reparaciones se apuntan en Facturas → Nueva factura con el tipo de pago «Efectivo sobres» y salen aquí solas. Lo que va a la caja fuerte se apunta en Caja → «Añadir dinero a caja» y sale aquí solo.</p>
        {otras.length > 0 && (
          <div className="tabla-scroll" style={{ marginBottom: 12 }}>
            <table className="ranking es-tabla">
              <thead><tr><th>Día</th><th>Otras entradas</th><th>Apuntado por</th><th className="r">Importe</th><th></th></tr></thead>
              <tbody>{otras.map((o) => (
                <tr key={o.id}><td>{fechaCorta(o.fecha)}</td><td><span className="es-chip ban">Retirada del banco</span> {o.concepto}{o.nota ? <span className="pf">{o.nota}</span> : null}</td><td>{o.quien || "—"}</td>
                  <td className="r b">+{eur(o.importe, 2)}</td><td className="r"><span className="pf">Se cambia en Caja → «Retiradas del banco»</span></td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div style={{ border: "1px solid var(--line, #EBE3D5)", borderRadius: 14, padding: "14px 16px", margin: "10px 0 14px" }}><ExtrasSobres mes={d.mes_sobres} onCambio={refrescar} /></div>
        {d.salidas.length === 0 ? <p className="empty">Sin salidas este mes.</p> : (
          <div className="tabla-scroll">
            <table className="ranking es-tabla">
              <thead><tr><th>Día</th><th>Tipo</th><th>Concepto</th><th>Apuntado por</th><th className="r">Importe</th><th></th></tr></thead>
              <tbody>
                {d.salidas.map((s) => (
                  <tr key={`${s.origen}-${s.id}`}>
                    <td>{fechaCorta(s.fecha)}</td>
                    <td><span className={`es-chip ${TIPOS[s.tipo]?.chip || ""}`}>{TIPOS[s.tipo]?.label || s.tipo}</span></td>
                    <td>{s.tipo === "reparto" ? s.persona : s.tipo === "extra" ? <>{s.persona}{s.concepto ? <span className="pf">{s.concepto}</span> : null}</> : s.tipo === "banco" ? `${s.banco}${s.concepto ? ` · ${s.concepto}` : ""}` : (s.concepto || "—")}{s.cambios > 0 && <span className="pf">Corregido</span>}</td>
                    <td>{s.quien || "—"}</td>
                    <td className="r b">−{eur(s.importe, 2)}</td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>{s.origen === "factura" ? <span className="pf">Se corrige en la factura</span> : s.origen === "extras" ? <span className="pf">Se cambia en «Extras de trabajadoras»</span> : s.origen === "inversion" ? <span className="pf">Se cambia en «Inversiones»</span> : s.origen === "mantenimiento" ? <span className="pf">Se cambia en «Mantenimiento»</span> : s.origen === "recarga" ? <span className="pf">Se cambia en Caja</span> : <button className="btn-l" onClick={() => setPanel({ editar: s })}>Corregir</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {Object.keys(pt).length > 0 && (
          <p className="sub es-resumen">{Object.entries(pt).map(([k, v]) => `${TIPOS[k]?.label || k}: ${eur(v, 2)}`).join(" · ")}</p>
        )}
      </div>
      {panel?.partida && <PanelPartida sp={sp} onClose={() => setPanel(null)} onListo={listo} />}
      <Evolucion evo={evo} mes={mes} onAbrir={setMes} />
      {panel?.tipo === "reparto" && <PanelReparto d={d} mes={mes} onClose={() => setPanel(null)} onListo={listo} />}
      {panel?.tipo && panel.tipo !== "reparto" && <PanelSalida tipo={panel.tipo} d={d} mes={mes} onClose={() => setPanel(null)} onListo={listo} />}
      {panel?.editar && <PanelCorregir s={panel.editar} d={d} onClose={() => setPanel(null)} onListo={(r) => { setPanel(null); if (r?.mes === mes) setD(r); else cargar(); }} />}
      {panel?.config && <PanelConfig d={d} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
    </>
  );
}

function PanelPartida({ sp, onClose, onListo }) {
  const [imp, setImp] = useState(sp?.registrado ? String(sp.importe).replace(".", ",") : "");
  const [nota, setNota] = useState(sp?.nota || "");
  const [busy, setBusy] = useState(false);
  const x = imp === "0" ? 0 : numero(imp);
  const guardar = async () => {
    setBusy(true);
    try { onListo(await sb.rpc("efectivo_saldo_partida_guardar", { p_importe: x, p_nota: nota })); avisar("Saldo de partida guardado"); }
    catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Saldo de partida" sub="El efectivo del negocio que ya tenías guardado de meses anteriores, a 1 de octubre de 2026. Queda registro de quién y cuándo." onClose={onClose} ancho="440px"
      pie={<button className="btn-p" disabled={busy || !Number.isFinite(x)} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>}>
      <label className="campo">Importe (€)<input inputMode="decimal" value={imp} onChange={(e) => setImp(e.target.value)} placeholder="0,00" autoFocus /></label>
      {imp && !Number.isFinite(x) && <p className="es-rojo" style={{ marginTop: 0 }}>Pon un importe válido, con 2 decimales como mucho.</p>}
      <label className="campo">Nota (opcional)<input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: contado en casa el 30/9" /></label>
    </Panel>
  );
}

function Evolucion({ evo, mes, onAbrir }) {
  if (!evo || evo.length === 0) return null;
  const W = 640, H = 150, P = 28;
  const vals = evo.map((m) => Number(m.saldo));
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
  const x = (i) => (evo.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (evo.length - 1));
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const pts = evo.map((m, i) => `${x(i)},${y(Number(m.saldo))}`).join(" ");
  const tipos = Object.keys(TIPOS).filter((t) => evo.some((m) => Number(m.por_tipo?.[t]) > 0));
  return (
    <div className="card es">
      <div className="head"><div><h2>Evolución</h2><p className="sub">Cómo cambia el efectivo guardado mes a mes. Pulsa un mes para abrirlo arriba.</p></div></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Queda guardado de cada mes" style={{ width: "100%", maxHeight: 190 }}>
        <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity=".2" />
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" />
        {evo.map((m, i) => (
          <g key={m.mes}>
            <circle cx={x(i)} cy={y(Number(m.saldo))} r="4" fill="currentColor" />
            <text x={x(i)} y={y(Number(m.saldo)) - 9} textAnchor="middle" fontSize="11" fill="currentColor">{eur(m.saldo, 0)}</text>
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity=".7">{m.mes.slice(5)}/{m.mes.slice(2, 4)}</text>
          </g>
        ))}
      </svg>
      <div className="tabla-scroll">
        <table className="ranking es-tabla">
          <thead><tr><th>Mes</th><th className="r">Saldo inicial</th><th className="r">Entrada de sobres</th><th className="r">Otras entradas</th>{tipos.map((t) => <th key={t} className="r">{TIPOS[t].label}</th>)}<th className="r">Queda guardado</th></tr></thead>
          <tbody>
            {evo.map((m) => (
              <tr key={m.mes} onClick={() => { onAbrir(m.mes); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ cursor: "pointer", fontWeight: m.mes === mes ? 700 : undefined }}>
                <td>{mesAnio(`${m.mes}-01`)}{m.en_curso && <span className="pf">en curso</span>}</td>
                <td className="r">{eur(m.saldo_inicial, 2)}</td>
                <td className="r">{eur(m.entrada, 2)}</td>
                <td className="r">{eur(m.otras_entradas, 2)}</td>
                {tipos.map((t) => <td key={t} className="r">{Number(m.por_tipo?.[t]) > 0 ? `−${eur(m.por_tipo[t], 2)}` : "–"}</td>)}
                <td className="r b">{eur(m.saldo, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PanelReparto({ d, mes, onClose, onListo }) {
  const [fecha, setFecha] = useState(diaDelMes(mes));
  const [imp, setImp] = useState(() => Object.fromEntries(d.socios.map((s) => [s.id, String(s.importe).replace(".", ",")])));
  const [busy, setBusy] = useState(false);
  const vals = d.socios.map((s) => ({ id: s.id, importe: imp[s.id] === "" ? 0 : numero(imp[s.id]) }));
  const ok = vals.every((v) => Number.isFinite(v.importe)) && vals.some((v) => v.importe > 0) && fecha;
  const total = vals.reduce((t, v) => t + (Number.isFinite(v.importe) ? v.importe : 0), 0);
  const guardar = async () => {
    setBusy(true);
    try { onListo(await sb.rpc("efectivo_registrar", { p: { tipo: "reparto", fecha, socios: vals } })); avisar("Reparto registrado"); }
    catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Registrar reparto" sub="Una salida por socio. Puedes cambiar cada importe antes de confirmar." onClose={onClose} ancho="460px"
      pie={<button className="btn-p" disabled={busy || !ok} onClick={guardar}>{busy ? "Guardando…" : `Confirmar ${eur(total, 2)}`}</button>}>
      {d.reparto_hecho && <p className="es-aviso">Este mes ya hay un reparto registrado. Si confirmas, se añade otro.</p>}
      <label className="campo">Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      {d.socios.map((s) => (
        <label key={s.id} className="campo es-fila">{s.nombre}<input inputMode="decimal" value={imp[s.id]} onChange={(e) => setImp({ ...imp, [s.id]: e.target.value })} /></label>
      ))}
      <p className="sub">Si un socio no cobra este mes, deja su importe a 0.</p>
    </Panel>
  );
}

const TITULOS = { extra: "Extra a trabajadora", banco: "Ingreso al banco", caja_fuerte: "Reposición de la caja fuerte" };
function PanelSalida({ tipo, d, mes, onClose, onListo }) {
  const [f, setF] = useState({ fecha: diaDelMes(mes), importe: "", concepto: "", trabajadora_id: "", banco: "" });
  const [busy, setBusy] = useState(false);
  const x = numero(f.importe);
  const ok = f.fecha && x > 0 && (tipo !== "extra" || (f.trabajadora_id && f.concepto.trim())) && (tipo !== "banco" || f.banco);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async () => {
    setBusy(true);
    try { onListo(await sb.rpc("efectivo_registrar", { p: { tipo, fecha: f.fecha, importe: x, concepto: f.concepto, trabajadora_id: f.trabajadora_id || null, banco: f.banco || null } })); avisar("Salida registrada"); }
    catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo={TITULOS[tipo]} sub={tipo === "extra" ? "Cuenta como gasto de personal en la Cuenta de resultados del mes en que se paga" : "No es gasto: no sale en la Cuenta de resultados"} onClose={onClose} ancho="440px"
      pie={<button className="btn-p" disabled={busy || !ok} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>}>
      {tipo === "extra" && <label className="campo">Trabajadora<select value={f.trabajadora_id} onChange={set("trabajadora_id")}><option value="">Elegir…</option>{d.trabajadoras.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>}
      {tipo === "banco" && (
        <div className="campo-t"><span>Banco</span><div className="seg">{["BBVA", "La Caixa"].map((b) => <button key={b} aria-pressed={f.banco === b} onClick={() => setF({ ...f, banco: b })}>{b}</button>)}</div></div>
      )}
      <div className="fila-campos">
        <label className="campo">Fecha<input type="date" value={f.fecha} onChange={set("fecha")} /></label>
        <label className="campo">Importe (€)<input inputMode="decimal" value={f.importe} onChange={set("importe")} placeholder="0,00" autoFocus /></label>
      </div>
      {f.importe && !(x > 0) && <p className="es-rojo" style={{ marginTop: 0 }}>Pon un importe mayor que 0, con 2 decimales como mucho.</p>}
      <label className="campo">{tipo === "extra" ? "Concepto" : "Nota (opcional)"}<input value={f.concepto} maxLength={200} onChange={set("concepto")} placeholder={tipo === "extra" ? "Ej.: horas del inventario" : ""} /></label>
      <p className="sub">Queda guardado después: {eur(Number(d.saldo) - (x > 0 ? x : 0), 2)}{Number(d.saldo) - (x > 0 ? x : 0) < 0 ? " (en negativo)" : ""}</p>
    </Panel>
  );
}

function PanelCorregir({ s, d, onClose, onListo }) {
  const [f, setF] = useState({ fecha: s.fecha, importe: String(s.importe).replace(".", ","), concepto: s.concepto || "", banco: s.banco || "", trabajadora_id: s.trabajadora_id || "" });
  const [hist, setHist] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { sb.rpc("efectivo_historial", { p_id: Number(s.id) }).then(setHist).catch(() => setHist([])); }, [s.id]);
  const x = numero(f.importe);
  const ok = f.fecha && x > 0 && (s.tipo !== "extra" || f.trabajadora_id);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const guardar = async (quitar) => {
    if (quitar && !window.confirm(`¿Quitar esta salida de ${eur(s.importe, 2)}? El saldo subirá esa cantidad. Queda registrado.`)) return;
    setBusy(true);
    try {
      const cambios = { fecha: f.fecha, importe: x, concepto: s.tipo === "reparto" ? s.concepto : f.concepto };
      if (s.tipo === "banco") cambios.banco = f.banco;
      if (s.tipo === "extra") cambios.trabajadora_id = f.trabajadora_id;
      onListo(await sb.rpc("efectivo_corregir", { p_id: Number(s.id), p: cambios, p_quitar: !!quitar }));
      avisar(quitar ? "Salida quitada" : "Salida corregida");
    } catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo={`Corregir ${TIPOS[s.tipo]?.label.toLowerCase() || "salida"}`} sub={s.tipo === "reparto" ? s.persona : undefined} onClose={onClose} ancho="440px"
      pie={<><button className="btn-txt peligro" disabled={busy} onClick={() => guardar(true)}>Quitar</button><button className="btn-p" disabled={busy || !ok} onClick={() => guardar(false)}>{busy ? "Guardando…" : "Guardar"}</button></>}>
      {s.tipo === "extra" && <label className="campo">Trabajadora<select value={f.trabajadora_id} onChange={set("trabajadora_id")}>{d.trabajadoras.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>}
      {s.tipo === "banco" && <div className="campo-t"><span>Banco</span><div className="seg">{["BBVA", "La Caixa"].map((b) => <button key={b} aria-pressed={f.banco === b} onClick={() => setF({ ...f, banco: b })}>{b}</button>)}</div></div>}
      <div className="fila-campos">
        <label className="campo">Fecha<input type="date" value={f.fecha} onChange={set("fecha")} /></label>
        <label className="campo">Importe (€)<input inputMode="decimal" value={f.importe} onChange={set("importe")} /></label>
      </div>
      {s.tipo !== "reparto" && <label className="campo">Concepto<input value={f.concepto} maxLength={200} onChange={set("concepto")} /></label>}
      {hist && hist.length > 0 && (
        <div className="es-hist"><b>Cambios</b>{hist.map((h, i) => <div key={i}>{new Date(h.en).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {h.por || "—"}: {h.accion === "quitar" ? "la quitó" : `antes ${eur(h.antes?.importe, 2)} el ${fechaCorta(h.antes?.fecha)}`}</div>)}</div>
      )}
    </Panel>
  );
}

function PanelConfig({ d, onClose, onListo }) {
  const [imp, setImp] = useState(() => Object.fromEntries(d.socios.map((s) => [s.id, String(s.importe).replace(".", ",")])));
  const [busy, setBusy] = useState(false);
  const vals = d.socios.map((s) => ({ id: s.id, importe: imp[s.id] === "" ? 0 : numero(imp[s.id]) }));
  const ok = vals.every((v) => Number.isFinite(v.importe));
  const guardar = async () => {
    setBusy(true);
    try { await sb.rpc("reparto_config_guardar", { p: vals }); avisar("Importes guardados"); onListo(); }
    catch (e) { avisar(e.message || "No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo="Importes del reparto" sub="Lo que se propone a cada socio al pulsar «Registrar reparto»" onClose={onClose} ancho="420px"
      pie={<button className="btn-p" disabled={busy || !ok} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button>}>
      {d.socios.map((s) => <label key={s.id} className="campo es-fila">{s.nombre}<input inputMode="decimal" value={imp[s.id]} onChange={(e) => setImp({ ...imp, [s.id]: e.target.value })} /></label>)}
      <p className="sub">Total al mes: {eur(vals.reduce((t, v) => t + (Number.isFinite(v.importe) ? v.importe : 0), 0), 2)}</p>
    </Panel>
  );
}
