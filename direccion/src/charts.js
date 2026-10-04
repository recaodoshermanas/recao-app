import { num, eur, eurK, mesCorto, mesAnio, letraDia, nombreDia, parseDate, pct } from "./fmt.js";

const INK = "#1E272E";

// ---------- tooltip compartido ----------
let tipEl;
export function initTips(root) {
  tipEl = document.createElement("div");
  tipEl.className = "tip"; tipEl.setAttribute("role", "status");
  document.body.appendChild(tipEl);
  const show = (e) => {
    const t = e.target.closest?.("[data-tip]");
    if (!t || !root.contains(t)) { hide(); return; }
    tipEl.innerHTML = t.getAttribute("data-tip");
    tipEl.classList.add("on");
    const x = e.clientX ?? 0, y = e.clientY ?? 0;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let left = x + 14, top = y - h - 12;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 16;
    tipEl.style.left = left + "px"; tipEl.style.top = top + "px";
    root.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
    const g = t.getAttribute("data-hl"); if (g) root.querySelectorAll(`[data-g="${g}"]`).forEach((n) => n.classList.add("hl"));
  };
  const hide = () => { tipEl.classList.remove("on"); root.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl")); };
  root.addEventListener("pointermove", show);
  root.addEventListener("pointerdown", show);
  root.addEventListener("pointerleave", hide);
}

const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
function niceMax(v, steps = 3) {
  const raw = v / steps; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((m) => m * mag >= raw) * mag; return n * steps;
}
// barra vertical con esquinas superiores de 4px, anclada a la base
function bar(x, y, w, h, r = 4) {
  if (h <= 0.5) return "";
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

// ---------- 1. Carrera del día (acumulado por horas) ----------
export function raceChart(width, d) {
  const H = width < 520 ? 210 : 250;
  const m = { t: 18, r: 64, b: 26, l: 46 };
  const W = width, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const horas = d.curva.horas; const h0 = horas[0], h1 = horas[horas.length - 1] + 1;
  const ahora = d.ahora; const hAct = Number(ahora.slice(11, 13)) + Number(ahora.slice(14, 16)) / 60;
  const esHoy = d.hoy.fecha === ahora.slice(0, 10);

  // acumulados
  const cum = (arr) => { let s = 0; const out = [[h0, 0]]; arr.forEach((v, i) => { s += v || 0; out.push([horas[i] + 1, s]); }); return out; };
  const lw = cum(d.curva.semana_pasada);
  const hoyPts = [[h0, 0]]; let s = 0;
  d.curva.hoy.forEach((v, i) => {
    const h = horas[i]; if (v == null) return;
    s += v; const xEnd = Math.min(h + 1, hAct); if (xEnd > h0) hoyPts.push([xEnd, s]);
  });
  const total = d.hoy.venta;
  if (hoyPts.length) hoyPts[hoyPts.length - 1][1] = total;
  // previsión: lo que queda del día con el ritmo típico (media de los últimos 4 mismos días)
  const fc = [];
  if (esHoy && hAct < h1) {
    let acc = total; const start = Math.max(hAct, h0); fc.push([start, acc]);
    horas.forEach((h, i) => {
      const t = d.curva.tipico[i] || 0;
      if (h + 1 <= start) return;
      const part = h < start ? (h + 1 - start) : 1;
      acc += t * part; fc.push([h + 1, acc]);
    });
  }
  const fcEnd = fc.length ? fc[fc.length - 1][1] : total;
  const max = niceMax(Math.max(lw[lw.length - 1][1], fcEnd, total, 1) * 1.04, 3);

  const x = (h) => m.l + (h - h0) / (h1 - h0) * iw;
  const y = (v) => m.t + ih - v / max * ih;
  const P = (pts) => path(pts.map(([a, b]) => [x(a), y(b)]));

  let g = "";
  for (let i = 0; i <= 3; i++) {
    const v = max / 3 * i, yy = y(v);
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}" stroke="${INK}" stroke-opacity="${i ? 0.12 : 0.35}" />`;
    g += `<text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" fill="${INK}" fill-opacity=".7" font-size="12">${i ? eurK(v) : "0"}</text>`;
  }
  const paso = iw < 340 ? 4 : 2;
  for (let h = h0 + 1; h <= h1; h += paso) g += `<text x="${x(h)}" y="${H - 6}" text-anchor="middle" fill="${INK}" fill-opacity=".7" font-size="12">${h}h</text>`;

  // semana pasada (fino, translúcido), previsión (discontinua), hoy (grueso)
  g += `<path d="${P(lw)}" fill="none" stroke="${INK}" stroke-opacity=".38" stroke-width="2" stroke-linejoin="round" />`;
  if (fc.length > 1) g += `<path d="${P(fc)}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="5 5" stroke-linecap="round" />`;
  if (hoyPts.length > 1) {
    const area = P(hoyPts) + `L${x(hoyPts[hoyPts.length - 1][0])},${y(0)}L${x(h0)},${y(0)}Z`;
    g += `<path d="${area}" fill="${INK}" fill-opacity=".08" />`;
    g += `<path d="${P(hoyPts)}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />`;
    const [lx, ly] = hoyPts[hoyPts.length - 1];
    if (esHoy) g += `<circle cx="${x(lx)}" cy="${y(ly)}" r="5.5" fill="${INK}" stroke="#F1BE49" stroke-width="2.5" />`;
  }
  // etiquetas directas al final de cada línea (evitando que se pisen)
  const lwEnd = lw[lw.length - 1][1];
  let yF = y(fcEnd), yL = y(lwEnd);
  if (fc.length > 1 && Math.abs(yF - yL) < 36) { const mid = (yF + yL) / 2; if (yF <= yL) { yF = mid - 18; yL = mid + 18; } else { yF = mid + 18; yL = mid - 18; } }
  if (fc.length > 1) g += `<text x="${W - m.r + 8}" y="${yF - 2}" fill="${INK}" font-size="13" font-weight="800">≈ ${num(fcEnd)} €</text><text x="${W - m.r + 8}" y="${yF + 12}" fill="${INK}" fill-opacity=".7" font-size="11">previsto</text>`;
  g += `<text x="${W - m.r + 8}" y="${yL - 2}" fill="${INK}" fill-opacity=".65" font-size="13" font-weight="700">${num(lwEnd)} €</text><text x="${W - m.r + 8}" y="${yL + 12}" fill="${INK}" fill-opacity=".55" font-size="11">hace 7 días</text>`;

  // zonas de hover por hora
  horas.forEach((h, i) => {
    const xa = x(h), xb = x(h + 1);
    const hv = d.curva.hoy[i], lv = d.curva.semana_pasada[i], tv = d.curva.tipico[i];
    const tip = `<b>De ${h} a ${h + 1} h</b><br>` +
      (hv != null ? `Hoy: <b>${eur(hv)}</b><br>` : "") +
      `Hace 7 días: ${eur(lv)}<br><span class="t">Lo normal: ${eur(tv)}</span>`;
    g += `<rect x="${xa}" y="${m.t}" width="${xb - xa}" height="${ih}" fill="transparent" data-tip="${tip.replace(/"/g, "&quot;")}" data-hl="h${h}" />`;
    g += `<line data-g="h${h}" class="xh" x1="${(xa + xb) / 2}" x2="${(xa + xb) / 2}" y1="${m.t}" y2="${m.t + ih}" stroke="${INK}" stroke-opacity="0" stroke-width="1" pointer-events="none" />`;
  });
  return `<svg class="chart race" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Venta acumulada de hoy por horas frente a hace 7 días y previsión de cierre">${g}</svg>`;
}

// ---------- 2. Semana: día a día frente a la semana pasada ----------
export function weekChart(width, dias, hoyFecha) {
  const H = 190, m = { t: 22, r: 4, b: 26, l: 4 };
  const iw = width - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...dias.map((d) => Math.max(d.venta, d.anterior)), 1) * 1.08;
  const gw = iw / 7, bw = Math.min(22, gw * 0.3), gap = 3;
  const y = (v) => m.t + ih - v / max * ih;
  let g = `<defs><pattern id="rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#F1BE49"/><rect width="2" height="6" fill="#E3A92A"/></pattern></defs>`;
  g += `<line x1="${m.l}" x2="${width - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" />`;
  dias.forEach((d, i) => {
    const cx = m.l + gw * i + gw / 2;
    const futuro = d.fecha > hoyFecha, esHoy = d.fecha === hoyFecha;
    const x1 = cx - bw - gap / 2, x2 = cx + gap / 2;
    g += `<path d="${bar(x1, y(d.anterior), bw, y(0) - y(d.anterior))}" fill="var(--ghost)" />`;
    if (!futuro) g += `<path d="${bar(x2, y(d.venta), bw, y(0) - y(d.venta))}" fill="${esHoy ? "url(#rayas)" : "var(--mark)"}" ${esHoy ? `stroke="#E3A92A" stroke-width="1"` : ""} />`;
    g += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis" ${esHoy ? 'font-weight="800" fill="var(--text)"' : ""}>${letraDia(i)}</text>`;
    const tip = `<b>${nombreDia(d.fecha).replace(/^./, (c) => c.toUpperCase())} ${parseDate(d.fecha).getDate()}</b><br>` +
      (futuro ? "Aún no ha llegado<br>" : `${esHoy ? "Hoy, de momento" : "Esta semana"}: <b>${eur(d.venta)}</b><br>`) +
      `Semana pasada: ${eur(d.anterior)}`;
    g += `<rect x="${m.l + gw * i}" y="${m.t}" width="${gw}" height="${ih + m.b}" fill="transparent" data-tip="${tip.replace(/"/g, "&quot;")}" />`;
  });
  return `<svg class="chart" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="Venta de cada día de esta semana frente a la semana pasada">${g}</svg>`;
}

