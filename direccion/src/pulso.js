import { eur, num, pct, delta, arrow, diaLargo, nombreDia, nombreMes, cap, hora, esc, bonito } from "./fmt.js";
import { hoursChart, weekChart, monthsChart } from "./charts.js";

// Pinta la home ("Pulso") a partir del JSON de dash_pulso()
export function renderPulso(el, d) {
  const hoy = d.hoy, sem = d.semana, mes = d.mes;
  const dHoy = delta(hoy.venta, hoy.semana_pasada_misma_hora);
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
        <div><b>${num(hoy.tickets)}</b><span>tickets</span></div>
        <div><b>${eur(hoy.ticket_medio, 2)}</b><span>ticket medio</span></div>
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
