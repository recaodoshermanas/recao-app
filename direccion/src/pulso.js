import { eur, num, pct, delta, arrow, diaLargo, nombreDia, nombreMes, cap, hora, esc, bonito, parseDate } from "./fmt.js";
import { hoursChart, weekChart, monthsChart } from "./charts.js";

// Pinta la home ("Pulso") a partir del JSON de dash_pulso()
export function renderPulso(el, d, opts = {}) {
  cmpHoy = d.hoy.fecha;
  const hoy = d.hoy, sem = d.semana, mes = d.mes;
  const dHoy = delta(hoy.venta, hoy.semana_pasada_misma_hora);
  const tAntes = hoy.tickets_semana_pasada_misma_hora;
  const dTic = delta(hoy.tickets, tAntes);
  const dTm = delta(hoy.ticket_medio, tAntes ? hoy.semana_pasada_misma_hora / tAntes : null);
  const dSem = delta(sem.venta, sem.anterior);
  const dMes = delta(mes.venta, mes.anterior_mismo_dia);
  const dAnio = delta(mes.venta, mes.anio_pasado_mismo_dia);
  const dProy = delta(mes.proyeccion, mes.anterior_total);
  const mesAnt = nombreMes(shiftMonth(mes.inicio, -1));
  const actualizado = d.actualizado ? new Date(d.actualizado) : null;
  const minutos = actualizado ? Math.round((Date.now() - actualizado.getTime()) / 60000) : null;
  const stale = minutos != null && minutos > 30 && Number(d.ahora.slice(11, 13)) >= 7;
  const horaAct = actualizado ? actualizado.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }) : "–";
  const dia = nombreDia(hoy.fecha);

  const totalFam = d.familias.reduce((s, f) => s + (f.venta || 0), 0);
  const maxFam = Math.max(...d.familias.map((f) => f.venta || 0), 1);

  el.innerHTML = `
  <section class="hero" aria-labelledby="h-hoy">
    <div>
      <h1 id="h-hoy">${diaLargo(hoy.fecha)}</h1>
      <div class="live ${stale ? "stale" : ""}"><i></i>${stale ? `Sin datos nuevos desde las ${horaAct}` : `En directo, actualizado a las ${horaAct}`}</div>
      <div class="big">${num(hoy.venta)}<small>€</small></div>
      ${hoy.semana_pasada_misma_hora > 0 ? `<div class="delta-pill ${dHoy.cls}"><b>${arrow(dHoy.cls)} ${dHoy.txt}</b><span>que el ${dia} pasado a esta hora</span></div>` : ""}
      <div class="hero-stats">
        <div><b>${num(hoy.tickets)}</b><span>tickets${tAntes ? ` <em class="${dTic.cls}">${dTic.txt}</em>` : ""}</span></div>
        <div><b>${eur(hoy.ticket_medio, 2)}</b><span>ticket medio${tAntes ? ` <em class="${dTm.cls}">${dTm.txt}</em>` : ""}</span></div>
        <div><b>≈ ${eur(hoy.proyeccion)}</b><span>cierre previsto</span></div>
      </div>
    </div>
    <div class="hero-chart">
      <div class="legend">
        <span><i></i>Hoy, por horas</span>
        <span><i class="soft"></i>El ${dia} pasado</span>
      </div>
      <div data-chart="race" style="flex:1"></div>
    </div>
  </section>

  <div class="grid">
    ${comparadorHtml()}

    <section class="card c5" aria-labelledby="h-sem">
      <div class="head">
        <div><h2 id="h-sem">Esta semana</h2><p class="sub">De lunes a ahora, venta diaria en euros</p></div>
        <div class="legend" style="color:var(--text-2)"><span><i style="color:var(--mark)"></i>Esta</span><span><i style="color:var(--ghost)"></i>Pasada</span></div>
      </div>
      <div class="num">${eur(sem.venta)}</div>
      <div class="delta ${dSem.cls}">${arrow(dSem.cls)} ${dSem.txt} <span>que la semana pasada a esta altura</span></div>
      <div data-chart="week" style="margin-top:14px"></div>
    </section>

    <section class="card c7" aria-labelledby="h-mes">
      <div class="head"><div><h2 id="h-mes">${cap(nombreMes(mes.inicio))}</h2><p class="sub">Del día 1 a hoy</p></div></div>
      <div class="num">${eur(mes.venta)}</div>
      <div class="delta ${dMes.cls}">${arrow(dMes.cls)} ${dMes.txt} <span>que ${mesAnt} a estas alturas</span></div>
      ${monthBar(mes)}
      <dl class="kv">
        <dt>Previsión de cierre</dt><dd>≈ ${eur(mes.proyeccion)}<em class="delta ${dProy.cls}">${dProy.txt} vs ${mesAnt}</em></dd>
        <dt>Mismo mes del año pasado</dt><dd>${eur(mes.anio_pasado_mismo_dia)}<em>${dAnio.txt === "–" ? "" : "este año " + dAnio.txt}</em></dd>
        <dt>Margen bruto</dt><dd>${pct(mes.margen_pct)}<em>${mesAnt}: ${pct(mes.margen_pct_anterior)}</em></dd>
        <dt>Ticket medio</dt><dd>${eur(mes.tickets ? mes.venta / mes.tickets : null, 2)}<em>${num(mes.tickets)} tickets</em></dd>
      </dl>
    </section>

    <section class="card c12" aria-labelledby="h-top">
      <div class="head"><div><h2 id="h-top">Lo más vendido hoy</h2><p class="sub">Por unidades. El cambio compara con el mismo día de la semana pasada hasta esta misma hora</p></div></div>
      ${topHoy(d.top_hoy || [])}
    </section>

    <section class="card c7" aria-labelledby="h-meses">
      <div class="head"><div><h2 id="h-meses">Últimos 13 meses</h2><p class="sub">Venta mensual con IVA. El mes en curso, con su previsión de cierre</p></div></div>
      <div data-chart="months" style="margin-top:12px"></div>
    </section>

    <section class="card c5" aria-labelledby="h-fam">
      <div class="head"><div><h2 id="h-fam">De dónde viene la venta</h2><p class="sub">Últimos 28 días frente a los 28 anteriores</p></div></div>
      <ul class="fam">
        <li class="hdr"><span>Familia</span><span class="bar-cell"></span><span class="v">Venta</span><span class="d">Cambio</span><span class="m">Margen</span></li>
        ${d.familias.map((f) => { const df = delta(f.venta, f.anterior); return `
        <li data-tip="${esc(`<b>${esc(f.familia)}</b><br>${eur(f.venta)} en 28 días (${num(f.venta / totalFam * 100)} % del total)<br>28 días anteriores: ${eur(f.anterior)}<br><span class='t'>Margen bruto ${pct(f.margen_pct)}</span>`)}">
          <span class="n">${esc(f.familia)}</span>
          <span class="bar-cell"><div class="bar" style="width:${(f.venta / maxFam * 100).toFixed(1)}%"></div></span>
          <span class="v">${eur(f.venta)}</span>
          <span class="d delta ${df.cls}">${df.txt}</span>
          <span class="m">${pct(f.margen_pct, 0)}</span>
        </li>`; }).join("")}
      </ul>
    </section>

    <section class="card c12" aria-labelledby="h-prod">
      <div class="head"><div><h2 id="h-prod">Productos a vigilar</h2><p class="sub">Últimos 7 días frente a su media semanal del mes anterior</p></div></div>
      <div class="prods">
        ${prodList("Se están parando", "var(--down)", d.productos.caen, "No hay productos importantes cayendo esta semana.")}
        ${prodList("Despegan", "var(--up)", d.productos.suben, "Nada destacable subiendo esta semana.")}
      </div>
    </section>
  </div>
  <footer class="foot">
    <span>Datos de la caja (Epos), se actualizan cada 2 minutos. Margen bruto = venta sin IVA menos coste del producto.</span>
    <span>Último ticket: ${hora(hoy.ultimo_ticket)}</span>
  </footer>`;

  drawCharts(el, d);
  iniciarComparador(el, d, opts);
}

