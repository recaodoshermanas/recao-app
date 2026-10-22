// Finanzas → Inversiones (solicitud #40): una única lista de inversiones con forma de pago y comprobación con el banco (BBVA).
// Las de «Efectivo sobres» salen solas como salida en Efectivo de los sobres. Nunca suman en la Cuenta de resultados.
// Todo pasa por las funciones inversion(es)_* (solo dirección). La foto del ticket o factura se guarda y se lee en inversiones-foto.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Panel, Pestanas, avisar, hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";

const fecha = (f) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const numero = (t) => { const s = String(t ?? "").trim().replace(/\s/g, ""); const v = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return s !== "" && Number.isFinite(v) ? v : NaN; };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
// Foto del móvil → JPEG reducido en base64 (las fotos pesan mucho)
function prepararFoto(file) {
  return new Promise((ok, mal) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 2200 / Math.max(img.width, img.height)); const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); ok({ mime: "image/jpeg", base64: cv.toDataURL("image/jpeg", 0.82).split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No puedo abrir esa foto")); };
    img.src = url;
  });
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const FORMAS = { efectivo_sobres: "Efectivo sobres", banco_bbva: "Banco (BBVA)", sin_indicar: "Sin indicar" };
const ESTADOS = {
  efectivo: { label: "Efectivo · sin banco", bg: "#EDE4F5", fg: "#5A3A7A" },
  pendiente: { label: "Pendiente de ver en el banco", bg: "#FBF0DA", fg: "#8A6410" },
  comprobada: { label: "Comprobada en banco", bg: "#E7F3EC", fg: "#1E7A46" },
  a_mano: { label: "Comprobada a mano", bg: "#E7F3EC", fg: "#1E7A46" },
  no_encontrada: { label: "No encontrada en el banco", bg: "#FBEAE7", fg: "#B23A2C" },
  anterior: { label: "Sin comprobar (anterior)", bg: "#F0ECE2", fg: "#5E5444" },
};

