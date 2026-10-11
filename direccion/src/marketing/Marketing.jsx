// Marketing: socios del programa de puntos (LoyaltyDog) cruzados con las ventas de Epos,
// captación en caja, campañas con su resultado y calendario de Dos Hermanas.
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase, sb } from "../../../src/lib/supabase.js";
import { initTips } from "../charts.js";
import { eur, eurK, pct, num, mesCorto, mesAnio } from "../fmt.js";
import { Panel, Pestanas, Cargando, fechaCorta, ir, avisar } from "../ui.jsx";
import { FAMILIAS, useDatos } from "../producto/datos.js";
import "./marketing.css";

const n0 = (v) => Number(v) || 0;
const pc = (a, b) => (n0(b) > 0 ? (n0(a) / n0(b)) * 100 : null);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const diasHasta = (f) => Math.round((new Date(`${f}T12:00:00`) - new Date(`${hoyISO()}T12:00:00`)) / 86400000);
const rango = (a, b) => (a === b ? fechaCorta(a) : `${fechaCorta(a)} → ${fechaCorta(b)}`);
const AMBITO = { local: "Dos Hermanas", comercial: "Comercial", nacional: "Nacional", autonomico: "Andalucía" };

// ---------- datos ----------
const cache = {};
function useRpc(fn) {
  const [d, setD] = useState(cache[fn] || null);
  const [fallo, setFallo] = useState(false);
  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc(fn);
    if (error) { if (!cache[fn]) setFallo(true); return; }
    cache[fn] = data; setD(data);
  }, [fn]);
  useEffect(() => { initTips(document.body); cargar(); }, [cargar]);
  return { d, fallo, recargar: cargar };
}
const Estado = ({ fallo }) => <Cargando texto={fallo ? "No se han podido cargar los datos. Recarga en un momento." : "Cargando…"} />;

function Delta({ a, b, dec = 0, puntos }) {
  if (a == null || b == null) return <span className="delta">–</span>;
  const v = puntos ? a - b : pc(a - b, b);
  if (v == null) return <span className="delta">–</span>;
  const t = v > 0.05 ? "up" : v < -0.05 ? "down" : "flat";
  return <span className={`delta ${t}`}>{v > 0 ? "↑" : v < 0 ? "↓" : "→"} {v > 0 ? "+" : v < 0 ? "−" : "±"}{num(Math.abs(v), dec)}{puntos ? " p." : " %"}</span>;
}

