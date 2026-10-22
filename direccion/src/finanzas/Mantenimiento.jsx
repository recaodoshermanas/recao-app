// Finanzas → Mantenimiento (solicitud #42): única fuente de los gastos de mantenimiento, con forma de pago y comprobación con el banco (BBVA).
// Es gasto del mes: suma en la Cuenta de resultado, Cierre de mes, Tesorería y el resumen de Finanzas; y según la forma de pago
// sale en Efectivo de los sobres, en el sobre del turno (Apertura de sobres y Finanzas → Caja) o en la caja fuerte.
// Todo pasa por las funciones mantenimiento(s)_* (solo dirección). El documento (foto o PDF) se guarda y se lee en mantenimiento-foto.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Panel, Pestanas, avisar, hoyStr } from "../ui.jsx";
import { eur } from "../fmt.js";

const fecha = (f) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const numero = (t) => { const s = String(t ?? "").trim().replace(/\s/g, ""); const v = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return s !== "" && Number.isFinite(v) ? v : NaN; };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"(?:message|error)"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
// Foto del móvil → JPEG reducido; un PDF se manda tal cual
function prepararDoc(file) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name || "")) {
    if (file.size > 8.5 * 1024 * 1024) return Promise.reject(new Error("El PDF pesa demasiado (máximo 8 MB)"));
    return new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok({ mime: "application/pdf", base64: String(r.result).split(",")[1] }); r.onerror = () => mal(new Error("No puedo abrir ese PDF")); r.readAsDataURL(file); });
  }
  return new Promise((ok, mal) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 2200 / Math.max(img.width, img.height)); const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url); ok({ mime: "image/jpeg", base64: cv.toDataURL("image/jpeg", 0.82).split(",")[1] });
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No puedo abrir esa imagen")); };
    img.src = url;
  });
}
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const FORMAS = { efectivo_sobres: "Efectivo sobres", efectivo_caja: "Efectivo de caja", caja_fuerte: "Caja fuerte", banco_bbva: "Banco (BBVA)", sin_indicar: "Sin indicar" };
const ESTADOS = {
  efectivo: { label: "Efectivo · sin banco", bg: "#EDE4F5", fg: "#5A3A7A" },
  pendiente: { label: "Pendiente de ver en el banco", bg: "#FBF0DA", fg: "#8A6410" },
  comprobada: { label: "Comprobado en banco", bg: "#E7F3EC", fg: "#1E7A46" },
  a_mano: { label: "Comprobado a mano", bg: "#E7F3EC", fg: "#1E7A46" },
  no_encontrada: { label: "No encontrado en el banco", bg: "#FBEAE7", fg: "#B23A2C" },
  anterior: { label: "Sin comprobar (anterior)", bg: "#F0ECE2", fg: "#5E5444" },
};
const DONDE = {
  efectivo_sobres: "Sale sola en Efectivo de los sobres como salida «Mantenimiento» y descuenta del efectivo disponible.",
  efectivo_caja: "Cuenta como una factura pagada con «Efectivo de caja»: se resta de lo que debería haber en el sobre de ese día y turno (caja 1; si no hubo cierre de caja 1, caja 2) y sale en Finanzas → Caja.",
  caja_fuerte: "Descuenta del saldo de la caja fuerte (Finanzas → Caja).",
  banco_bbva: "Queda «Pendiente de ver en el banco» hasta que la app lo cruce con una salida de BBVA (transferencia o tarjeta).",
};