export function drawCharts(el, d) {
  const w = (name) => el.querySelector(`[data-chart="${name}"]`);
  const r = w("race"), wk = w("week"), mo = w("months");
  if (r) r.innerHTML = hoursChart(r.clientWidth || 600, d);
  if (wk) wk.innerHTML = weekChart(wk.clientWidth || 400, d.semana.dias, d.hoy.fecha);
  if (mo) mo.innerHTML = monthsChart(mo.clientWidth || 600, d.meses, d.mes.proyeccion, window.innerWidth > 980 ? 340 : 230);
}

function monthBar(mes) {
  const ref = mes.anterior_total || 0;
  const max = Math.max(mes.proyeccion || 0, ref, mes.venta) * 1.06 || 1;
  const p = (v) => (v / max * 100).toFixed(2) + "%";
  return `
  <div class="month-bar" role="img" aria-label="Llevamos ${eur(mes.venta)} de una previsión de ${eur(mes.proyeccion)}; el mes anterior cerró en ${eur(ref)}">
    <div class="proj" style="width:${p(mes.proyeccion)}"></div>
    <div class="done" style="width:${p(mes.venta)}"></div>
    ${ref ? `<div class="ref" style="left:${p(ref)}" title="Cierre del mes anterior"></div>` : ""}
  </div>
  <div class="month-scale"><span>Llevamos ${eur(mes.venta)}</span><span>La raya: cierre del mes anterior, ${eur(ref)}</span></div>`;
}

