import { eur, num, pct, delta, arrow, diaLargo, nombreDia, nombreMes, cap, hora, esc, bonito, parseDate } from "./fmt.js";
import { hoursChart, weekChart, monthsChart } from "./charts.js";

// Pinta la home ("Pulso") a partir del JSON de dash_pulso()
export function renderPulso(el, d) {
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
    ${porQue(d.por_que)}

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
  enlazarPq(el, d.por_que || {});
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

// ---------- ¿Por qué vamos así? (hoy o ayer frente al mismo día de la semana pasada) ----------
let pqSel = "hoy";
const signo = (n, f) => (n > 0 ? "+" : n < 0 ? "−" : "±") + f(Math.abs(n));

function pqBody(c) {
  if (!c) return `<p class="empty">Sin datos para comparar.</p>`;
  const dif = c.venta - c.venta_ref, dd = delta(c.venta, c.venta_ref);
  const refTxt = `el ${nombreDia(c.referencia)} ${parseDate(c.referencia).getDate()}`;
  const tm1 = c.tickets ? c.venta / c.tickets : 0, tm0 = c.tickets_ref ? c.venta_ref / c.tickets_ref : 0;
  const efTickets = (c.tickets - c.tickets_ref) * tm0, efGasto = c.tickets * (tm1 - tm0);
  const causa = Math.abs(dif) < 20 ? "Prácticamente igual que la semana pasada."
    : Math.abs(efGasto) >= Math.abs(efTickets)
      ? `La diferencia viene sobre todo de <b>lo que gasta cada cliente</b> (${signo(efGasto, eur)}), no de cuántos entran.`
      : `La diferencia viene sobre todo de <b>cuántos clientes entran</b> (${signo(efTickets, eur)}), más que de lo que gasta cada uno.`;
  const maxFam = Math.max(...c.familias.map((f) => Math.abs(f.dif)), 1);
  const sin = c.sin_ventas || [];
  return `
  <p class="pq-titular"><b class="delta ${dd.cls}">${signo(dif, eur)} (${dd.txt})</b> frente a ${refTxt}${c.hasta ? ` a las ${c.hasta}` : ""}: ${eur(c.venta)} contra ${eur(c.venta_ref)}.</p>
  <p class="pq-causa">${num(c.tickets)} tickets (antes ${num(c.tickets_ref)}) y ${eur(tm1, 2)} de ticket medio (antes ${eur(tm0, 2)}). ${causa}</p>
  ${sin.length ? `<div class="pq-alerta" role="note"><b>Sin ni una venta${c.hasta ? " todavía" : ""}, y ${refTxt} sí se vendían:</b> ${sin.map((p) => `${esc(bonito(p.nombre))} (${num(p.uds_ref)} uds, ${eur(p.ref)})`).join(", ")}. ¿Se acabaron o no llegaron?</div>` : ""}
  <div class="pq-cols">
    <div>
      <h3 class="pq-h">Por familias</h3>
      <ul class="dv">${c.familias.map((f) => {
        const w = (Math.abs(f.dif) / maxFam * 50).toFixed(1);
        return `<li data-tip="${esc(`<b>${esc(f.familia)}</b><br>${eur(f.venta)} frente a ${eur(f.ref)}`)}"><span class="n">${esc(f.familia)}</span>
          <span class="dv-bar"><i class="${f.dif < 0 ? "neg" : "pos"}" style="${f.dif < 0 ? `right:50%` : `left:50%`};width:${w}%"></i></span>
          <span class="delta ${f.dif < 0 ? "down" : "up"}">${signo(f.dif, eur)}</span></li>`; }).join("")}</ul>
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

function porQue(pq) {
  if (!pq) return "";
  return `
    <section class="card c12" aria-labelledby="h-pq">
      <div class="head">
        <div><h2 id="h-pq">¿Por qué vamos así?</h2><p class="sub">Frente al mismo día de la semana pasada</p></div>
        <div class="seg" role="group" aria-label="Día a analizar">
          <button type="button" data-pq="hoy" aria-pressed="${pqSel === "hoy"}">Hoy</button>
          <button type="button" data-pq="ayer" aria-pressed="${pqSel === "ayer"}">Ayer</button>
        </div>
      </div>
      <div data-pq-body>${pqBody(pq[pqSel])}</div>
    </section>`;
}

function enlazarPq(el, pq) {
  el.querySelectorAll("[data-pq]").forEach((b) => b.addEventListener("click", () => {
    pqSel = b.dataset.pq;
    el.querySelectorAll("[data-pq]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.pq === pqSel)));
    el.querySelector("[data-pq-body]").innerHTML = pqBody(pq[pqSel]);
  }));
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
