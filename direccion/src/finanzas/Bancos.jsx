// Finanzas → Bancos (solicitud #23): saldos y movimientos de BBVA y CaixaBank en solo lectura (PSD2 vía Enable Banking).
// Todo lo del banco pasa por la función «bancos»; aquí solo se leen las tablas (RLS: solo dirección).
// El banco vuelve a /bancos/callback, que redirige aquí con ?bancos_code=…&bancos_state=…
import { useCallback, useEffect, useMemo, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, avisar } from "../ui.jsx";
import { eur } from "../fmt.js";
import { leerPdf, parsearTexto } from "../../../src/lib/caixaExtracto.js";

const fn = (accion, datos = {}) => sb.fn("bancos", { accion, ...datos });
const BANCOS = ["BBVA", "CaixaBank"];
const COLOR_BANCO = { BBVA: "#1B4F9C", CaixaBank: "#0B7EC1" };
const diasHasta = (ts) => (ts ? Math.ceil((new Date(ts).getTime() - Date.now()) / 864e5) : null);
const fechaHora = (ts) => (ts ? new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
const fecha = (f) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) : "—");
const ultimos4 = (iban) => (iban ? `···${String(iban).replace(/\s/g, "").slice(-4)}` : "");
const mesDe = (f) => String(f || "").slice(0, 7);
const nombreMes = (m) => { const d = new Date(`${m}-15T12:00:00`); const t = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const msg = (e) => { const t = String(e?.message || e || ""); const m = /"error"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };

const ETIQUETAS = ["Proveedor", "Gasto fijo", "Nóminas", "Seguridad Social", "Impuestos", "Paquetería", "Datáfono", "Retirada de efectivo", "Traspaso entre bancos", "Bizum", "Gastos del banco", "Otros"]; // #86
const sinTildes = (t) => String(t || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const DESDE_CONC = "2026-10-01"; // #87: la conciliación solo mira los movimientos desde esta fecha
// La cuenta manual va con activa=false para que la sincronización con el banco (que solo recorre las activas) no la toque
const esManual = (c) => c.aspsp_nombre === "Extracto manual";

// Extracto de La Caixa (#74): la cuenta de la caja 2 no está conectada; se sube el PDF de CaixaBankNow y solo se añade lo nuevo
function SubirCaixa({ onListo }) {
  const [lectura, setLectura] = useState(null);
  const [texto, setTexto] = useState("");
  const [pegar, setPegar] = useState(false);
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState(null);
  const [fallo, setFallo] = useState("");
  const leer = (r) => { setLectura(r); setRes(null); setFallo(r.movs.length ? "" : "No he encontrado movimientos. Prueba con el PDF de CaixaBankNow (Concepto · Fecha · Importe · Saldo) o pega el texto."); };
  const elegirPdf = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy("leer"); setFallo(""); setRes(null);
    try { leer(parsearTexto(await leerPdf(f))); }
    catch (err) { setLectura(null); setFallo("No he podido leer el PDF. Puedes pegar el texto del extracto aquí debajo."); setPegar(true); }
    setBusy(null);
  };
  const cargar = async () => {
    setBusy("cargar"); setFallo("");
    try {
      const r = await sb.rpc("caixa_importar", { p_movs: lectura.movs, p_saldo: lectura.saldoFinal });
      setRes(r); setLectura(null); setTexto("");
      avisar(r.nuevos ? `La Caixa: ${r.nuevos} movimiento${r.nuevos === 1 ? "" : "s"} nuevo${r.nuevos === 1 ? "" : "s"}` : "La Caixa: no había nada nuevo", "ok");
      onListo();
    } catch (err) { setFallo(msg(err)); }
    setBusy(null);
  };
  const ok = lectura && lectura.encadenan === lectura.pares;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="head"><div><h2>Extracto de La Caixa</h2>
        <p className="sub">La cuenta de la caja 2 no está conectada. Sube el PDF que descargas de CaixaBankNow (lo puedes hacer cuando quieras): solo se añaden los movimientos que no estaban, y con ellos se cuadra la tarjeta de la caja 2 en el Cierre de mes.</p></div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
        <label className="btn-p" style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy === "leer" ? "Leyendo…" : "Elegir PDF del extracto"}
          <input type="file" accept="application/pdf,.pdf" disabled={!!busy} onChange={elegirPdf} style={{ display: "none" }} />
        </label>
        <button className="btn-txt" disabled={!!busy} onClick={() => setPegar(!pegar)}>{pegar ? "Ocultar texto" : "Pegar el texto en su lugar"}</button>
      </div>
      {pegar && (
        <div style={{ marginTop: 10 }}>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} placeholder="Una línea por movimiento: Concepto  Fecha  Importe  Saldo (o fecha;concepto;importe;saldo)" style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13, padding: 8 }} />
          <button className="btn-l" style={{ marginTop: 6 }} disabled={!texto.trim() || !!busy} onClick={() => leer(parsearTexto(texto))}>Leer el texto</button>
        </div>
      )}
      {fallo && <p role="alert" style={{ color: "var(--down)", fontWeight: 700, marginTop: 10 }}>{fallo}</p>}
      {lectura && lectura.movs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 4px" }}><b>{lectura.movs.length} movimientos</b> del {fecha(lectura.desde)} al {fecha(lectura.hasta)} · saldo final {eur(lectura.saldoFinal, 2)}</p>
          <p className="sub" style={{ margin: "0 0 8px", color: ok ? "var(--up)" : "var(--down)", fontWeight: 700 }}>
            {ok ? "Los saldos encadenan al céntimo: el archivo está completo." : `Ojo: ${lectura.pares - lectura.encadenan} de ${lectura.pares} saldos no encadenan${lectura.ignoradas ? ` y he saltado ${lectura.ignoradas} línea${lectura.ignoradas === 1 ? "" : "s"} que no he entendido` : ""}. Puede faltar algún movimiento.`}
          </p>
          <button className="btn-p" disabled={!!busy} onClick={cargar}>{busy === "cargar" ? "Cargando…" : "Cargar en Bancos"}</button>
        </div>
      )}
      {res && <p className="sub" style={{ marginTop: 10 }}>Listo: {res.leidos} leídos · <b>{res.nuevos} nuevos</b> · {res.repetidos} ya estaban (del {fecha(res.desde)} al {fecha(res.hasta)}).</p>}
    </div>
  );
}