export function Mantenimiento() {
  const hoy = hoyStr();
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState("");
  const [tab, setTab] = useState("lista");
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => { try { setD(await sb.rpc("mantenimientos_datos")); setFallo(false); } catch (e) { setFallo(true); } }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const items = d?.items || [];
  const anios = useMemo(() => [...new Set([Number(hoy.slice(0, 4)), ...items.map((i) => Number(i.fecha.slice(0, 4)))])].sort((a, b) => b - a), [items, hoy]);
  const lista = useMemo(() => items.filter((i) => i.fecha.startsWith(String(anio)) && (!mes || i.fecha.slice(5, 7) === mes)), [items, anio, mes]);
  const suma = (arr) => arr.reduce((s, i) => s + Number(i.importe), 0);
  const totalMes = suma(items.filter((i) => i.fecha.startsWith(hoy.slice(0, 7))));
  const totalAnio = suma(items.filter((i) => i.fecha.startsWith(hoy.slice(0, 4))));
  const totalLista = suma(lista);

  const verDoc = async (i) => {
    const w = window.open("", "_blank");
    try { const r = await sb.fn("mantenimiento-foto", { accion: "ver", id: i.id }); if (w) w.location = r.url; else window.location.href = r.url; }
    catch (e) { if (w) w.close(); avisar(msg(e), "mal"); }
  };
  const accion = async (fn, params, ok) => {
    setBusy(true);
    try { await sb.rpc(fn, params); avisar(ok); await cargar(); } catch (e) { avisar(msg(e), "mal"); }
    setBusy(false);
  };

  if (fallo) return <div className="card"><h2>Mantenimiento</h2><p className="empty">No se ha podido cargar. Recarga la página en un momento.</p></div>;
  if (!d) return <div className="card"><Cargando /></div>;
  const nConf = d.por_confirmar.length;
  const mesNombre = MESES[Number(hoy.slice(5, 7)) - 1];

  return (
    <>
      <div className="card">
        <div className="head" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h2>Mantenimiento</h2>
            <p className="sub">Reparaciones, técnicos, pintura, arreglos, material de obra… Es gasto del mes: sale en la Cuenta de resultado, Cierre de mes, Tesorería y el resumen de Finanzas. Mételo solo aquí (no como factura ni en «Otros gastos»).</p>
          </div>
          <button className="btn-p" onClick={() => setPanel({ editar: { fecha: hoy, forma_pago: "" } })}>+ Nuevo mantenimiento</button>
        </div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", margin: "14px 0 6px", alignItems: "flex-end" }}>
          <div><div className="sub">Este mes ({mesNombre})</div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.01em" }}>{eur(totalMes, 2)}</div></div>
          <div><div className="sub">En {hoy.slice(0, 4)}</div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.01em" }}>{eur(totalAnio, 2)}</div></div>
          <div className="filtros-t" style={{ marginBottom: 0 }}>
            <label><span className="sr">Año</span><select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
            <label><span className="sr">Mes</span><select value={mes} onChange={(e) => setMes(e.target.value)}><option value="">Todos los meses</option>{MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m[0].toUpperCase() + m.slice(1)}</option>)}</select></label>
          </div>
        </div>
        <Pestanas valor={tab} onChange={setTab} etiqueta="Vista" opciones={[{ id: "lista", label: "Mantenimiento" }, { id: "confirmar", label: "Por confirmar", n: nConf }]} />
      </div>

      {tab === "lista" && (
        <div className="card" style={{ marginTop: 16 }}>
          {!lista.length ? <p className="empty">No hay mantenimiento con estos filtros.</p> : (
            <div className="tabla-scroll">
              <table className="ranking es-tabla">
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Proveedor</th><th>Forma de pago</th><th>Comprobación</th><th className="r">Importe</th><th></th></tr></thead>
                <tbody>
                  {lista.map((i) => {
                    const e = ESTADOS[i.estado] || ESTADOS.anterior;
                    return (
                      <tr key={i.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fecha(i.fecha)}</td>
                        <td>
                          {i.doc && <button className="btn-txt" title="Ver la factura" aria-label="Ver la factura" style={{ marginRight: 6 }} onClick={() => verDoc(i)}>📄</button>}
                          {i.concepto}
                          {i.num_factura && <span className="pf">Factura {i.num_factura}</span>}
                          {i.nota && <span className="pf">{i.nota}</span>}
                        </td>
                        <td>{i.proveedor || "—"}</td>
                        <td>{FORMAS[i.forma_pago]}{i.turno && <span className="pf">Turno de {i.turno}</span>}</td>
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
                <tfoot><tr><td colSpan={5}><b>Total de la lista</b></td><td className="r b">{eur(totalLista, 2)}</td><td></td></tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "confirmar" && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="sub">Salidas de BBVA que podrían ser el pago de un mantenimiento pero no se marcan solas: o hay más de una opción, o no cuadran al céntimo (margen de {eur(d.margen, 2)}). Tú decides.</p>
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
                    <button className="btn-p" disabled={busy} onClick={() => accion("mantenimiento_confirmar", { p_id: p.id, p_mov: o.mov.id }, "Mantenimiento comprobado")}>Confirmar</button>
                    <button className="btn-txt" disabled={busy} onClick={() => accion("mantenimiento_descartar", { p_id: p.id, p_mov: o.mov.id }, "Propuesta descartada")}>No es este</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {panel?.editar && <PanelMantenimiento m={panel.editar} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
      {panel?.enlazar && <PanelEnlazar m={panel.enlazar} onClose={() => setPanel(null)} onListo={() => { setPanel(null); cargar(); }} />}
    </>
  );
}

function PanelMantenimiento({ m, onClose, onListo }) {
  const nuevo = !m.id;
  const [f, setF] = useState({
    fecha: m.fecha || hoyStr(), concepto: m.concepto || "", importe: m.importe != null ? String(m.importe).replace(".", ",") : "",
    forma_pago: m.forma_pago || "", turno: m.turno || "", proveedor: m.proveedor || "", num_factura: m.num_factura || "", nota: m.nota || "",
  });
  const [provs, setProvs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [docPath, setDocPath] = useState(null); // documento nuevo subido en este panel
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState("");
  const camara = useRef(null);
  const archivo = useRef(null);
  useEffect(() => { sb.rpc("facturas_proveedores_lista").then((r) => setProvs(Array.isArray(r) ? r : [])).catch(() => {}); }, []);
  const x = numero(f.importe);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const formaValida = f.forma_pago && (f.forma_pago !== "sin_indicar" || m.forma_pago === "sin_indicar");
  const ok = f.fecha && f.concepto.trim() && x > 0 && formaValida && (f.forma_pago !== "efectivo_caja" || f.turno);
  const cambiaComprobacion = !nuevo && m.forma_pago === "banco_bbva" && ["comprobada", "a_mano"].includes(m.estado) && (Number(m.importe) !== x || m.fecha !== f.fecha || m.forma_pago !== f.forma_pago);
  const elegirDoc = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    setLeyendo(true); setLectura("");
    try {
      const r = await sb.fn("mantenimiento-foto", { accion: "leer", doc: await prepararDoc(file) });
      setDocPath(r.doc_path);
      const d = r.datos;
      if (d) {
        setF((a) => ({ ...a, fecha: d.fecha || a.fecha, concepto: a.concepto || d.concepto || "", importe: d.importe > 0 ? String(d.importe).replace(".", ",") : a.importe, proveedor: d.proveedor || a.proveedor, num_factura: d.num_factura || a.num_factura }));
        setLectura("Factura guardada y datos leídos. Revisa número, fecha, importe y proveedor, y elige la forma de pago.");
      } else setLectura(`Factura guardada, pero no se han podido leer los datos${r.aviso ? ` (${r.aviso})` : ""}. Rellénalos a mano.`);
    } catch (er) { avisar(msg(er), "mal"); }
    setLeyendo(false);
  };
  const guardar = async () => {
    setBusy(true);
    try {
      await sb.rpc("mantenimiento_guardar", { p: { id: m.id || null, fecha: f.fecha, concepto: f.concepto, importe: x, forma_pago: f.forma_pago, turno: f.forma_pago === "efectivo_caja" ? f.turno : null, proveedor: f.proveedor, num_factura: f.num_factura, nota: f.nota, ...(docPath ? { doc_path: docPath } : {}) } });
      avisar("Guardado"); onListo();
    } catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  const borrar = async () => {
    if (!window.confirm(`¿Borrar «${m.concepto}»? Desaparece de todos los sitios (Cuenta de resultado, Cierre de mes, Tesorería, sobres, caja…).`)) return;
    setBusy(true);
    try { await sb.rpc("mantenimiento_borrar", { p_id: m.id }); avisar("Mantenimiento borrado"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  const tieneDoc = docPath || m.doc;
  return (
    <Panel titulo={nuevo ? "Nuevo mantenimiento" : "Editar mantenimiento"} onClose={onClose} ancho="460px"
      pie={<>{!nuevo && <button className="btn-txt peligro" disabled={busy} onClick={borrar}>Borrar</button>}<button className="btn-p" disabled={busy || leyendo || !ok} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button></>}>
      <input ref={camara} type="file" accept="image/*" capture="environment" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} onChange={elegirDoc} />
      <input ref={archivo} type="file" accept="image/*,application/pdf,.pdf" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} onChange={elegirDoc} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn-p" disabled={leyendo || busy} onClick={() => camara.current?.click()}>
          {leyendo ? "Leyendo la factura… unos segundos" : tieneDoc ? "Cambiar foto de la factura" : "Fotografiar factura"}
        </button>
        <button type="button" className="btn-l" disabled={leyendo || busy} onClick={() => archivo.current?.click()}>Subir imagen o PDF</button>
      </div>
      {lectura ? <p className="sub">{lectura}</p> : <p className="sub">{tieneDoc ? "Ya tiene la factura guardada." : "Opcional: se guarda la factura y se rellenan solos el número, la fecha, el importe y el proveedor. Puedes saltarlo y meterlo a mano."}</p>}
      <div className="fila-campos">
        <label className="campo">Fecha de la factura<input type="date" value={f.fecha} onChange={set("fecha")} /></label>
        <label className="campo">Importe (€)<input inputMode="decimal" value={f.importe} onChange={set("importe")} placeholder="0,00" /></label>
      </div>
      <label className="campo">Concepto<input value={f.concepto} maxLength={120} onChange={set("concepto")} placeholder="Ej.: Fontanero baño" /></label>
      <div className="campo-t"><span>Forma de pago</span>
        <div className="seg seg-wrap">{["efectivo_sobres", "efectivo_caja", "caja_fuerte", "banco_bbva"].map((v) => <button key={v} aria-pressed={f.forma_pago === v} onClick={() => setF({ ...f, forma_pago: v })}>{FORMAS[v]}</button>)}</div>
      </div>
      {f.forma_pago === "sin_indicar" && <p className="sub">Apunte anterior sin forma de pago. Puedes dejarlo así o elegir una.</p>}
      {f.forma_pago === "efectivo_caja" && (
        <div className="campo-t"><span>Turno en que salió el dinero del cajón</span>
          <div className="seg">{[["mañana", "Mañana"], ["tarde", "Tarde"]].map(([v, l]) => <button key={v} aria-pressed={f.turno === v} onClick={() => setF({ ...f, turno: v })}>{l}</button>)}</div>
        </div>
      )}
      {DONDE[f.forma_pago] && <p className="sub">{DONDE[f.forma_pago]}</p>}
      <div className="fila-campos">
        <label className="campo">Proveedor (opcional)<input list="man-provs" value={f.proveedor} maxLength={120} onChange={set("proveedor")} /></label>
        <label className="campo">Nº de factura (opcional)<input value={f.num_factura} maxLength={60} onChange={set("num_factura")} placeholder="Ej.: F-2026-0381" /></label>
      </div>
      <datalist id="man-provs">{provs.map((p) => <option key={p} value={p} />)}</datalist>
      <label className="campo">Nota (opcional)<input value={f.nota} maxLength={200} onChange={set("nota")} /></label>
      {cambiaComprobacion && <p className="es-aviso">Al cambiar el importe, la fecha o la forma de pago, se suelta el movimiento del banco y vuelve a «Pendiente de ver en el banco».</p>}
      {!ok && f.forma_pago === "efectivo_caja" && !f.turno && <p className="sub" style={{ color: "#9A4A00" }}>Elige el turno para poder guardar.</p>}
      {!f.forma_pago && <p className="sub" style={{ color: "#9A4A00" }}>Elige la forma de pago para poder guardar.</p>}
    </Panel>
  );
}

function PanelEnlazar({ m, onClose, onListo }) {
  const [movs, setMovs] = useState(null);
  const [importe, setImporte] = useState(String(m.importe).replace(".", ","));
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
    try { await sb.rpc("mantenimiento_enlazar", { p_id: m.id, p_mov: mov, p_nota: nota }); avisar(mov ? "Enlazado con el movimiento" : "Marcado como comprobado a mano"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  return (
    <Panel titulo="Enlazar con el banco" sub={`${m.concepto} · ${eur(m.importe, 2)} · ${fecha(m.fecha)}`} onClose={onClose} ancho="480px">
      <p className="sub">Busca la salida de BBVA que pagó este mantenimiento, o márcalo a mano con una nota.</p>
      <div className="fila-campos">
        <label className="campo">Importe (€)<input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} /></label>
        <label className="campo">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="campo">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
      </div>
      <button className="btn-l" onClick={buscar}>Buscar</button>
      {!movs ? <Cargando /> : !movs.length ? <p className="empty">No hay salidas libres con estos datos.</p> : movs.map((x) => (
        <div key={x.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", borderTop: "1px dashed var(--line)", paddingTop: 10, marginTop: 10 }}>
          <div>{eur(x.importe, 2)} · {fecha(x.fecha)}<span className="pf">{x.contraparte || x.concepto}</span></div>
          <button className="btn-p" disabled={busy} onClick={() => enlazar(x.id)}>Enlazar</button>
        </div>
      ))}
      <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
        <label className="campo">Nota para marcarlo a mano<input value={nota} maxLength={200} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: pagado desde otra cuenta" /></label>
        <button className="btn-l" disabled={busy || !nota.trim()} onClick={() => enlazar(null)}>Marcar como comprobado a mano</button>
      </div>
    </Panel>
  );
}