// ---------- Comparador: «¿Por qué vamos así?» ----------
// Elige un periodo, con qué compararlo y una franja horaria. Lo calcula la base de datos (dash_comparar).
const signo = (n, f) => (n > 0 ? "+" : n < 0 ? "−" : "±") + f(Math.abs(n));
const PERIODOS = [["hoy", "Hoy"], ["ayer", "Ayer"], ["semana", "Esta semana"], ["semana_pasada", "Semana pasada"], ["mes", "Este mes"], ["mes_pasado", "Mes pasado"], ["custom", "Elegir fechas"]];
const COMPS = [["semana", "La semana anterior"], ["anterior", "El periodo anterior"], ["anio", "El año pasado"]];
const FRANJAS = [["todo", "Todo el día", 0, 24], ["manana", "Mañana (7–12 h)", 7, 12], ["mediodia", "Mediodía (12–16 h)", 12, 16], ["tarde", "Tarde (16–20 h)", 16, 20], ["noche", "Noche (20–24 h)", 20, 24], ["custom", "Elegir horas", null, null]];
const cmp = { periodo: "hoy", comp: "semana", franja: "todo", d1: null, d2: null, h1: 16, h2: 20 };
let cmpCache = { key: null, data: null }, cmpOpts = {}, cmpHoy = null;