// barras sencillas con línea opcional
function Semanas({ semanas }) {
  const W = 900, H = 220, ml = 36, mr = 40, mb = 22, mt = 10, iw = W - ml - mr, ih = H - mt - mb;
  if (!semanas?.length) return <p className="empty">Sin datos.</p>;
  const maxA = Math.max(...semanas.map((s) => n0(s.altas)), 1) * 1.15;
  const ps = semanas.map((s) => pc(s.s, s.t) ?? 0); const maxP = Math.max(...ps, 1) * 1.2;
  const gw = iw / semanas.length, bw = Math.min(22, gw * 0.55);
  const yA = (v) => mt + ih - (v / maxA) * ih, yP = (v) => mt + ih - (v / maxP) * ih;
  const linea = ps.map((p, i) => `${i ? "L" : "M"}${ml + gw * i + gw / 2},${yP(p)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Altas por semana y porcentaje de tickets con tarjeta">
      {[0, 0.5, 1].map((t) => <g key={t}><line x1={ml} x2={W - mr} y1={mt + ih * (1 - t)} y2={mt + ih * (1 - t)} stroke="var(--grid)" /><text x={ml - 6} y={mt + ih * (1 - t) + 4} textAnchor="end" className="axis">{num((maxA / 1.15) * t)}</text><text x={W - mr + 6} y={mt + ih * (1 - t) + 4} className="axis">{num((maxP / 1.2) * t, 0)} %</text></g>)}
      {semanas.map((s, i) => (
        <g key={s.sem}>
          <rect x={ml + gw * i + (gw - bw) / 2} y={yA(n0(s.altas))} width={bw} height={mt + ih - yA(n0(s.altas))} rx="3" fill="var(--amarillo)" />
          {i % 4 === 0 && <text x={ml + gw * i + gw / 2} y={H - 6} textAnchor="middle" className="axis">{fechaCorta(s.sem).split(" ").slice(1).join(" ")}</text>}
          <rect x={ml + gw * i} y={mt} width={gw} height={ih} fill="transparent" data-tip={`<b>Semana del ${esc(fechaCorta(s.sem))}</b><br>${num(s.altas)} altas<br>${num(s.s)} de ${num(s.t)} tickets con tarjeta (<b>${num(pc(s.s, s.t), 1)} %</b>)<br>Venta de socios: ${eur(s.vs)}`} />
        </g>
      ))}
      <path d={linea} fill="none" stroke="var(--mark)" strokeWidth="2.5" />
      {ps.map((p, i) => <circle key={i} cx={ml + gw * i + gw / 2} cy={yP(p)} r="3" fill="var(--mark)" />)}
    </svg>
  );
}

function BarrasH({ filas, etiqueta, valor, total, fmt = (v) => num(v), sub }) {
  const max = Math.max(...filas.map(valor), 1);
  return (
    <ul className="barras-h">
      {filas.map((f, i) => (
        <li key={i}>
          <span className="bh-e">{etiqueta(f)}</span>
          <span className="bh-b"><i style={{ width: `${(valor(f) / max) * 100}%` }} /></span>
          <span className="bh-v"><b>{fmt(valor(f), f)}</b>{sub && <small>{sub(f)}</small>}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- 1. Resumen ----------
export function MarketingResumen() {
  const M = useRpc("dash_marketing");
  const K = useRpc("dash_mkt_campanas");
  if (!M.d) return <Estado fallo={M.fallo} />;
  const d = M.d, s = d.socios || {}, p = d.periodo || {};
  const pen = pc(p.s30, p.t30), pen0 = pc(p.s0, p.t0);
  const tmSocio = n0(p.vs30) / Math.max(1, n0(p.s30)), tmResto = (n0(p.v30) - n0(p.vs30)) / Math.max(1, n0(p.t30) - n0(p.s30));
  const proximos = (K.d?.calendario || []).filter((e) => e.fin >= d.hoy && diasHasta(e.ini) <= 60);
  const pasadoDe = (e) => (K.d?.calendario || []).filter((x) => x.nombre === e.nombre && x.ini < d.hoy && x.v_base).sort((a, b) => b.ini.localeCompare(a.ini))[0];
  const avisos = [
    d.riesgo?.length > 0 && { n: d.riesgo.length, t: "socios que venían a menudo llevan 3 semanas o más sin pasar por la tienda", ruta: "marketing/clientes" },
    pen != null && pen < 15 && { n: `${num(pen, 0)} %`, t: "de los tickets llevan tarjeta de puntos: hay mucho margen pidiéndola en caja", ruta: "marketing/captacion" },
    d.nuevos?.total > 0 && { n: d.nuevos.total - d.nuevos.repiten, t: `de los ${num(d.nuevos.total)} socios nuevos de los últimos 90 días no han repetido compra`, ruta: "marketing/clientes" },
  ].filter(Boolean);
  return (
    <>
      <div className="grid sin-margen">
        <div className="card c3 fkpi2"><h2>Socios</h2><p className="num">{num(s.total)}</p><p className="sub">+{num(s.altas30)} altas en 30 días ({num(s.altas0)} los 30 anteriores)</p></div>
        <div className="card c3 fkpi2"><h2>Socios activos</h2><p className="num">{num(s.activos30)}</p><p className="sub">han comprado en 30 días · {num(s.activos90)} en 90</p></div>
        <div className="card c3 fkpi2"><h2>Tickets con tarjeta</h2><p className="num">{pct(pen, 1)}</p><p className="sub">{num(p.s30)} de {num(p.t30)} · <Delta a={pen} b={pen0} dec={1} puntos /></p></div>
        <div className="card c3 fkpi2"><h2>Venta de socios</h2><p className="num">{eur(Math.round(n0(p.vs30)))}</p><p className="sub">{pct(pc(p.vs30, p.v30), 1)} de la venta · ticket {eur(tmSocio, 2)} vs {eur(tmResto, 2)}</p></div>
      </div>

      {avisos.length > 0 && <section className="avisos favisos">{avisos.map((a) => <a key={a.t} className="aviso" href={`#/${a.ruta}`}><b>{a.n}</b><span>{a.t}</span><i aria-hidden="true">→</i></a>)}</section>}

      <div className="grid arriba">
        <div className="card c8">
          <h2>Cómo crece el programa</h2>
          <p className="sub">Altas por semana (barras) y porcentaje de tickets con tarjeta (línea), últimas 26 semanas</p>
          <Semanas semanas={d.semanas} />
        </div>
        <div className="card c4">
          <div className="head"><div><h2>Se viene</h2><p className="sub">Próximos 60 días en Dos Hermanas y en el calendario comercial</p></div><button className="enlace" onClick={() => ir("marketing/campanas")}>Calendario →</button></div>
          {!K.d ? <p className="empty">Cargando…</p> : proximos.length === 0 ? <p className="empty">Nada en los próximos 60 días.</p> : (
            <ul className="prox">
              {proximos.slice(0, 6).map((e) => { const ant = pasadoDe(e); const dd = diasHasta(e.ini); return (
                <li key={e.id}>
                  <span className={`amb a-${e.ambito}`}>{AMBITO[e.ambito] || e.ambito}</span>
                  <b>{e.nombre}</b>
                  <small>{rango(e.ini, e.fin)}{e.aprox ? " (aprox.)" : ""} · {dd <= 0 ? "ya en marcha" : dd === 1 ? "mañana" : `en ${dd} días`}</small>
                  {ant && <small className="ant">El año pasado: <b className={n0(ant.v_ev) >= n0(ant.v_base) ? "up" : "down"}>{n0(ant.v_ev) >= n0(ant.v_base) ? "+" : "−"}{num(Math.abs(pc(ant.v_ev - ant.v_base, ant.v_base)), 0)} %</b> de venta diaria{ant.suben?.length ? ` · subieron ${ant.suben.slice(0, 3).map((x) => x.n.toLowerCase()).join(", ")}` : ""}</small>}
                </li>
              ); })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid">
        <div className="card c6">
          <h2>Canjes de puntos</h2>
          <p className="sub">Ofertas canjeadas en el último año</p>
          {(d.por_oferta || []).length === 0 ? <p className="empty">Sin canjes.</p> : <BarrasH filas={d.por_oferta} etiqueta={(o) => o.oferta} valor={(o) => n0(o.n)} />}
          <p className="sub fuera">{num(s.canjeables)} socios tienen puntos para canjear algo y no lo han hecho. Un aviso a su tarjeta del móvil ({num(d.pase)} la tienen guardada) puede traerlos de vuelta.</p>
        </div>
        <div className="card c6">
          <h2>Reputación en Google</h2>
          <p className="sub">Nota, reseñas y respuestas</p>
          <div className="pendiente-g">
            <b>Pendiente de conectar</b>
            <span>En cuanto haya acceso a Google aquí saldrán la nota, el número de reseñas y su evolución, las reseñas sin responder y el avance del proyecto «Generación de reseñas».</span>
            <button className="btn-l" onClick={() => ir("marketing/reputacion")}>Ver qué hace falta</button>
          </div>
        </div>
      </div>
      <p className="sub fuera">Datos de LoyaltyDog actualizados {d.ultima_sync ? fechaCorta(d.ultima_sync) + " " + new Date(d.ultima_sync).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "–"} (cada hora). Las compras de socios se enlazan con su ticket de Epos por importe y hora.</p>
    </>
  );
}

// ---------- 2. Clientes ----------
export function MarketingClientes() {
  const M = useRpc("dash_marketing");
  const [tab, setTab] = useState("riesgo");
  if (!M.d) return <Estado fallo={M.fallo} />;
  const d = M.d, s = d.socios || {};
  const lista = tab === "riesgo" ? d.riesgo || [] : d.top || [];
  return (
    <>
      <div className="grid sin-margen">
        <div className="card c4">
          <h2>Cada cuánto vienen</h2>
          <p className="sub">Socios activos en los últimos 90 días, por número de compras</p>
          <BarrasH filas={d.frecuencia || []} etiqueta={(f) => f.b} valor={(f) => n0(f.n)} fmt={(v) => `${num(v)}`} sub={(f) => `${num(pc(f.n, s.activos90), 0)} %`} />
        </div>
        <div className="card c4">
          <h2>Socios nuevos</h2>
          <p className="sub">Altas de los últimos 90 días</p>
          <div className="nuevos">
            <div><b>{num(d.nuevos?.total)}</b><small>altas</small></div>
            <div><b className="up">{num(d.nuevos?.repiten)}</b><small>han repetido</small></div>
            <div><b className="down">{num(d.nuevos?.sin_compra)}</b><small>no han comprado nunca con la tarjeta</small></div>
          </div>
          <p className="sub fuera">Se dan de alta pero luego no la usan. Un regalo en la segunda compra ayuda a que la tarjeta se convierta en costumbre.</p>
        </div>
        <div className="card c4">
          <h2>Niveles</h2>
          <p className="sub">Reparto de socios por puntos acumulados</p>
          <BarrasH filas={d.niveles || []} etiqueta={(f) => f.nivel} valor={(f) => n0(f.n)} />
          <p className="sub fuera">Casi todos siguen en el primer nivel: el escalado de niveles no se está notando. Habría que revisar los umbrales o quitarlos.</p>
        </div>
      </div>
      <div className="card mt">
        <div className="head">
          <div><h2>{tab === "riesgo" ? "Se nos están yendo" : "Mejores socios"}</h2><p className="sub">{tab === "riesgo" ? "Compraban 3 veces o más y llevan 3 semanas sin venir. Ordenados por lo que gastaban." : "Los que más gastan en los últimos 90 días."}</p></div>
          <Pestanas valor={tab} onChange={setTab} etiqueta="Lista" opciones={[{ id: "riesgo", label: "Se nos están yendo", n: d.riesgo?.length }, { id: "top", label: "Mejores socios" }]} />
        </div>
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Socio</th><th className="r">Compras 90 d</th><th className="r">Gasto 90 d</th><th className="r">Última compra</th><th className="r">Puntos</th>{tab === "riesgo" && <th>Contacto</th>}</tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><span className="pn">{[c.nombre, c.apellidos].filter(Boolean).join(" ") || "—"}</span></td>
                  <td className="r">{num(c.visitas)}</td>
                  <td className="r b">{eur(c.gasto, 2)}</td>
                  <td className="r">{c.ult ? fechaCorta(c.ult) : "–"}</td>
                  <td className="r">{num(c.puntos)}</td>
                  {tab === "riesgo" && <td>{c.telefono ? <a href={`tel:${c.telefono}`}>{c.telefono}</a> : "–"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tab === "riesgo" && <p className="sub fuera">Para traerlos de vuelta lo más sencillo es un aviso a su tarjeta del móvil con un regalo. Lo podremos mandar desde aquí cuando montemos los envíos; cada envío lo confirmaréis antes.</p>}
      </div>
      <div className="card mt">
        <h2>Canjes por mes</h2>
        <p className="sub">Ofertas pedidas con puntos y ofertas usadas en tienda</p>
        <BarrasH filas={d.canjes || []} etiqueta={(c) => mesAnio(c.mes)} valor={(c) => n0(c.n)} sub={(c) => `${num(c.usados)} usadas · ${num(c.puntos)} puntos`} />
      </div>
    </>
  );
}

// ---------- 3. Captación ----------
export function MarketingCaptacion() {
  const M = useRpc("dash_marketing");
  if (!M.d) return <Estado fallo={M.fallo} />;
  const d = M.d, p = d.periodo || {};
  const media = pc(p.s30, p.t30);
  const quien = (d.quien || []).filter((q) => n0(q.turnos) >= 5).map((q) => ({ ...q, p: pc(q.s, q.t) })).sort((a, b) => b.p - a.p);
  return (
    <>
      <div className="card">
        <h2>Tickets con tarjeta de puntos</h2>
        <p className="sub">El programa solo crece si en caja se pregunta «¿tienes la tarjeta del Recao?». Hoy se pasa en {pct(media, 1)} de los tickets.</p>
        <Semanas semanas={d.semanas} />
      </div>
      <div className="grid">
        <div className="card c4">
          <h2>Por franja horaria</h2><p className="sub">Últimos 90 días</p>
          <BarrasH filas={d.franjas || []} etiqueta={(f) => `${f.fr} h`} valor={(f) => pc(f.s, f.t) ?? 0} fmt={(v) => `${num(v, 1)} %`} sub={(f) => `${num(f.s)} de ${num(f.t)}`} />
        </div>
        <div className="card c4">
          <h2>Por día de la semana</h2><p className="sub">Últimos 90 días</p>
          <BarrasH filas={d.dow || []} etiqueta={(f) => DIAS[f.dia]} valor={(f) => pc(f.s, f.t) ?? 0} fmt={(v) => `${num(v, 1)} %`} sub={(f) => `${num(f.s)} de ${num(f.t)}`} />
        </div>
        <div className="card c4">
          <h2>Por turno</h2><p className="sub">Según quién tenía el turno de Mañana o Tarde en Horarios (90 días)</p>
          <BarrasH filas={quien} etiqueta={(q) => q.nombre} valor={(q) => q.p ?? 0} fmt={(v) => `${num(v, 1)} %`} sub={(q) => `${num(q.turnos)} turnos`} />
        </div>
      </div>
      <div className="card mt nota-c">
        <b>Ojo con el reparto por turno.</b> En Epos casi todas las ventas se hacen con el mismo usuario, así que no sabemos quién cobra cada ticket. Se lo asignamos a la titular del turno principal según Horarios, sin contar a quien está de apoyo. Si cada trabajadora entrara en la caja con su propio PIN, la medición sería exacta y podría formar parte del plus.
      </div>
    </>
  );
}

// ---------- 4. Campañas y calendario ----------
const TIPOS = ["Oferta en tienda", "Puntos / socios", "Cartel o escaparate", "Redes sociales", "Producto nuevo", "Evento local", "Otro"];
export function MarketingCampanas() {
  const K = useRpc("dash_mkt_campanas");
  const [tab, setTab] = useState("calendario");
  const [editando, setEditando] = useState(null);
  const [evento, setEvento] = useState(null);
  const [verPasados, setVerPasados] = useState(false);
  if (!K.d) return <Estado fallo={K.fallo} />;
  const hoy = K.d.hoy;
  const cal = K.d.calendario || [];
  const futuros = cal.filter((e) => e.fin >= hoy);
  const pasados = cal.filter((e) => e.fin < hoy).sort((a, b) => b.ini.localeCompare(a.ini));
  const porMes = {}; futuros.forEach((e) => { (porMes[e.ini.slice(0, 7)] ||= []).push(e); });
  const pasadoDe = (e) => pasados.find((x) => x.nombre === e.nombre && x.v_base);
  const camps = (K.d.campanas || []).filter((c) => c.estado !== "archivada");
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={tab} onChange={setTab} etiqueta="Vista" opciones={[{ id: "calendario", label: "Calendario" }, { id: "campanas", label: "Campañas", n: camps.length }]} />
        <div className="acciones">
          <button className="btn-l" onClick={() => setEvento({})}>+ Fecha</button>
          <button className="btn-p" onClick={() => setEditando({})}>+ Campaña</button>
        </div>
      </div>

      {tab === "calendario" ? (
        <>
          {Object.entries(porMes).map(([mes, evs]) => (
            <div key={mes} className="card mes-cal">
              <h2>{mesAnio(`${mes}-01`)}</h2>
              <ul className="eventos">
                {evs.map((e) => { const ant = pasadoDe(e); const camp = camps.find((c) => c.evento_id === e.id); return (
                  <li key={e.id} className={e.festivo ? "festivo" : ""}>
                    <div className="ev-f"><b>{new Date(`${e.ini}T12:00:00`).getDate()}</b><small>{e.ini !== e.fin ? `→ ${fechaCorta(e.fin).split(" ").slice(1).join(" ")}` : new Date(`${e.ini}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short" })}</small></div>
                    <div className="ev-c">
                      <div className="ev-t"><b>{e.nombre}</b><span className={`amb a-${e.ambito}`}>{AMBITO[e.ambito] || e.ambito}</span>{e.festivo && <span className="amb fest">Festivo</span>}{e.aprox && <span className="amb aprox">Fecha aprox.</span>}</div>
                      {e.notas && <p>{e.notas}</p>}
                      {e.idea && <p className="idea"><b>Idea:</b> {e.idea}</p>}
                      {ant && <p className="ant">El año pasado ({rango(ant.ini, ant.fin)}): venta diaria {eur(ant.v_ev)} frente a {eur(ant.v_base)} habituales (<b className={n0(ant.v_ev) >= n0(ant.v_base) ? "up" : "down"}>{n0(ant.v_ev) >= n0(ant.v_base) ? "+" : "−"}{num(Math.abs(pc(ant.v_ev - ant.v_base, ant.v_base)), 0)} %</b>).{ant.suben?.length ? ` Lo que más subió: ${ant.suben.slice(0, 5).map((x) => x.n.toLowerCase()).join(", ")}.` : ""}</p>}
                    </div>
                    <div className="ev-a">{camp ? <button className="btn-l" onClick={() => setEditando(camp)}>Ver campaña</button> : <button className="btn-l" onClick={() => setEditando({ nombre: e.nombre, fecha_inicio: e.ini, fecha_fin: e.fin, evento_id: e.id, tipo: e.ambito === "local" ? "Evento local" : "Oferta en tienda", objetivo: e.idea || "" })}>Preparar campaña</button>}</div>
                  </li>
                ); })}
              </ul>
            </div>
          ))}
          <div className="card mt">
            <div className="head"><div><h2>Cómo fueron las fechas pasadas</h2><p className="sub">Venta media diaria durante cada fecha frente a las 4 semanas anteriores, y lo que más subió</p></div><button className="btn-l" onClick={() => setVerPasados(!verPasados)}>{verPasados ? "Ocultar" : `Ver ${pasados.length}`}</button></div>
            {verPasados && (
              <div className="tabla-scroll">
                <table className="ranking">
                  <thead><tr><th>Fecha</th><th className="r">Venta / día</th><th className="r">Habitual</th><th className="r">Diferencia</th><th>Lo que más subió</th></tr></thead>
                  <tbody>{pasados.filter((e) => e.v_base).map((e) => (
                    <tr key={e.id}><td><span className="pn">{e.nombre}</span><span className="pf">{rango(e.ini, e.fin)}</span></td><td className="r b">{eur(e.v_ev)}</td><td className="r">{eur(e.v_base)}</td><td className={`r ${n0(e.v_ev) >= n0(e.v_base) ? "up" : "down"}`}>{n0(e.v_ev) >= n0(e.v_base) ? "+" : "−"}{num(Math.abs(pc(e.v_ev - e.v_base, e.v_base)), 0)} %</td><td className="suben">{(e.suben || []).slice(0, 4).map((x) => x.n).join(" · ")}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        camps.length === 0 ? <div className="card"><p className="empty">Todavía no hay campañas. Crea una desde una fecha del calendario o con «+ Campaña». Al apuntarla con sus fechas y productos, el panel mide sola cuánto se vendió.</p></div> : (
          <div className="camps">
            {camps.map((c) => {
              const dia = n0(c.dias) > 0 ? n0(c.v_camp) / n0(c.dias) : null, base = n0(c.v_base28) / 28;
              const efecto = dia != null && base > 0 ? pc(dia - base, base) : null;
              const estado = c.ini > hoy ? "prevista" : c.fin < hoy ? "terminada" : "en marcha";
              return (
                <button key={c.id} className="card camp" onClick={() => setEditando(c)}>
                  <div className="camp-cab"><b>{c.nombre}</b><span className={`est e-${estado.replace(" ", "-")}`}>{estado}</span></div>
                  <small>{rango(c.ini, c.fin)} · {c.tipo || "Campaña"}{c.familia ? ` · ${c.familia}` : ""}{c.productos?.length ? ` · ${c.productos.length} productos` : ""}{c.responsable ? ` · ${c.responsable}` : ""}</small>
                  {c.objetivo && <p>{c.objetivo}</p>}
                  {estado !== "prevista" && (
                    <div className="camp-r">
                      <div><span>Venta / día</span><b>{dia != null ? eur(dia) : "–"}</b><small>habitual {eur(base)}</small></div>
                      <div><span>Efecto</span><b className={efecto == null ? "" : efecto >= 0 ? "up" : "down"}>{efecto == null ? "–" : `${efecto >= 0 ? "+" : "−"}${num(Math.abs(efecto), 0)} %`}</b><small>{c.familia || c.productos?.length ? "en lo que entra la campaña" : "en toda la tienda"}</small></div>
                      <div><span>Socios nuevos</span><b>{num(c.altas)}</b><small>{num(c.altas_base28 / 4, 0)} por semana normalmente</small></div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}
      {editando && <EditarCampana c={editando} eventos={futuros} onClose={() => setEditando(null)} onGuardado={() => { setEditando(null); K.recargar(); }} />}
      {evento && <NuevaFecha onClose={() => setEvento(null)} onGuardado={() => { setEvento(null); K.recargar(); }} />}
    </>
  );
}

function EditarCampana({ c, eventos, onClose, onGuardado }) {
  const C = useDatos("catalogo");
  const nueva = !c.id;
  const [f, setF] = useState({ nombre: c.nombre || "", tipo: c.tipo || TIPOS[0], canal: c.canal || "", objetivo: c.objetivo || "", descripcion: c.descripcion || "", fecha_inicio: c.ini || c.fecha_inicio || hoyISO(), fecha_fin: c.fin || c.fecha_fin || hoyISO(), familia: c.familia || "", product_ids: c.productos || [], coste: c.coste ?? "", responsable: c.responsable || "", notas_resultado: c.notas || "", evento_id: c.evento_id ?? null });
  const [q, setQ] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));
  const prods = C.d?.productos || [];
  const encontrados = q.trim().length > 1 ? prods.filter((p) => p.n.toLowerCase().includes(q.trim().toLowerCase()) && !f.product_ids.includes(p.id)).slice(0, 8) : [];
  const nombreDe = (id) => prods.find((p) => p.id === id)?.n || `#${id}`;
  async function guardar(extra = {}) {
    if (!f.nombre.trim()) return avisar("Ponle un nombre", "error");
    if (f.fecha_fin < f.fecha_inicio) return avisar("La fecha de fin es anterior a la de inicio", "error");
    setGuardando(true);
    const fila = { ...f, nombre: f.nombre.trim(), familia: f.familia || null, coste: f.coste === "" ? null : Number(String(f.coste).replace(",", ".")), ...extra };
    try {
      if (nueva) await sb.insert("mkt_campanas", fila); else await sb.update("mkt_campanas", `id=eq.${c.id}`, fila);
      avisar(extra.estado === "archivada" ? "Campaña archivada" : "Campaña guardada"); onGuardado();
    } catch (e) { avisar(e.message, "error"); setGuardando(false); }
  }
  return (
    <Panel titulo={nueva ? "Nueva campaña" : f.nombre} sub="Con fechas y productos, el panel mide sola el resultado con las ventas de Epos" onClose={onClose} ancho="560px"
      pie={<>{!nueva && <button className="btn-txt peligro" disabled={guardando} onClick={() => guardar({ estado: "archivada" })}>Archivar</button>}<span style={{ flex: 1 }} /><button className="btn-p" disabled={guardando} onClick={() => guardar()}>{guardando ? "Guardando…" : "Guardar"}</button></>}>
      <div className="editar-p">
        <label className="campo">Nombre<input value={f.nombre} onChange={set("nombre")} placeholder="p. ej. Hielo y bebida para Valme" /></label>
        <div className="fila-campos">
          <label className="campo">Tipo<select value={f.tipo} onChange={set("tipo")}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="campo">Canal<input value={f.canal} onChange={set("canal")} placeholder="Escaparate, Instagram, tarjeta…" /></label>
        </div>
        <div className="fila-campos">
          <label className="campo">Empieza<input type="date" value={f.fecha_inicio} onChange={set("fecha_inicio")} /></label>
          <label className="campo">Termina<input type="date" value={f.fecha_fin} onChange={set("fecha_fin")} /></label>
        </div>
        <label className="campo">Fecha del calendario<select value={f.evento_id ?? ""} onChange={(e) => set("evento_id")(e.target.value ? Number(e.target.value) : null)}><option value="">— Ninguna —</option>{eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {fechaCorta(e.ini)}</option>)}</select></label>
        <label className="campo">Objetivo<textarea rows={2} value={f.objetivo} onChange={set("objetivo")} placeholder="Qué queremos conseguir" /></label>
        <h3 className="bloque-t">Qué entra en la campaña <small>para medir el resultado</small></h3>
        <label className="campo">Familia<select value={f.familia} onChange={set("familia")}><option value="">Toda la tienda</option>{FAMILIAS.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="campo">Productos concretos<input value={q} onChange={(e) => setQ(e.target.value)} placeholder={C.d ? "Busca y añade productos…" : "Cargando catálogo…"} /></label>
        {encontrados.length > 0 && <ul className="sugeridos">{encontrados.map((p) => <li key={p.id}><button onClick={() => { set("product_ids")([...f.product_ids, p.id]); setQ(""); }}>+ {p.n}</button></li>)}</ul>}
        {f.product_ids.length > 0 && <div className="chips-p">{f.product_ids.map((id) => <span key={id}>{nombreDe(id)}<button aria-label="Quitar" onClick={() => set("product_ids")(f.product_ids.filter((x) => x !== id))}>×</button></span>)}</div>}
        <div className="fila-campos">
          <label className="campo">Coste (€)<input inputMode="decimal" value={f.coste} onChange={set("coste")} /></label>
          <label className="campo">Responsable<select value={f.responsable} onChange={set("responsable")}><option value="">—</option>{["Adrián", "Pablo", "Javi", "Miguel"].map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
        <label className="campo">Qué pasó (al terminar)<textarea rows={3} value={f.notas_resultado} onChange={set("notas_resultado")} placeholder="Lo que funcionó y lo que no, para la próxima vez" /></label>
      </div>
    </Panel>
  );
}

function NuevaFecha({ onClose, onGuardado }) {
  const [f, setF] = useState({ nombre: "", fecha_inicio: hoyISO(), fecha_fin: hoyISO(), ambito: "local", festivo: false, aproximada: false, notas: "", idea: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  async function guardar() {
    if (!f.nombre.trim()) return avisar("Ponle un nombre", "error");
    try { await sb.insert("mkt_calendario", { ...f, nombre: f.nombre.trim(), fecha_fin: f.fecha_fin < f.fecha_inicio ? f.fecha_inicio : f.fecha_fin, notas: f.notas || null, idea: f.idea || null }); avisar("Fecha añadida al calendario"); onGuardado(); }
    catch (e) { avisar(e.message, "error"); }
  }
  return (
    <Panel titulo="Nueva fecha" sub="Fiestas, eventos del barrio, partidos, fechas comerciales…" onClose={onClose} ancho="480px" pie={<button className="btn-p" onClick={guardar}>Añadir</button>}>
      <div className="editar-p">
        <label className="campo">Nombre<input value={f.nombre} onChange={set("nombre")} placeholder="p. ej. Derbi Sevilla–Betis" /></label>
        <div className="fila-campos">
          <label className="campo">Desde<input type="date" value={f.fecha_inicio} onChange={set("fecha_inicio")} /></label>
          <label className="campo">Hasta<input type="date" value={f.fecha_fin} onChange={set("fecha_fin")} /></label>
        </div>
        <label className="campo">Tipo<select value={f.ambito} onChange={set("ambito")}>{Object.entries(AMBITO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="chk"><input type="checkbox" checked={f.festivo} onChange={set("festivo")} /> Es festivo</label>
        <label className="chk"><input type="checkbox" checked={f.aproximada} onChange={set("aproximada")} /> Fecha aproximada</label>
        <label className="campo" style={{ marginTop: 14 }}>Notas<textarea rows={2} value={f.notas} onChange={set("notas")} /></label>
        <label className="campo">Idea para la tienda<textarea rows={2} value={f.idea} onChange={set("idea")} /></label>
      </div>
    </Panel>
  );
}

// ---------- 5. Reputación ----------
export function MarketingReputacion() {
  return (
    <div className="card">
      <h2>Reputación en Google</h2>
      <p className="sub">Falta conectar la ficha de Google del Recao. Hay dos formas:</p>
      <div className="opciones-g">
        <div><b>Rápida · datos públicos</b><span>Nota, número de reseñas y las 5 últimas. Hace falta una clave de Google Maps (Google Cloud, unos 10 minutos).</span></div>
        <div><b>Completa · perfil de empresa</b><span>Todas las reseñas, responderlas desde aquí y métricas de la ficha: visitas, llamadas y cómo llegar. Hay que pedir acceso a Google (tarda unos días) y entrar con la cuenta que gestiona la ficha.</span></div>
      </div>
      <p className="sub fuera">Cuando esté conectado, aquí se verá la evolución de la nota y las reseñas, las que faltan por responder y cómo avanza el proyecto «Generación de reseñas» del roadmap.</p>
    </div>
  );
}