export function Bancos() {
  const [cuentas, setCuentas] = useState(null);
  const [movs, setMovs] = useState([]);
  const [fallo, setFallo] = useState(false);
  const [busy, setBusy] = useState(null);
  const [elegir, setElegir] = useState(false);
  const [fBanco, setFBanco] = useState("");
  const [fMes, setFMes] = useState("");
  const [fExp, setFExp] = useState("");
  const [conc, setConc] = useState({});
  const [etq, setEtq] = useState({}); // #86: etiqueta de cada movimiento (automática o puesta a mano)
  const [fTexto, setFTexto] = useState("");
  const [fEtq, setFEtq] = useState("");
  const [editEtq, setEditEtq] = useState(null);
  const [manual, setManual] = useState(null);
  const [nota, setNota] = useState("");
  const [volviendo, setVolviendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const c = await sb.select("cuentas_bancarias", "select=*&or=(activa.eq.true,aspsp_nombre.eq.Extracto%20manual)&order=banco");
      const m = c.length ? await sb.select("movimientos_banco", "select=id,cuenta_id,fecha_operacion,importe,concepto,contraparte&order=fecha_operacion.desc,id.desc&limit=5000") : [];
      setCuentas(c); setMovs(m); setFallo(false);
      // #87: lo que explica cada movimiento desde el 1/10/2026 (si falla, la lista sigue sin la columna)
      sb.rpc("banco_movimientos_etiquetados").then((r) => setEtq(Object.fromEntries((r || []).map((x) => [x.id, x])))).catch(() => setEtq({}));
      sb.rpc("banco_conciliacion").then((r) => setConc(Object.fromEntries((r || []).map((x) => [x.movimiento_id, x])))).catch(() => setConc({}));
    } catch (e) { setFallo(true); }
  }, []);

  // vuelta del banco
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("bancos_code"), state = p.get("bancos_state"), error = p.get("bancos_error");
    if (!code && !error) { cargar(); return; }
    window.history.replaceState(null, "", window.location.pathname + "#/finanzas/bancos");
    if (error) { avisar(`El banco no ha dado el permiso (${error})`, "mal"); cargar(); return; }
    setVolviendo(true);
    fn("volver", { code, state })
      .then((r) => { const errs = (r.sincronizacion || []).filter((x) => x.error); avisar(errs.length ? `${r.banco} conectado, pero la primera descarga ha fallado: ${errs[0].error}` : `${r.banco} conectado: ${r.cuentas} cuenta${r.cuentas === 1 ? "" : "s"}`, errs.length ? "mal" : "ok"); })
      .catch((e) => avisar(msg(e), "mal"))
      .finally(() => { setVolviendo(false); cargar(); });
  }, [cargar]);

  const conectar = async (banco) => {
    setBusy(`c-${banco}`);
    try { const r = await fn("conectar", { banco }); window.location.href = r.url; }
    catch (e) { avisar(msg(e), "mal"); setBusy(null); }
  };
  const actualizar = async () => {
    setBusy("sync");
    try {
      const r = await fn("sincronizar");
      const errs = (r.cuentas || []).filter((x) => x.error);
      const nuevos = (r.cuentas || []).reduce((s, x) => s + (x.movimientos || 0), 0);
      avisar(errs.length ? `${errs.map((x) => x.banco).join(" y ")}: ${errs[0].error}` : `Actualizado (${nuevos} movimientos revisados)`, errs.length ? "mal" : "ok");
      await cargar();
    } catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };

  const C = useMemo(() => Object.fromEntries((cuentas || []).map((c) => [c.id, c])), [cuentas]);
  const meses = useMemo(() => [...new Set(movs.map((m) => mesDe(m.fecha_operacion)).filter(Boolean))].sort().reverse(), [movs]);
  const aplica = (m) => String(m.fecha_operacion).slice(0, 10) >= DESDE_CONC;
  const busca = sinTildes(fTexto.trim());
  const lista = useMemo(() => movs.filter((m) => (!fBanco || C[m.cuenta_id]?.banco === fBanco) && (!fMes || mesDe(m.fecha_operacion) === fMes) && (fExp !== "sin" || (aplica(m) && !conc[m.id]))
    && (!busca || sinTildes(`${m.concepto || ""} ${m.contraparte || ""}`).includes(busca)) && (!fEtq || etq[m.id]?.etiqueta === fEtq)), [movs, fBanco, fMes, fExp, conc, C, busca, fEtq, etq]);
  const sinExp = useMemo(() => movs.filter((m) => (!fBanco || C[m.cuenta_id]?.banco === fBanco) && (!fMes || mesDe(m.fecha_operacion) === fMes) && aplica(m) && !conc[m.id]), [movs, fBanco, fMes, conc, C]);
  const sinExpEntra = sinExp.filter((m) => m.importe > 0).reduce((s, m) => s + Number(m.importe), 0);
  const sinExpSale = -sinExp.filter((m) => m.importe < 0).reduce((s, m) => s + Number(m.importe), 0);
  const explicarMano = async (id) => {
    if (!nota.trim()) { avisar("Escribe una nota para explicarlo", "mal"); return; }
    setBusy(`m-${id}`);
    try { await sb.rpc("banco_explicar_a_mano", { p_movimiento: id, p_nota: nota.trim() }); setManual(null); setNota(""); await cargar(); }
    catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  const quitarMano = async (id) => {
    setBusy(`m-${id}`);
    try { await sb.rpc("banco_quitar_explicacion", { p_movimiento: id }); await cargar(); }
    catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  // #86: cambiar la etiqueta; si tiene ordenante o beneficiario, se pregunta si aplicarla a todos los suyos (y a los que lleguen)
  const cambiarEtq = async (m, etiqueta) => {
    setEditEtq(null);
    if (!etiqueta || etiqueta === etq[m.id]?.etiqueta) return;
    const aplicar = !!m.contraparte && window.confirm(`¿Poner «${etiqueta}» también a los demás movimientos de ${m.contraparte} y a los que lleguen después?\n\nAceptar: a todos · Cancelar: solo a este`);
    setBusy(`e-${m.id}`);
    try {
      const n = await sb.rpc("banco_etiqueta_cambiar", { p_mov: m.id, p_etiqueta: etiqueta, p_aplicar: aplicar });
      avisar(aplicar ? `«${etiqueta}» puesta a ${n} movimiento${n === 1 ? "" : "s"}` : `Etiqueta cambiada a «${etiqueta}»`, "ok");
      const r = await sb.rpc("banco_movimientos_etiquetados");
      setEtq(Object.fromEntries((r || []).map((x) => [x.id, x])));
    } catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  const entra = lista.filter((m) => m.importe > 0).reduce((s, m) => s + Number(m.importe), 0);
  const sale = lista.filter((m) => m.importe < 0).reduce((s, m) => s + Number(m.importe), 0);

  if (volviendo) return <div className="card"><Cargando texto="Conectando con el banco y descargando los movimientos…" /></div>;
  if (fallo) return <div className="card"><h2>Bancos</h2><p className="empty">No se ha podido cargar.</p></div>;
  if (!cuentas) return <div className="card"><Cargando /></div>;

  const conectados = new Set(cuentas.map((c) => c.banco));
  const total = cuentas.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
  const ultima = cuentas.map((c) => c.ultima_sync).filter(Boolean).sort().pop();

  const Elegir = () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
      {BANCOS.map((b) => (
        <button key={b} className="btn-l" disabled={!!busy} onClick={() => conectar(b)}>{busy === `c-${b}` ? "Abriendo…" : `${conectados.has(b) ? "Volver a conectar" : "Conectar"} ${b}`}</button>
      ))}
      <button className="btn-txt" onClick={() => setElegir(false)}>Cancelar</button>
    </div>
  );

  if (!cuentas.length) return (
    <div className="card">
      <h2>Bancos</h2>
      <p className="sub">Saldos y movimientos de las cuentas de Recao, en solo lectura. Al conectar, te lleva a la web del banco para que des el permiso; desde aquí no se puede hacer ningún pago.</p>
      {elegir ? <Elegir /> : <button className="btn-p" style={{ marginTop: 14 }} onClick={() => setElegir(true)}>Conectar banco</button>}
    </div>
  );

  return (
    <>
      <div className="card">
        <div className="head" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h2>Bancos</h2>
            <p className="sub">Saldo total {eur(total, 2)} · última actualización {fechaHora(ultima)} · se actualiza solo a las 7:00 y a las 19:00</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-p" disabled={!!busy} onClick={actualizar}>{busy === "sync" ? "Actualizando…" : "Actualizar ahora"}</button>
            {!elegir && <button className="btn-l" disabled={!!busy} onClick={() => setElegir(true)}>Conectar banco</button>}
          </div>
        </div>
        {elegir && <Elegir />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 16 }}>
          {cuentas.map((c) => {
            const dias = diasHasta(c.permiso_hasta);
            const caducado = !esManual(c) && (dias != null && dias <= 0) || /caducad/i.test(c.ultimo_error || "");
            const pronto = !caducado && dias != null && dias <= 7;
            return (
              <div key={c.id} style={{ border: `1.5px solid ${caducado ? "var(--down)" : "var(--line)"}`, borderRadius: 14, padding: "14px 16px", background: caducado ? "color-mix(in srgb, var(--down) 7%, var(--card))" : "var(--card)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <strong style={{ color: COLOR_BANCO[c.banco] || "inherit" }}>{c.banco} <span style={{ color: "var(--muted)", fontWeight: 600 }}>{ultimos4(c.iban)}</span></strong>
                  <span className="pf">{c.nombre || ""}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>{c.saldo != null ? eur(c.saldo, 2) : "—"}</div>
                <span className="pf">{esManual(c) ? `Extracto subido ${c.ultima_sync ? fechaHora(c.ultima_sync) : "— (aún no)"}` : `Actualizado ${fechaHora(c.ultima_sync)}`}</span>
                {esManual(c) ? <span className="pf">Se actualiza subiendo el PDF (más abajo)</span> : (
                  <span className="pf" style={{ color: caducado || pronto ? "var(--down)" : undefined, fontWeight: caducado || pronto ? 700 : 500 }}>
                    {caducado ? "Permiso caducado – renovar" : `Permiso hasta el ${fecha(c.permiso_hasta)}${pronto ? ` (quedan ${dias} día${dias === 1 ? "" : "s"})` : ""}`}
                  </span>
                )}
                {c.ultimo_error && !caducado && <span className="pf" style={{ color: "var(--down)" }}>Último error: {c.ultimo_error}</span>}
                {(caducado || pronto) && <button className="btn-p" style={{ marginTop: 10 }} disabled={!!busy} onClick={() => conectar(c.banco)}>{busy === `c-${c.banco}` ? "Abriendo…" : "Renovar permiso"}</button>}
              </div>
            );
          })}
        </div>
      </div>

      <SubirCaixa onListo={cargar} />

      <div className="card mt" style={{ marginTop: 16 }}>
        <div className="head" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><h2>Movimientos</h2><p className="sub">{lista.length} movimientos · entradas <span style={{ color: "var(--up)", fontWeight: 700 }}>{eur(entra, 2)}</span> · salidas <span style={{ color: "var(--down)", fontWeight: 700 }}>{eur(-sale, 2)}</span> · diferencia <b>{eur(entra + sale, 2)}</b></p></div>
          <div className="filtros-t" style={{ marginBottom: 0 }}>
            <label><span className="sr">Buscar</span><input type="search" value={fTexto} onChange={(e) => setFTexto(e.target.value)} placeholder="Buscar concepto u ordenante" style={{ minWidth: 190 }} /></label>
            <label><span className="sr">Etiqueta</span><select value={fEtq} onChange={(e) => setFEtq(e.target.value)}><option value="">Todas las etiquetas</option>{ETIQUETAS.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label><span className="sr">Banco</span><select value={fBanco} onChange={(e) => setFBanco(e.target.value)}><option value="">Todos los bancos</option>{[...conectados].map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
            <label><span className="sr">Explicación</span><select value={fExp} onChange={(e) => setFExp(e.target.value)}><option value="">Todos</option><option value="sin">Sin explicar</option></select></label>
            <label><span className="sr">Mes</span><select value={fMes} onChange={(e) => setFMes(e.target.value)}><option value="">Todos los meses</option>{meses.map((m) => <option key={m} value={m}>{nombreMes(m)}</option>)}</select></label>
          </div>
        </div>
        {sinExp.length > 0 && <p className="sub" style={{ color: "#c2570c", fontWeight: 700 }}>{sinExp.length} movimiento{sinExp.length === 1 ? "" : "s"} sin explicar ({eur(sinExpEntra, 2)} entradas · {eur(sinExpSale, 2)} salidas)</p>}
        {!lista.length ? <p className="empty">No hay movimientos con estos filtros.</p> : (
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Fecha</th><th>Banco</th><th>Concepto</th><th className="r">Importe</th><th>Etiqueta</th><th>Explicado por</th></tr></thead>
              <tbody>
                {lista.slice(0, 1000).map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fecha(m.fecha_operacion)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{C[m.cuenta_id]?.banco}</td>
                    <td>{m.concepto || "—"}{m.contraparte && <span className="pf">{m.contraparte}</span>}</td>
                    <td className="r" style={{ fontWeight: 700, color: m.importe < 0 ? "var(--down)" : "var(--up)" }}>{m.importe > 0 ? "+" : ""}{eur(m.importe, 2)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {editEtq === m.id ? (
                        <select autoFocus value={etq[m.id]?.etiqueta || ""} onChange={(e) => cambiarEtq(m, e.target.value)} onBlur={() => setEditEtq(null)}>
                          {ETIQUETAS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : etq[m.id] ? (
                        <button className="btn-txt" title="Cambiar la etiqueta" disabled={!!busy} onClick={() => setEditEtq(m.id)} style={{ fontWeight: 600 }}>{busy === `e-${m.id}` ? "Guardando…" : etq[m.id].etiqueta}{etq[m.id].manual ? " ✎" : ""}</button>
                      ) : <span className="pf">—</span>}
                    </td>
                    <td>
                      {!aplica(m) ? <span className="pf">—</span> : conc[m.id] ? (
                        <>
                          {conc[m.id].ir ? <a className="enlace" href={conc[m.id].ir}>{conc[m.id].texto}</a> : conc[m.id].texto}
                          {conc[m.id].tipo === "manual" && <span className="pf">{conc[m.id].nota} · {conc[m.id].quien}, {fechaHora(conc[m.id].cuando)} · <button className="btn-txt" disabled={!!busy} onClick={() => quitarMano(m.id)}>Quitar</button></span>}
                        </>
                      ) : manual === m.id ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <input autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota obligatoria (p. ej. Bizum de un cliente)" style={{ minWidth: 200 }} />
                          <button className="btn-p" disabled={!!busy} onClick={() => explicarMano(m.id)}>Guardar</button>
                          <button className="btn-txt" onClick={() => { setManual(null); setNota(""); }}>Cancelar</button>
                        </div>
                      ) : (
                        <><b style={{ color: "#c2570c" }}>Sin explicar</b> <button className="btn-l" onClick={() => { setManual(m.id); setNota(""); }}>Explicar a mano</button></>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length > 1000 && <p className="empty">Se muestran los 1.000 más recientes; filtra por mes para ver el resto.</p>}
          </div>
        )}
      </div>
    </>
  );
}