const MES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIA_ABR = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const toD = (s) => parseDate(s);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addD = (s, n) => { const d = toD(s); d.setDate(d.getDate() + n); return iso(d); };
const addM = (s, n) => { const d = toD(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return iso(d); };
const diasEntre = (a, b) => Math.round((toD(b) - toD(a)) / 86400000);
function etiqueta(a, b) {
  const A = toD(a), B = toD(b);
  if (a === b) return `${DIA_ABR[A.getDay()]} ${A.getDate()} ${MES_ABR[A.getMonth()]}`;
  if (A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear()) return `${A.getDate()}–${B.getDate()} ${MES_ABR[B.getMonth()]}`;
  return `${A.getDate()} ${MES_ABR[A.getMonth()]} – ${B.getDate()} ${MES_ABR[B.getMonth()]}${A.getFullYear() !== B.getFullYear() ? ` ${B.getFullYear()}` : ""}`;
}

function rangos() {
  const t = cmpHoy, lunes = addD(t, -((toD(t).getDay() + 6) % 7)), ini = t.slice(0, 8) + "01";
  let d1, d2, mensual = false;
  switch (cmp.periodo) {
    case "ayer": d1 = d2 = addD(t, -1); break;
    case "semana": d1 = lunes; d2 = t; break;
    case "semana_pasada": d1 = addD(lunes, -7); d2 = addD(lunes, -1); break;
    case "mes": d1 = ini; d2 = t; mensual = true; break;
    case "mes_pasado": d1 = addM(ini, -1); d2 = addD(ini, -1); mensual = true; break;
    case "custom": d1 = cmp.d1 || addD(t, -6); d2 = cmp.d2 || t; if (d2 < d1) [d1, d2] = [d2, d1]; break;
    default: d1 = d2 = t;
  }
  let r1, r2;
  if (cmp.comp === "anio") {
    if (mensual) { r1 = addM(d1, -12); r2 = cmp.periodo === "mes_pasado" ? addD(addM(addD(d2, 1), -12), -1) : addM(d2, -12); }
    else { r1 = addD(d1, -364); r2 = addD(d2, -364); }
  } else if (cmp.comp === "anterior") {
    if (mensual) { r1 = addM(d1, -1); r2 = cmp.periodo === "mes_pasado" ? addD(d1, -1) : addM(d2, -1); }
    else { const n = diasEntre(d1, d2) + 1; r1 = addD(d1, -n); r2 = addD(d2, -n); }
  } else { r1 = addD(d1, -7); r2 = addD(d2, -7); }
  const fr = FRANJAS.find((f) => f[0] === cmp.franja);
  const h1 = cmp.franja === "custom" ? cmp.h1 : fr[2], h2 = cmp.franja === "custom" ? cmp.h2 : fr[3];
  return { d1, d2, r1, r2, h1, h2 };
}

function comparadorHtml() {
  const sel = (name, list, val) => `<select data-cmp="${name}">${list.map(([v, l]) => `<option value="${v}"${v === val ? " selected" : ""}>${l}</option>`).join("")}</select>`;
  const horas = (name, val, from, to) => `<select data-cmp="${name}">${Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => `<option value="${h}"${h === val ? " selected" : ""}>${h}:00</option>`).join("")}</select>`;
  const r = rangos();
  return `
    <section class="card c12" aria-labelledby="h-pq">
      <div class="head"><div><h2 id="h-pq">¿Por qué vamos así?</h2><p class="sub">Compara cualquier periodo y franja horaria, y mira qué explica la diferencia</p></div></div>
      <div class="filtros">
        <div class="seg seg-wrap" role="group" aria-label="Periodo">${PERIODOS.map(([v, l]) => `<button type="button" data-periodo="${v}" aria-pressed="${cmp.periodo === v}">${l}</button>`).join("")}</div>
        ${cmp.periodo === "custom" ? `<div class="fila"><label>Desde <input type="date" data-cmp="d1" value="${r.d1}" max="${cmpHoy}"></label><label>Hasta <input type="date" data-cmp="d2" value="${r.d2}" max="${cmpHoy}"></label></div>` : ""}
        <div class="fila">
          <label>Comparar con ${sel("comp", COMPS, cmp.comp)}</label>
          <label>Franja ${sel("franja", FRANJAS.map((f) => [f[0], f[1]]), cmp.franja)}</label>
          ${cmp.franja === "custom" ? `<label>De ${horas("h1", cmp.h1, 0, 23)}</label><label>a ${horas("h2", cmp.h2, 1, 24)}</label>` : ""}
        </div>
      </div>
      <div data-pq-body>${cmpCache.data ? pqBody(cmpCache.data) : `<p class="empty">Calculando…</p>`}</div>
    </section>`;
}

async function calcular(el) {
  const r = rangos(), key = JSON.stringify(r), body = el.querySelector("[data-pq-body]");
  if (!body) return;
  if (cmpCache.key !== key) body.classList.add("cargando");
  let data = null;
  if (cmpOpts.comparar) { try { data = await cmpOpts.comparar(r); } catch { data = null; } }
  else if (cmpOpts.demo) data = cmpOpts.demo(r);
  body.classList.remove("cargando");
  if (!data) { if (cmpCache.key !== key) body.innerHTML = `<p class="empty">No se ha podido calcular esta comparación. Prueba otra vez en un momento.</p>`; return; }
  cmpCache = { key, data };
  body.innerHTML = pqBody(data);
}

function iniciarComparador(el, d, opts) {
  cmpHoy = d.hoy.fecha; cmpOpts = opts || {};
  const redibujar = () => {
    const sec = el.querySelector('section[aria-labelledby="h-pq"]');
    const nuevo = document.createElement("div"); nuevo.innerHTML = comparadorHtml();
    sec.replaceWith(nuevo.firstElementChild);
    enlazar(); calcular(el);
  };
  const enlazar = () => {
    el.querySelectorAll("[data-periodo]").forEach((b) => b.addEventListener("click", () => {
      cmp.periodo = b.dataset.periodo;
      if (["mes", "mes_pasado", "custom"].includes(cmp.periodo) && cmp.comp === "semana") cmp.comp = "anterior";
      if (["hoy", "ayer", "semana", "semana_pasada"].includes(cmp.periodo) && cmp.comp === "anterior") cmp.comp = "semana";
      redibujar();
    }));
    el.querySelectorAll("[data-cmp]").forEach((s) => s.addEventListener("change", () => {
      const k = s.dataset.cmp; cmp[k] = ["h1", "h2"].includes(k) ? Number(s.value) : s.value;
      if (k === "h1" && cmp.h2 <= cmp.h1) cmp.h2 = cmp.h1 + 1;
      if (k === "h2" && cmp.h1 >= cmp.h2) cmp.h1 = cmp.h2 - 1;
      redibujar();
    }));
  };
  enlazar(); calcular(el);
}

function pqBody(c) {
  const dif = c.venta - c.venta_ref, dd = delta(c.venta, c.venta_ref);
  const franja = c.h1 === 0 && c.h2 === 24 ? "" : `, de ${c.h1} a ${c.h2} h`;
  const per = etiqueta(c.desde, c.hasta_fecha), ref = etiqueta(c.ref_desde, c.ref_hasta);
  const tm1 = c.tickets ? c.venta / c.tickets : 0, tm0 = c.tickets_ref ? c.venta_ref / c.tickets_ref : 0;
  const efTickets = (c.tickets - c.tickets_ref) * tm0, efGasto = c.tickets * (tm1 - tm0);
  const causa = !c.venta_ref ? "" : Math.abs(dd.v) < 2 ? "Prácticamente igual." :
    Math.abs(efGasto) >= Math.abs(efTickets)
      ? `La diferencia viene sobre todo de <b>lo que gasta cada cliente</b> (${signo(efGasto, eur)}), no de cuántos entran.`
      : `La diferencia viene sobre todo de <b>cuántos clientes entran</b> (${signo(efTickets, eur)}), más que de lo que gasta cada uno.`;
  const maxFam = Math.max(...c.familias.map((f) => Math.abs(f.dif)), 1);
  const sin = c.sin_ventas || [];
  return `
  <p class="pq-titular"><b class="delta ${dd.cls}">${signo(dif, eur)}${c.venta_ref ? ` (${dd.txt})` : ""}</b> en ${per}${franja}${c.hasta ? ` hasta las ${c.hasta}` : ""}, frente a ${ref}: ${eur(c.venta)} contra ${eur(c.venta_ref)}.</p>
  <p class="pq-causa">${num(c.tickets)} tickets (antes ${num(c.tickets_ref)}) y ${eur(tm1, 2)} de ticket medio (antes ${eur(tm0, 2)}). ${causa}</p>
  ${sin.length ? `<div class="pq-alerta" role="note"><b>Sin ni una venta${c.en_curso ? " todavía" : ""}, y en ${ref} sí se vendían:</b> ${sin.map((p) => `${esc(bonito(p.nombre))} (${num(p.uds_ref)} uds, ${eur(p.ref)})`).join(", ")}. ¿Se acabaron o no llegaron?</div>` : ""}
  <div class="pq-cols">
    <div>
      <h3 class="pq-h">Por familias</h3>
      ${c.familias.length ? `<ul class="dv">${c.familias.map((f) => {
        const w = (Math.abs(f.dif) / maxFam * 50).toFixed(1);
        return `<li data-tip="${esc(`<b>${esc(f.familia)}</b><br>${eur(f.venta)} frente a ${eur(f.ref)}`)}"><span class="n">${esc(f.familia)}</span>
          <span class="dv-bar"><i class="${f.dif < 0 ? "neg" : "pos"}" style="${f.dif < 0 ? `right:50%` : `left:50%`};width:${w}%"></i></span>
          <span class="delta ${f.dif < 0 ? "down" : "up"}">${signo(f.dif, eur)}</span></li>`; }).join("")}</ul>` : `<p class="empty">Sin diferencias.</p>`}
    </div>
    <div>
      <h3 class="pq-h">Productos que más restan</h3>
      ${pqLista(c.bajan, "down")}
      <h3 class="pq-h" style="margin-top:14px">Productos que más suman</h3>
      ${pqLista(c.suben, "up")}
    </div>
  </div>`;
}

function pqLista(rows, cls) {
  if (!rows || !rows.length) return `<p class="empty">Nada destacable.</p>`;
  return `<ul class="pq-l">${rows.map((p) => `<li><span class="pn">${esc(bonito(p.nombre))}<span class="pf">${num(p.uds)} uds, antes ${num(p.uds_ref)}</span></span><span class="delta ${cls}">${signo(p.dif, eur)}</span></li>`).join("")}</ul>`;
}

function topHoy(rows) {
  if (!rows.length) return `<p class="empty">Todavía no hay ventas hoy.</p>`;
  return `<table class="ranking">
    <thead><tr><th class="i">#</th><th>Producto</th><th class="r">Uds.</th><th class="r">Importe</th><th class="r">vs hace 7 días</th></tr></thead>
    <tbody>${rows.map((p, i) => {
      const dd = p.uds_antes ? delta(p.uds, p.uds_antes) : null;
      return `<tr>
        <td class="i">${i + 1}</td>
        <td><span class="pn">${esc(bonito(p.nombre))}</span><span class="pf">${esc(p.familia)}</span></td>
        <td class="r b">${num(p.uds)}</td>
        <td class="r">${eur(p.importe, 2)}</td>
        <td class="r">${dd ? `<span class="delta ${dd.cls}">${arrow(dd.cls)} ${dd.txt}</span>` : `<span class="delta up">nuevo</span>`}</td>
      </tr>`; }).join("")}</tbody>
  </table>`;
}

function prodList(title, color, rows, emptyTxt) {
  return `<div>
    <h3><span class="dot" style="background:${color}"></span>${title}</h3>
    ${rows.length ? `<ul>${rows.map((p) => `
      <li>
        <span class="pn">${esc(bonito(p.nombre))}</span>
        <span class="pv delta ${p.dif < 0 ? "down" : "up"}">${p.dif < 0 ? "−" : "+"}${eur(Math.abs(p.dif))}</span>
        <span class="pf">${esc(p.familia)}</span>
        <span class="pc">${eur(p.ultima_semana)} esta semana, ${eur(p.media_semanal)} de media</span>
      </li>`).join("")}</ul>` : `<p class="empty">${emptyTxt}</p>`}
  </div>`;
}

function shiftMonth(iso, k) { const [y, m] = iso.split("-").map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
