// Producto · Pedidos (solicitud #144): historial de pedidos de Ana Mari, pedido vs. llegado y decisiones de productos lentos.
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, avisar, hace, fechaCorta } from "../ui.jsx";
import { eur } from "../fmt.js";

const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const FORMA = { whatsapp: "WhatsApp", app: "App", comercial: "Comercial", lista: "Lista en pantalla" };
const n1 = (v) => String(Math.round(Number(v) * 10) / 10).replace(".", ",");
const ESTADO = { ok: ["#E4F2E4", "#2E6B2E", "OK"], falta: ["#FBEAE7", "#A3362B", "Falta"], sobra: ["#FBF0DA", "#7A5410", "Sobra"], pendiente: ["#F0ECE2", "#5E5444", "Pendiente"] };
const tag = (k) => <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: ESTADO[k][0], color: ESTADO[k][1] }}>{ESTADO[k][2]}</span>;

export function Pedidos() {
  const [lista, setLista] = useState(null);
  const [prov, setProv] = useState("");
  const [mes, setMes] = useState("");
  const [abierto, setAbierto] = useState(null);
  const cargar = useCallback(async () => {
    try { setLista(await sb.rpc("pedidos_historial", { p_supplier: prov ? Number(prov) : null, p_mes: mes || null })); } catch (e) { avisar(msg(e), "mal"); setLista((x) => x || []); }
  }, [prov, mes]);
  useEffect(() => { cargar(); }, [cargar]);
  const [todos, setTodos] = useState([]);
  useEffect(() => { sb.rpc("pedidos_historial", {}).then((r) => setTodos(r || [])).catch(() => {}); }, []);
  if (!lista) return <Cargando />;
  const provs = [...new Map(todos.map((p) => [p.supplier_id, p.proveedor])).entries()];
  const meses = [...new Set(todos.map((p) => String(p.fecha).slice(0, 7)))].sort().reverse();
  return (
    <div className="card mt">
      <div className="head"><div><h2>Pedidos</h2><p className="sub">Los pedidos que marca Ana Mari como «Pedido hecho». Se cruzan con la primera recepción confirmada de ese proveedor posterior al pedido. El coste es aproximado (coste completo del momento).</p></div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        <select value={prov} onChange={(e) => setProv(e.target.value)} aria-label="Proveedor"><option value="">Todos los proveedores</option>{provs.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes"><option value="">Todos los meses</option>{meses.map((m) => <option key={m} value={m}>{m}</option>)}</select>
      </div>
      {!lista.length ? <p className="empty">Todavía no hay pedidos. Aparecen aquí en cuanto se marque «Pedido hecho» en la app.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Fecha</th><th>Proveedor</th><th>Forma</th><th className="r">Productos</th><th className="r">Unidades</th><th className="r">Coste aprox.</th><th>Llegada</th><th /></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td>{fechaCorta(p.fecha)}</td><td><span className="pn">{p.proveedor}</span></td><td>{FORMA[p.forma] || p.forma}</td>
                  <td className="r">{p.productos}</td><td className="r">{n1(p.unidades)}</td><td className="r">{eur(p.coste, 2)}</td>
                  <td>{p.llegada ? <>Llegó {fechaCorta(p.llegada)}</> : tag("pendiente")}</td>
                  <td><button className="btn-l" onClick={() => setAbierto(abierto === p.id ? null : p.id)}>{abierto === p.id ? "Cerrar" : "Abrir"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {abierto && <Detalle id={abierto} onCambio={cargar} />}
    </div>
  );
}

function Detalle({ id, onCambio }) {
  const [d, setD] = useState(null);
  const cargar = useCallback(async () => { try { setD(await sb.rpc("pedido_detalle", { p_id: id })); } catch (e) { avisar(msg(e), "mal"); } }, [id]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  if (!d) return <Cargando />;
  const emparejar = async (rid) => {
    try { await sb.rpc("pedido_emparejar", { p_pedido: id, p_recepcion: Number(rid) }); avisar("Recepción emparejada"); await cargar(); onCambio(); } catch (e) { avisar(msg(e), "mal"); }
  };
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid #E5DFD0", paddingTop: 10 }}>
      <h3>Pedido a {d.pedido.proveedor} · {fechaCorta(d.pedido.fecha)}</h3>
      <p className="pf">{d.recepcion_id ? `Comparado con la recepción nº ${d.recepcion_id} (${fechaCorta(d.llegada)})${d.pedido.manual ? ", emparejada a mano" : ""}.` : "Pendiente de llegar: todavía no hay una recepción confirmada de este proveedor posterior al pedido."}</p>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>Producto</th><th className="r">Pedido</th><th className="r">Llegado</th><th>Estado</th><th>Motivo</th></tr></thead>
          <tbody>{d.lineas.map((l) => (
            <tr key={l.product_id}><td><span className="pn">{l.nombre}</span></td><td className="r">{n1(l.pedido)}</td><td className="r">{l.llegado == null ? "–" : n1(l.llegado)}{l.llegado != null && l.llegado !== l.pedido && <span className="pf">{l.llegado > l.pedido ? "+" : ""}{n1(l.llegado - l.pedido)}</span>}</td><td>{tag(l.estado)}</td><td className="pf">{l.motivo}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {d.sin_pedir.length > 0 && <>
        <h4 style={{ marginTop: 12 }}>Llegaron sin pedirse ({d.sin_pedir.length})</h4>
        <ul className="pf">{d.sin_pedir.map((l) => <li key={l.product_id}>{l.nombre}: {n1(l.llegado)}</li>)}</ul>
      </>}
      {d.recepciones_posibles.length > 1 && (
        <p className="pf">¿No es esa recepción? Emparejar con otra:{" "}
          <select defaultValue="" onChange={(e) => e.target.value && emparejar(e.target.value)} aria-label="Emparejar con otra recepción">
            <option value="">Elegir…</option>
            {d.recepciones_posibles.map((r) => <option key={r.id} value={r.id}>Nº {r.id} · {fechaCorta(r.confirmado_en)}{r.doc ? ` · ${r.doc}` : ""}</option>)}
          </select>
        </p>
      )}
    </div>
  );
}

// «Seguir comprando o no» (dentro de Productos a revisar): productos lentos que se quedaron sin stock
export function SecLentos({ onCambio }) {
  const [lista, setLista] = useState(null);
  const [notas, setNotas] = useState({});
  const [busy, setBusy] = useState(null);
  const cargar = useCallback(async () => { try { setLista(await sb.rpc("pedido_lentos")); } catch (e) { avisar(msg(e), "mal"); setLista((x) => x || []); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!lista) return <Cargando />;
  const decidir = async (x, decision) => {
    setBusy(x.product_id);
    try { await sb.rpc("pedido_decidir", { p_product: x.product_id, p_decision: decision, p_nota: notas[x.product_id] || null }); avisar(decision === "seguir" ? "Se seguirá comprando" : "Se deja de comprar"); await cargar(); onCambio?.(); } catch (e) { avisar(msg(e), "mal"); }
    setBusy(null);
  };
  const pend = lista.filter((x) => !x.decision), hechos = lista.filter((x) => x.decision);
  const fila = (x) => (
    <tr key={x.product_id}>
      <td><span className="pn">{x.nombre}</span><span className="pf">{x.proveedor}</span></td>
      <td className="r">{n1(x.stock)}</td><td className="r">{x.ventas_3m} / {n1(x.ventas_12m)}</td>
      <td className="r">{x.margen == null ? "–" : `${n1(x.margen)} %`}</td><td className="r">{eur(x.pvp, 2)} / {eur(x.coste, 2)}</td>
      <td style={{ minWidth: 260 }}>
        {x.decision && <span className="pf" style={{ fontWeight: 700 }}>{x.decision === "seguir" ? "Seguir comprando" : "Dejar de comprar"} · {x.decidido_por || "dirección"} · {hace(x.decidido_en)}{x.nota ? ` · «${x.nota}»` : ""}</span>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button className={x.decision === "seguir" ? "btn-l" : "btn-p"} disabled={busy === x.product_id || x.decision === "seguir"} onClick={() => decidir(x, "seguir")}>Seguir comprando</button>
          <button className="btn-l" disabled={busy === x.product_id || x.decision === "no"} onClick={() => decidir(x, "no")}>Dejar de comprar</button>
          <input className="mini-input" placeholder="Nota (opcional)" aria-label={`Nota para ${x.nombre}`} value={notas[x.product_id] ?? ""} onChange={(e) => setNotas({ ...notas, [x.product_id]: e.target.value })} style={{ width: 140 }} />
        </div>
      </td>
    </tr>
  );
  const tabla = (rows) => (
    <div className="tabla-scroll"><table className="ranking">
      <thead><tr><th>Producto</th><th className="r">Stock</th><th className="r">Ventas 3 m / 12 m</th><th className="r">Margen</th><th className="r">PVP / coste</th><th>Decisión</th></tr></thead>
      <tbody>{rows.map(fila)}</tbody></table></div>
  );
  return (
    <div className="card mt">
      <div className="head"><div><h2>Seguir comprando o no</h2><p className="sub">Productos que venden muy poco (de 1 a 3 ventas en 3 meses) y se han quedado sin stock. Lo que decidas lo usa el siguiente pedido de Ana Mari: «Seguir comprando» lo incluye; «Dejar de comprar» sale en «No se piden». Se puede cambiar después.</p></div></div>
      {!pend.length ? <p className="empty">Nada esperando decisión.</p> : tabla(pend)}
      {hechos.length > 0 && <><h3 style={{ marginTop: 14 }}>Ya decididos</h3>{tabla(hechos)}</>}
    </div>
  );
}

// Aviso en el inicio de Producto cuando hay productos lentos esperando decisión
export function AvisosPedidos() {
  const [n, setN] = useState(0);
  useEffect(() => { sb.rpc("pedido_avisos").then((r) => setN(Number(r?.lentos_pendientes) || 0)).catch(() => {}); }, []);
  if (!n) return null;
  return (
    <section className="avisos favisos" aria-label="Productos lentos esperando decisión">
      <a className="aviso" href="#/producto/revisar/lentos"><b>Pedidos</b><span>{n} producto{n === 1 ? "" : "s"} de poca venta esperan que decidas si seguir comprándolos.</span><i aria-hidden="true">→</i></a>
    </section>
  );
}
