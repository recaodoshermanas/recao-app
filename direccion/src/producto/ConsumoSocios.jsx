// Producto · Consumo socios (#134): apuntar lo que se llevan los socios de la tienda.
// Al guardar se resta del stock de Epos como ajuste (no es venta ni ticket) y se registra a coste completo.
import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, avisar, confirmar, hoyStr } from "../ui.jsx";
import { eur, num } from "../fmt.js";

const msg = (e) => { const t = String(e?.message || e || ""); const m = /"error"\s*:\s*"([^"]+)"/.exec(t) || /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : t || "No se ha podido"; };
const numero = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };
const nuevoLote = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
const cant = (v, peso) => `${num(v, peso ? 3 : 2).replace(/,?0+$/, "")} ${peso ? "kg" : "ud"}`;
const mesDe = (f) => f.slice(0, 7);
const mesMas = (m, k) => { const [y, mm] = m.split("-").map(Number); const d = new Date(y, mm - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const nombreMes = (m) => new Date(`${m}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
const hora = (ts) => new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });

export function ConsumoSocios() {
  const [mes, setMes] = useState(mesDe(hoyStr()));
  const [r, setR] = useState(null);
  const [busca, setBusca] = useState("");
  const [res, setRes] = useState([]);
  const [lista, setLista] = useState([]); // [{ id, n, peso, cantidad, nota }]
  const [guardando, setGuardando] = useState(false);
  const [lote, setLote] = useState(nuevoLote);
  const [avisos, setAvisos] = useState([]);
  const seq = useRef(0);

  const cargar = useCallback(async () => {
    try { setR(await sb.rpc("consumo_resumen", { p_mes: mes })); } catch (e) { avisar(msg(e), "mal"); setR((x) => x || { mes: { total: 0, apuntes: 0 }, anterior: { total: 0, apuntes: 0 }, productos: [], lista: [] }); }
  }, [mes]);
  useEffect(() => { cargar(); }, [cargar]);

  const añadir = (p) => {
    setLista((l) => (l.some((x) => x.id === p.id) ? l : [...l, { id: p.id, n: p.n, peso: !!p.peso, cantidad: "1", nota: "" }]));
    setBusca(""); setRes([]);
  };
  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2) { setRes([]); return; }
    const mi = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const d = await sb.rpc("consumo_buscar", { p_q: q });
        if (mi !== seq.current) return;
        if (d.length === 1 && d[0].cod === q) añadir(d[0]); else setRes(d);
      } catch (e) { if (mi === seq.current) avisar(msg(e), "mal"); }
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  const cambia = (id, campo, v) => setLista((l) => l.map((x) => (x.id === id ? { ...x, [campo]: v } : x)));
  const valido = lista.length > 0 && lista.every((x) => numero(x.cantidad) > 0);

  const guardar = async () => {
    if (!valido || guardando) return;
    setGuardando(true);
    try {
      const d = await sb.fn("consumo-socios", { accion: "guardar", lote, items: lista.map((x) => ({ product_id: x.id, cantidad: numero(x.cantidad), nota: x.nota })) });
      avisar(`Apuntado: ${num(d.apuntes)} producto${d.apuntes === 1 ? "" : "s"}, ${eur(d.total, 2)} a coste. Stock restado en Epos.`);
      setAvisos(d.avisos || []); setLista([]); setLote(nuevoLote()); setMes(mesDe(hoyStr())); cargar();
    } catch (e) { avisar(msg(e), "mal"); }
    setGuardando(false);
  };
  const anular = async (a) => {
    if (!(await confirmar(`¿Anular el apunte de ${a.n} (${cant(a.cantidad, a.peso)})? El stock vuelve a Epos.`))) return;
    try { await sb.fn("consumo-socios", { accion: "anular", id: a.id }); avisar("Apunte anulado: stock devuelto a Epos"); cargar(); } catch (e) { avisar(msg(e), "mal"); }
  };

  if (!r) return <Cargando />;
  const tot = Number(r.mes.total), ant = Number(r.anterior.total);
  const dif = ant > 0 ? ((tot - ant) / ant) * 100 : null;

  return (
    <>
      <div className="card mt">
        <div className="head"><div><h2>Apuntar consumo</h2><p className="sub">Busca el producto por nombre o escribe/escanea el código de barras, pon la cantidad (en kg si va al peso) y guarda. Resta del stock de Epos como ajuste: no es una venta ni sale en tickets ni en el cierre de caja.</p></div></div>
        <input className="mini-input" style={{ width: "100%", maxWidth: 480 }} placeholder="Nombre o código de barras" aria-label="Buscar producto" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {res.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4, maxWidth: 480 }}>
            {res.map((p) => (
              <button key={p.id} className="btn-l" style={{ textAlign: "left" }} onClick={() => añadir(p)}>
                {p.n}{p.peso ? " (al peso)" : ""} <span className="pf" style={{ display: "inline", marginLeft: 6 }}>{p.cod || ""}</span>
              </button>
            ))}
          </div>
        )}
        {lista.length > 0 && (
          <div className="tabla-scroll" style={{ marginTop: 12 }}>
            <table className="ranking">
              <thead><tr><th>Producto</th><th>Cantidad</th><th>Nota (opcional)</th><th /></tr></thead>
              <tbody>
                {lista.map((x) => (
                  <tr key={x.id}>
                    <td><span className="pn">{x.n}</span></td>
                    <td><input className="mini-input" style={{ width: 80 }} inputMode="decimal" aria-label={`Cantidad de ${x.n}`} value={x.cantidad} onChange={(e) => cambia(x.id, "cantidad", e.target.value)} /> {x.peso ? "kg" : "ud"}</td>
                    <td><input className="mini-input" style={{ width: "100%", minWidth: 140 }} maxLength={200} aria-label={`Nota de ${x.n}`} value={x.nota} onChange={(e) => cambia(x.id, "nota", e.target.value)} /></td>
                    <td><button className="btn-txt" onClick={() => setLista((l) => l.filter((y) => y.id !== x.id))}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}><button className="btn-p" disabled={!valido || guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar y restar del stock"}</button></div>
          </div>
        )}
        {avisos.length > 0 && <p className="pf" style={{ color: "#A3362B", fontWeight: 700, marginTop: 8 }}>{avisos.join(" · ")}. Se ha apuntado igualmente.</p>}
      </div>

      <div className="card mt">
        <div className="head">
          <div><h2>Resumen de {nombreMes(mes)}</h2><p className="sub">Todo junto, valorado a coste completo (base + IVA + recargo) en el momento de apuntar.</p></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn-l" aria-label="Mes anterior" onClick={() => setMes(mesMas(mes, -1))}>←</button>
            <input type="month" className="mini-input" value={mes} max={mesDe(hoyStr())} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mes" />
            <button className="btn-l" aria-label="Mes siguiente" disabled={mes >= mesDe(hoyStr())} onClick={() => setMes(mesMas(mes, 1))}>→</button>
          </div>
        </div>
        <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0" }}>{eur(tot, 2)} <span className="pf" style={{ display: "inline", fontSize: 13 }}>· {num(r.mes.apuntes)} apunte{r.mes.apuntes === 1 ? "" : "s"}{r.mes.sin_coste > 0 ? ` · ${r.mes.sin_coste} sin coste` : ""}</span></p>
        <p className="pf">Mes anterior: {eur(ant, 2)} ({num(r.anterior.apuntes)} apuntes){dif != null ? ` · ${dif >= 0 ? "+" : ""}${num(dif, 1)} %` : ""}</p>
        {!r.productos.length ? <p className="empty">Nada apuntado este mes.</p> : (
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Producto</th><th className="r">Cantidad</th><th className="r">Importe a coste</th></tr></thead>
              <tbody>{r.productos.map((p) => (
                <tr key={p.id}><td><span className="pn">{p.n}</span>{p.sin_coste && <span className="pf">sin coste</span>}</td><td className="r">{cant(p.cantidad, p.peso)}</td><td className="r">{eur(p.importe, 2)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt">
        <div className="head"><div><h2>Apuntes del mes</h2><p className="sub">Los de hoy se pueden anular (el stock vuelve a Epos). Para corregir uno, anúlalo y vuelve a apuntarlo.</p></div></div>
        {!r.lista.length ? <p className="empty">Sin apuntes.</p> : (
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Cuándo</th><th>Producto</th><th className="r">Cantidad</th><th className="r">Coste</th><th>Quién</th><th /></tr></thead>
              <tbody>{r.lista.map((a) => (
                <tr key={a.id} style={a.anulado ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                  <td>{hora(a.creado)}</td>
                  <td><span className="pn">{a.n}</span>{a.nota && <span className="pf">{a.nota}</span>}</td>
                  <td className="r">{cant(a.cantidad, a.peso)}</td>
                  <td className="r">{a.sin_coste ? "sin coste" : eur(a.importe, 2)}</td>
                  <td>{a.autor || "–"}</td>
                  <td>{a.anulado ? <span className="pf">Anulado</span> : a.puede_anular ? <button className="btn-txt" onClick={() => anular(a)}>Anular</button> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
