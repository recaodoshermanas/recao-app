// #120 · Finanzas → Stock: valor, reparto, días de stock, stock parado, margen potencial y Excel.
// Todo sale de las fotos nocturnas del stock (#61) y se calcula en la base de datos (stock_panel / stock_excel_dia).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../src/lib/supabase.js";
import { eur, num, pct, parseDate, mesAnio } from "../fmt.js";

const n0 = (v) => Number(v) || 0;
const fechaTxt = (f) => parseDate(f).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const cant = (x) => `${num(x.cantidad, x.al_peso ? 2 : 0)} ${x.al_peso ? "kg" : "uds"}`;
const dias = (d) => (d == null ? "sin ventas" : `${num(d, 1)} días`);
const NUM = { textAlign: "right", whiteSpace: "nowrap" };

function Kpi({ titulo, valor, sub, tono }) {
  return (
    <div className="card fkpi">
      <h2>{titulo}</h2>
      <p className={`num${tono ? " " + tono : ""}`}>{valor}</p>
      {sub && <p className="sub">{sub}</p>}
    </div>
  );
}

// Evolución diaria del valor del stock
function Evolucion({ puntos }) {
  if (puntos.length < 2) return <p className="sub">La gráfica saldrá cuando haya al menos dos fotos.</p>;
  const W = 760, H = 220, m = { t: 14, r: 12, b: 26, l: 56 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vals = puntos.map((p) => n0(p.valor));
  const max = Math.max(...vals) * 1.08 || 1, min = Math.min(0, ...vals);
  const x = (i) => m.l + (i / (puntos.length - 1)) * iw;
  const y = (v) => m.t + ((max - v) / (max - min)) * ih;
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(n0(p.valor)).toFixed(1)}`).join(" ");
  const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);
  const etiq = [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginTop: 12 }} role="img" aria-label="Evolución diaria del valor del stock">
      {ticks.map((t, i) => (
        <g key={i}><line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" /><text x={m.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted, #777)">{eur(t)}</text></g>
      ))}
      <path d={linea} fill="none" stroke="var(--mark)" strokeWidth="2.5" />
      {puntos.length < 60 && puntos.map((p, i) => <circle key={i} cx={x(i)} cy={y(n0(p.valor))} r="3" fill="var(--mark)"><title>{`${fechaTxt(p.fecha)}: ${eur(p.valor)}`}</title></circle>)}
      {etiq.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === puntos.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted, #777)">{fechaTxt(puntos[i].fecha)}</text>)}
    </svg>
  );
}

function TablaReparto({ filas, total, titulo, conDias }) {
  return (
    <div className="card c6">
      <h2>{titulo}</h2>
      <div className="tabla-scroll">
        <table className="ranking">
          <thead><tr><th>{titulo.replace("Por ", "").replace(/^./, (c) => c.toUpperCase())}</th><th style={NUM}>Importe</th><th style={NUM}>Unidades</th><th style={NUM}>%</th>{conDias && <th style={NUM}>Días de stock</th>}</tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.nombre}>
                <td>{f.nombre}</td><td style={NUM}>{eur(f.valor)}</td>
                <td style={NUM}>{num(f.unidades)}{n0(f.kg) ? ` + ${num(f.kg, 1)} kg` : ""}</td>
                <td style={NUM}>{total ? pct(n0(f.valor) / total * 100) : "–"}</td>
                {conDias && <td style={NUM}>{dias(f.dias)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StockFinanzas() {
  const [s, setS] = useState(null);
  const [fallo, setFallo] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [tramoAbierto, setTramoAbierto] = useState(null);
  const [fechaXl, setFechaXl] = useState("");
  const [bajando, setBajando] = useState(false);
  const [errXl, setErrXl] = useState("");

  useEffect(() => {
    supabase.rpc("stock_panel").then(({ data, error }) => { if (error) setFallo(true); else { setS(data || null); const e = data?.evolucion || []; if (e.length) setFechaXl(e[e.length - 1].fecha); } }, () => setFallo(true));
  }, []);

  const tramos = useMemo(() => {
    const t = { 30: [], 60: [], 90: [] };
    (s?.parado || []).forEach((p) => t[p.tramo].push(p));
    return t;
  }, [s]);

  if (fallo) return <div className="state">No se han podido cargar los datos. Recarga la página en un momento.</div>;
  if (!s) return <div className="state">Cargando…</div>;
  if (!s.activo) return <div className="state">El stock se activa cuando dirección pone la fecha del inventario inicial.</div>;
  if (!s.ultima) return <div className="state">Aún no hay ninguna foto del stock desde el inventario del {fechaTxt(s.inventario)}. Saldrá a la mañana siguiente.</div>;

  const u = s.ultima, valor = n0(s.valor);
  const productos = verTodos ? s.productos : s.productos.slice(0, 20);
  const mp = s.margen, margen = n0(mp.pvp) - n0(mp.coste);

  async function descargar() {
    setBajando(true); setErrXl("");
    try {
      const { data, error } = await supabase.rpc("stock_excel_dia", { p_fecha: fechaXl });
      if (error) throw error;
      const XLSX = await import("xlsx");
      const ESTADO = { ok: "Valorado", sin_valorar: "Sin valorar", negativo: "Negativo" };
      const cab = ["Fecha", "Producto", "Categoría", "Proveedor", "Cantidad", "Unidad", "Coste sin IVA", "IVA %", "Recargo %", "Coste completo unitario", "Importe", "Estado"];
      const filas = data.map((r) => [r.fecha, r.producto, r.categoria, r.proveedor, n0(r.cantidad), r.al_peso ? "kg" : "uds", r.coste == null ? null : n0(r.coste), n0(r.iva), n0(r.recargo), r.coste_completo == null ? null : n0(r.coste_completo), n0(r.importe), ESTADO[r.estado] || r.estado]);
      const aoa = [cab, ...filas, ["Total", "", "", "", "", "", "", "", "", "", filas.reduce((a, r) => a + r[10], 0), ""]];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 11 }, { wch: 42 }, { wch: 22 }, { wch: 24 }, { wch: 10 }, { wch: 7 }, { wch: 12 }, { wch: 7 }, { wch: 9 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      aoa.forEach((row, i) => { if (i > 0) { [6, 9, 10].forEach((c) => { const cell = ws[XLSX.utils.encode_cell({ r: i, c })]; if (cell && typeof cell.v === "number") cell.z = "#,##0.00"; }); } });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock");
      XLSX.writeFile(wb, `Recao_stock_${fechaXl}.xlsx`);
    } catch (e) { setErrXl("No se ha podido descargar el Excel. Inténtalo otra vez."); }
    setBajando(false);
  }

  return (
    <>
      {/* 1. Valor del stock */}
      <div className="grid">
        <div className="card c12">
          <div className="head"><div><h2>Valor del stock</h2><p className="sub">Foto de la noche del {fechaTxt(s.fecha)} · valorado a coste con IVA y recargo</p></div></div>
          <div className="grid sin-margen">
            <Kpi titulo="Valor del stock" valor={eur(valor, 0)} sub={`${num(u.productos_con_stock)} productos con stock`} />
            <Kpi titulo="Unidades" valor={num(u.unidades)} sub={n0(u.kg) ? `y ${num(u.kg, 1)} kg de productos al peso` : "Sin productos al peso"} />
            <Kpi titulo="Equivale a" valor={s.dias_total == null ? "–" : `${num(s.dias_total, 1)} días`} sub={s.dias_total == null ? "Sin ventas en los últimos 30 días" : "de ventas (coste de los últimos 30 días)"} />
          </div>
          <Evolucion puntos={s.evolucion} />
          <h2 style={{ marginTop: 18 }}>Valor a fin de cada mes</h2>
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Mes</th><th>Foto</th><th style={NUM}>Valor</th></tr></thead>
              <tbody>{s.meses.map((m) => <tr key={m.mes}><td>{mesAnio(`${m.mes}-01`)}</td><td>{fechaTxt(m.fecha)}</td><td style={NUM}>{eur(m.valor, 0)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Reparto del dinero */}
      <div className="grid">
        <TablaReparto titulo="Por categoría" filas={s.categorias} total={valor} />
        <TablaReparto titulo="Por proveedor" filas={s.proveedores} total={valor} />
        <div className="card c12">
          <h2>{verTodos ? "Todos los productos por valor" : "Los 20 productos con más valor"}</h2>
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Producto</th><th>Proveedor</th><th style={NUM}>Unidades</th><th style={NUM}>Coste sin IVA</th><th style={NUM}>Importe</th></tr></thead>
              <tbody>{productos.map((p, i) => <tr key={i}><td>{p.nombre}</td><td>{p.proveedor}</td><td style={NUM}>{cant(p)}</td><td style={NUM}>{eur(p.coste, 2)}</td><td style={NUM}>{eur(p.importe, 2)}</td></tr>)}</tbody>
            </table>
          </div>
          {s.productos.length > 20 && <p><button type="button" className="enlace" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} onClick={() => setVerTodos(!verTodos)}>{verTodos ? "Ver solo los 20 primeros" : `Ver todos (${num(s.productos.length)})`}</button></p>}
        </div>
      </div>

      {/* 3. Días de stock */}
      <div className="grid">
        <div className="card c12">
          <h2>Días de stock (rotación)</h2>
          <p className="sub">Valor del stock ÷ coste medio diario de lo vendido en los últimos 30 días, solo de productos que están en la foto. Total: <b>{s.dias_total == null ? "sin ventas" : `${num(s.dias_total, 1)} días`}</b></p>
        </div>
        {[["Por categoría", s.categorias], ["Por proveedor", s.proveedores]].map(([t, filas]) => {
          const ord = [...filas].sort((a, b) => (b.dias == null ? -1 : a.dias == null ? 1 : n0(b.dias) - n0(a.dias)));
          return (
            <div className="card c6" key={t}>
              <h2>{t}</h2>
              <div className="tabla-scroll"><table className="ranking"><thead><tr><th>{t.replace("Por ", "").replace(/^./, (c) => c.toUpperCase())}</th><th style={NUM}>Días de stock</th></tr></thead>
                <tbody>{ord.map((f) => <tr key={f.nombre}><td>{f.nombre}</td><td style={NUM}>{dias(f.dias)}</td></tr>)}</tbody></table></div>
            </div>
          );
        })}
      </div>

      {/* 4. Stock parado */}
      <div className="grid">
        <div className="card c12">
          <h2>Stock parado</h2>
          <p className="sub">Productos con stock valorado que no se han vendido en 30, 60 o 90 días. Los que nunca aparecen en las ventas guardadas cuentan en «90 días o más».</p>
          <div className="grid sin-margen">
            {[[30, "30–59 días"], [60, "60–89 días"], [90, "90 días o más"]].map(([k, l]) => (
              <div className="card fkpi" key={k} style={{ cursor: tramos[k].length ? "pointer" : "default" }} onClick={() => tramos[k].length && setTramoAbierto(tramoAbierto === k ? null : k)}>
                <h2>{l}</h2>
                <p className="num">{eur(tramos[k].reduce((a, p) => a + n0(p.importe), 0), 0)}</p>
                <p className="sub">{num(tramos[k].length)} productos{tramos[k].length ? (tramoAbierto === k ? " · ocultar lista" : " · ver lista") : ""}</p>
              </div>
            ))}
          </div>
          {tramoAbierto && (
            <div className="tabla-scroll">
              <table className="ranking">
                <thead><tr><th>Producto</th><th>Proveedor</th><th style={NUM}>Unidades</th><th style={NUM}>Importe</th><th style={NUM}>Última venta</th></tr></thead>
                <tbody>{tramos[tramoAbierto].map((p, i) => <tr key={i}><td>{p.nombre}</td><td>{p.proveedor}</td><td style={NUM}>{cant(p)}</td><td style={NUM}>{eur(p.importe, 2)}</td><td style={NUM}>{p.ultima_venta ? fechaTxt(p.ultima_venta) : "nunca"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 5. Beneficio que lleva dentro */}
      <div className="grid">
        <div className="card c12">
          <h2>Beneficio que lleva dentro el stock</h2>
          <p className="sub">Precio de venta actual (PVP de Epos) menos coste completo. {mp.sin_pvp > 0 ? `${num(mp.sin_pvp)} productos sin PVP no cuentan.` : ""}</p>
          <div className="grid sin-margen">
            <Kpi titulo="A precio de venta" valor={eur(mp.pvp, 0)} />
            <Kpi titulo="A coste" valor={eur(mp.coste, 0)} />
            <Kpi titulo="Margen potencial" valor={eur(margen, 0)} sub={n0(mp.pvp) ? `${pct(margen / n0(mp.pvp) * 100)} sobre el precio de venta` : ""} tono={margen < 0 ? "mal" : ""} />
          </div>
          <div className="tabla-scroll">
            <table className="ranking">
              <thead><tr><th>Categoría</th><th style={NUM}>A precio de venta</th><th style={NUM}>A coste</th><th style={NUM}>Margen</th><th style={NUM}>% s/ venta</th></tr></thead>
              <tbody>{mp.categorias.map((c) => { const mg = n0(c.pvp) - n0(c.coste); return <tr key={c.nombre}><td>{c.nombre}</td><td style={NUM}>{eur(c.pvp, 0)}</td><td style={NUM}>{eur(c.coste, 0)}</td><td style={NUM}>{eur(mg, 0)}</td><td style={NUM}>{n0(c.pvp) ? pct(mg / n0(c.pvp) * 100) : "–"}</td></tr>; })}</tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Sin valorar y negativos */}
      <div className="grid">
        {[["Sin valorar (sin coste en Epos)", s.sin_valorar, "No suman en ningún importe."], ["Stock negativo", s.negativos, "No restan del valor."]].map(([t, l, nota]) => (
          <div className="card c6" key={t}>
            <h2>{t}</h2>
            <p className="sub">{num(l.length)} productos · {num(l.reduce((a, x) => a + n0(x.cantidad), 0), 1)} unidades. {nota}</p>
            {l.length > 0 && <details><summary style={{ cursor: "pointer", fontWeight: 700 }}>Ver lista</summary>
              <div className="tabla-scroll"><table className="ranking"><thead><tr><th>Producto</th><th>Proveedor</th><th style={NUM}>Unidades</th></tr></thead>
                <tbody>{l.map((x, i) => <tr key={i}><td>{x.nombre}</td><td>{x.proveedor}</td><td style={NUM}>{cant(x)}</td></tr>)}</tbody></table></div></details>}
          </div>
        ))}
      </div>

      {/* 7. Excel */}
      <div className="grid">
        <div className="card c12">
          <h2>Descargar a Excel</h2>
          <p className="sub">El stock de un día producto a producto, con totales.</p>
          <p>
            <select value={fechaXl} onChange={(e) => setFechaXl(e.target.value)} aria-label="Fecha de la foto">
              {[...s.evolucion].reverse().map((e) => <option key={e.fecha} value={e.fecha}>{fechaTxt(e.fecha)}</option>)}
            </select>{" "}
            <button type="button" className="btn-l" onClick={descargar} disabled={bajando || !fechaXl}>{bajando ? "Preparando…" : "Descargar Excel"}</button>
          </p>
          {errXl && <p className="aviso-txt">{errXl}</p>}
        </div>
      </div>
    </>
  );
}