export function Inversiones() {
  const hoy = hoyStr();
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState("");
  const [tab, setTab] = useState("lista");
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => { try { setD(await sb.rpc("inversiones_datos")); setFallo(false); } catch (e) { setFallo(true); } }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const anios = useMemo(() => [...new Set([Number(hoy.slice(0, 4)), ...(d?.items || []).map((i) => Number(i.fecha.slice(0, 4)))])].sort((a, b) => b - a), [d, hoy]);
  const lista = useMemo(() => (d?.items || []).filter((i) => i.fecha.startsWith(String(anio)) && (!mes || i.fecha.slice(5, 7) === mes)), [d, anio, mes]);
  const totalAnio = useMemo(() => (d?.items || []).filter((i) => i.fecha.startsWith(String(anio))).reduce((s, i) => s + Number(i.importe), 0), [d, anio]);
  const totalLista = lista.reduce((s, i) => s + Number(i.importe), 0);

  const verFoto = async (i) => {
    const w = window.open("", "_blank");
    try { const r = await sb.fn("inversiones-foto", { accion: "ver", id: i.id }); if (w) w.location = r.url; else window.location.href = r.url; }
    catch (e) { if (w) w.close(); avisar(msg(e), "mal"); }
  };

  const accion = async (fn, params, ok) => {
    setBusy(true);
    try { await sb.rpc(fn, params); avisar(ok); await cargar(); } catch (e) { avisar(msg(e), "mal"); }
    setBusy(false);
  };

  if (fallo) return <div className="card"><h2>Inversiones</h2><p className="empty">No se ha podido cargar. Recarga la página en un momento.</p></div>;
  if (!d) return <div className="card"><Cargando /></div>;
  const nConf = d.por_confirmar.length;

  return (
    <>
      <div className="card">
        <div className="head" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h2>Inversiones</h2>
            <p className="sub">Compras que no son gasto del mes (maquinaria, mobiliario, obras…). Nunca suman en la Cuenta de resultados; salen en Cierre de mes, Tesorería y el resumen de Finanzas.</p>
          </div>
          <button className="btn-p" onClick={() => setPanel({ editar: { fecha: hoy, forma_pago: "" } })}>+ Nueva inversión</button>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "14px 0 6px", alignItems: "flex-end" }}>
          <div><div className="sub">Total invertido en {anio}</div><div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.01em" }}>{eur(totalAnio, 2)}</div></div>
          <div className="filtros-t" style={{ marginBottom: 0 }}>
            <label><span className="sr">Año</span><select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
            <label><span className="sr">Mes</span><select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos los meses</option>{MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m[0].toUpperCase() + m.slice(1)}</option>)}</select></label>
          </div>
        </div>
        <Pestanas valor={tab} onChange={setTab} etiqueta="Vista" opciones={[{ id: "lista", label: "Inversiones" }, { id: "confirmar", label: "Por confirmar", n: nConf }]} />
      </div>

      {tab === "lista" && (
        <div className="card" style={{ marginTop: 16 }}>
          {!lista.length ? <p className="empty">No hay inversiones con estos filtros.</p> : (
            <div className="tabla-scroll">
              <table className="ranking es-tabla">
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Forma de pago</th><th>Comprobación</th><th className="r">Importe</th><th></th></tr></thead>
                <tbody>
                  {lista.map((i) => {
                    const e = ESTADOS[i.estado] || ESTADOS.anterior;
                    return (
                      <tr key={i.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fecha(i.fecha)}</td>
                        <td>{i.concepto}{(i.proveedor && i.proveedor !== i.concepto) && <span className="pf">{i.proveedor}</span>}{i.nota && <span className="pf">{i.nota}</span>}{i.foto && <button className="btn-txt" onClick={() => verFoto(i)}>Ver foto</button>}</td>
                        <td>{FORMAS[i.forma_pago]}</td>
                        <td>
                          <span className="es-chip" style={{ background: e.bg, color: e.fg }}>{e.label}</span>
                          {i.mov && <span className="pf">{fecha(i.mov.fecha)} · {eur(i.mov.importe, 2)} · {i.mov.contraparte || i.mov.concepto}</span>}
                          {i.nota_comprobacion && <span className="pf">{i.nota_comprobacion}</span>}
                        </td>
                        <td className="r b">{eur(i.importe, 2)}</td>
                        <td className="r" style={{ whiteSpace: "nowrap" }}>
                          {i.estado === "no_encontrada" && <button className="btn-l" disabled={busy} onClick={() => setPanel({ enlazar: i })}>Enlazar</button>}
                          <button className="btn-txt" disabled={busy} onClick={() => setPanel({ editar: i })}>Editar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr><td colSpan={4}><b>Total de la lista</b></td><td className="r b">{eur(totalLista, 2)}</td><td></td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "confirmar" && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="sub">Salidas de BBVA que podrían ser el pago de una inversión pero no se marcan solas: o hay más de una opción, o no cuadran al céntimo (margen de {eur(d.margen, 2)}). Tú decides.</p>
          {!nConf ? <p className="empty">No hay nada por confirmar.</p> : d.por_confirmar.map((p) => (
            <div key={p.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px", margin: "12px 0" }}>
              <strong>{p.concepto} · {eur(p.importe, 2)}</strong> <span className="pf" style={{ display: "inline" }}>del {fecha(p.fecha)}</span>
              {p.opciones.map((o) => (
                <div key={o.mov.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", borderTop: "1px dashed var(--line)", marginTop: 10, paddingTop: 10 }}>
                  <div>
                    <div>Salida de {eur(o.mov.importe, 2)} · {fecha(o.mov.fecha)}</div>
                    <span className="pf">{o.mov.contraparte || o.mov.concepto}</span>
                    <span className="pf" style={{ color: Number(o.dif) === 0 ? undefined : "var(--down)", fontWeight: Number(o.dif) === 0 ? 500 : 700 }}>
                      {Number(o.dif) === 0 ? "Cuadra exacto" : `Diferencia ${eur(Math.abs(o.dif), 2)} (${o.dif > 0 ? "salió de más" : "salió de menos"})`}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-p" disabled={busy} onClick={() => accion("inversion_confirmar", { p_inv: p.id, p_mov: o.mov.id }, "Inversión comprobada")}>Confirmar</button>
                    <button className="btn-txt" disabled={busy} onClick={() => accion("inversion_descartar", { p_inv: p.id, p_mov: o.mov.id }, "Propuesta descartada")}>No es esta</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {panel?.editar && <PanelInversion inv={panel.editar} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
      {panel?.enlazar && <PanelEnlazar inv={panel.enlazar} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
    </>
  );
}

function PanelInversion({ inv, onClose, onListo }) {
  const nueva = !inv.id;
  const [f, setF] = useState({ fecha: inv.fecha || hoyStr(), concepto: inv.concepto || "", importe: inv.importe != null ? String(inv.importe).replace(".", ",") : "", forma_pago: inv.forma_pago === "sin_indicar" ? "" : inv.forma_pago || "", proveedor: inv.proveedor || "", nota: inv.nota || "" });
  const [provs, setProvs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [fotoPath, setFotoPath] = useState(null); // foto nueva subida en este panel
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState("");
  const input = useRef(null);
  useEffect(() => { sb.rpc("facturas_proveedores_lista").then((r) => setProvs(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  const x = numero(f.importe);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.fecha && f.concepto.trim() && x > 0 && f.forma_pago;
  const cambiaComprobacion = !nueva && (Number(inv.importe) !== x || inv.fecha !== f.fecha || inv.forma_pago !== f.forma_pago) && ["comprobada", "a_mano", "no_encontrada", "pendiente"].includes(inv.estado);
  const elegirFoto = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    setLeyendo(true); setLectura("");
    try {
      const r = await sb.fn("inversiones-foto", { accion: "leer", foto: await prepararFoto(file) });
      setFotoPath(r.foto_path);
      const d = r.datos;
      if (d) {
        setF((a) => ({ ...a, fecha: d.fecha || a.fecha, concepto: d.concepto || a.concepto, importe: d.importe > 0 ? String(d.importe).replace(".", ",") : a.importe, proveedor: d.proveedor || a.proveedor }));
        setLectura("Foto guardada y datos leídos. Revisa fecha, concepto, importe y proveedor, y elige la forma de pago.");
      } else setLectura(`Foto guardada, pero no se han podido leer los datos${r.aviso ? ` (${r.aviso})` : ""}. Rellénalos a mano.`);
    } catch (er) { avisar(msg(er), "mal"); }
    setLeyendo(false);
  };
  const guardar = async () => {
    setBusy(true);
    try { await sb.rpc("inversion_guardar", { p: { id: inv.id || null, fecha: f.fecha, concepto: f.concepto, importe: x, forma_pago: f.forma_pago, proveedor: f.proveedor, nota: f.nota, ...(fotoPath ? { foto_path: fotoPath } : {}) } }); avisar("Guardado"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  const borrar = async () => {
    if (!window.confirm(`¿Borrar «${inv.concepto}»? Desaparece de Cierre de mes, Tesorería y el resumen de Finanzas.`)) return;
    setBusy(true);
    try { await sb.rpc("inversion_borrar", { p_id: inv.id }); avisar("Inversión borrada"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  return (
    <Panel titulo={nueva ? "Nueva inversión" : "Editar inversión"} onClose={onClose} ancho="440px"
      pie={<>{!nueva && <button className="btn-txt peligro" disabled={busy} onClick={borrar}>Borrar</button>}<button className="btn-p" disabled={busy || leyendo || !ok} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button></>}>
      <input ref={input} type="file" accept="image/*" capture="environment" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} onChange={elegirFoto} />
      <button type="button" className="btn-l" disabled={leyendo || busy} onClick={() => input.current?.click()}>
        {leyendo ? "Leyendo la foto… unos segundos" : fotoPath ? "Foto añadida ✓ (cambiar)" : inv.foto ? "Cambiar la foto del ticket o factura" : "Hacer foto del ticket o factura (opcional)"}
      </button>
      {lectura ? <p className="sub">{lectura}</p> : <p className="sub">Se guarda la foto y se rellenan solos los datos que se puedan leer.</p>}
      <div className="fila-campos">
        <label className="campo">Fecha<input type="date" value={f.fecha} onChange={set("fecha")} /></label>
        <label className="campo">Importe (€)<input inputMode="decimal" value={f.importe} onChange={set("importe")} placeholder="0,00" /></label>
      </div>
      <label className="campo">Concepto<input value={f.concepto} maxLength={120} onChange={set("concepto")} placeholder="Ej.: Arcón congelador" /></label>
      <div className="campo-t"><span>Forma de pago</span>
        <div className="seg">{[["efectivo_sobres", "Efectivo sobres"], ["banco_bbva", "Banco (BBVA)"]].map(([v, l]) => <button key={v} aria-pressed={f.forma_pago === v} onClick={() => setF({ ...f, forma_pago: v })}>{l}</button>)}</div>
      </div>
      {f.forma_pago === "efectivo_sobres" && <p className="sub">Sale sola en Efectivo de los sobres como salida «Inversión» y descuenta del efectivo disponible.</p>}
      {f.forma_pago === "banco_bbva" && <p className="sub">Queda «Pendiente de ver en el banco» hasta que la app la cruce con una salida de BBVA.</p>}
      <label className="campo">Proveedor (opcional)<input list="inv-provs" value={f.proveedor} maxLength={120} onChange={set("proveedor")} /></label>
      <datalist id="inv-provs">{provs.map((p) => <option key={p} value={p} />)}</datalist>
      <label className="campo">Nota (opcional)<input value={f.nota} maxLength={200} onChange={set("nota")} /></label>
      {cambiaComprobacion && <p className="es-aviso">Al cambiar el importe, la fecha o la forma de pago, se suelta la comprobación con el banco y vuelve a empezar.</p>}
    </Panel>
  );
}

function PanelEnlazar({ inv, onClose, onListo }) {
  const [movs, setMovs] = useState(null);
  const [importe, setImporte] = useState(String(inv.importe).replace(".", ","));
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const buscar = useCallback(async () => {
    setMovs(null);
    const x = numero(importe);
    try { setMovs(await sb.rpc("inversion_buscar_mov", { p_importe: Number.isFinite(x) ? x : null, p_desde: desde || null, p_hasta: hasta || null })); } catch (e) { setMovs([]); }
  }, [importe, desde, hasta]);
  useEffect(() => { buscar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const enlazar = async (mov) => {
    setBusy(true);
    try { await sb.rpc("inversion_enlazar", { p_inv: inv.id, p_mov: mov, p_nota: nota }); avisar(mov ? "Enlazada con el movimiento" : "Marcada como comprobada a mano"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  return (
    <Panel titulo="Enlazar con el banco" sub={`${inv.concepto} · ${eur(inv.importe, 2)} · ${fecha(inv.fecha)}`} onClose={onClose} ancho="480px">
      <p className="sub">Busca la salida de BBVA que pagó esta inversión, o márcala a mano con una nota.</p>
      <div className="fila-campos">
        <label className="campo">Importe (€)<input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} /></label>
        <label className="campo">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="campo">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
      </div>
      <button className="btn-l" onClick={buscar}>Buscar</button>
      {!movs ? <Cargando /> : !movs.length ? <p className="empty">No hay salidas libres con estos datos.</p> : movs.map((m) => (
        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 10 }}>
          <div>{eur(m.importe, 2)} · {fecha(m.fecha)}<span className="pf">{m.contraparte || m.concepto}</span></div>
          <button className="btn-p" disabled={busy} onClick={() => enlazar(m.id)}>Enlazar</button>
        </div>
      ))}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
        <label className="campo">Nota para marcarla a mano<input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: pagada desde otra cuenta" /></label>
        <button className="btn-l" disabled={busy || !nota.trim()} onClick={() => enlazar(null)}>Marcar como comprobada a mano</button>
      </div>
    </Panel>
  );
}