// ---------- 3. Últimos 13 meses ----------
export function monthsChart(width, meses, proyeccion, alto) {
  const H = alto || 230, m = { t: 26, r: 6, b: 26, l: 40 };
  const iw = width - m.l - m.r, ih = H - m.t - m.b;
  const last = meses[meses.length - 1];
  const max = niceMax(Math.max(...meses.map((x) => x.venta), proyeccion || 0) * 1.05, 3);
  const n = meses.length, gw = iw / n, bw = Math.max(8, Math.min(34, gw * 0.62));
  const y = (v) => m.t + ih - v / max * ih;
  let g = `<defs><pattern id="rayas-m" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#F1BE49"/><rect width="2" height="6" fill="#E3A92A"/></pattern></defs>`;
  for (let i = 0; i <= 3; i++) {
    const v = max / 3 * i, yy = y(v);
    g += `<line x1="${m.l}" x2="${width - m.r}" y1="${yy}" y2="${yy}" stroke="var(--${i ? "grid" : "line"})" />`;
    g += `<text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" class="axis">${i ? eurK(v) : "0"}</text>`;
  }
  const every = width < 520 ? 2 : 1;
  meses.forEach((mm, i) => {
    const x = m.l + gw * i + (gw - bw) / 2; const cur = mm === last;
    if (cur && proyeccion) {
      g += `<path d="${bar(x, y(proyeccion), bw, y(0) - y(proyeccion))}" fill="none" stroke="var(--text)" stroke-width="1.5" stroke-dasharray="4 3" />`;
      g += `<text x="${x + bw / 2}" y="${y(proyeccion) - 8}" text-anchor="middle" font-size="12" font-weight="800" fill="var(--text)">≈ ${eurK(proyeccion)}</text>`;
    }
    g += `<path d="${bar(x, y(mm.venta), bw, y(0) - y(mm.venta))}" fill="${cur ? "url(#rayas-m)" : "var(--mark)"}" />`;
    if (i % every === (n - 1) % every) g += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="axis" ${cur ? 'font-weight="800" fill="var(--text)"' : ""}>${mesCorto(mm.mes)}</text>`;
    const tip = `<b>${mesAnio(mm.mes)}</b><br>Venta: <b>${eur(mm.venta)}</b>${cur && proyeccion ? `<br>Previsión de cierre: ${eur(proyeccion)}` : ""}<br><span class="t">${num(mm.tickets)} tickets · ticket medio ${eur(mm.ticket_medio, 2)} · margen ${pct(mm.margen_pct)}</span>`;
    g += `<rect x="${m.l + gw * i}" y="${m.t}" width="${gw}" height="${ih}" fill="transparent" data-tip="${tip.replace(/"/g, "&quot;")}" />`;
  });
  return `<svg class="chart" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="Venta mensual de los últimos 13 meses">${g}</svg>`;
}
