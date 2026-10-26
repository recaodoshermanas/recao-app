// App de eventuales · «Mis turnos» por meses (#37): días trabajados, horas y lo que llevan ganado (bruto aproximado).
// Trabajado = turno de trabajo suyo en el horario cuya hora de fin ya ha pasado. 8 € brutos/h de turno,
// horas extra confirmadas (tabla horas_extras) a 8 €/h y plus festivo proporcional (festivos activos, nunca en domingo).
import { useState, useEffect, useCallback, useMemo } from "react";
import { F, SF, C, btnDark } from "../../lib/styles.js";
import { sb } from "../../lib/supabase.js";
import { ymd, horasTurno, horasExtraAuto } from "../../lib/turnos.js";
import { horasDeTurno, plusFestivo } from "../../lib/festivos.js";
import { DIAS_SOLTAR, esTurnoTrabajo, horarioDe, fechaLarga, diasHasta } from "../../lib/bolsa.js";
import { IcoCalendar } from "../../lib/icons.jsx";
import { card, seccion, ShiftChip, DateBlock, Hoja } from "../bolsa/BolsaUI.jsx";

export const PRECIO_HORA_EVENTUAL = 8; // € brutos por hora de turno y por hora extra confirmada

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const r2 = (n) => Math.round(n * 100) / 100;
const eur2 = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const eur0 = (n) => Math.round(n).toLocaleString("es-ES") + " €";
const hTxt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
const ultimoDia = (a, m) => new Date(a, m + 1, 0).getDate();

// Momento en que acaba el turno (hora local del móvil); si acaba pasada la medianoche, al día siguiente
function finTurno(turno, fecha) {
  const h = horasTurno(turno, fecha); const m = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(h || "");
  if (!m) return null;
  const d = new Date(`${fecha}T${m[3]}:${m[4]}:00`);
  if (+m[3] * 60 + +m[4] <= +m[1] * 60 + +m[2]) d.setDate(d.getDate() + 1);
  return d;
}

// Cálculo puro del mes (también se usa para las comprobaciones)
export function calcularMes({ horarios, extras, festivos, ahora = new Date() }) {
  const extrasPorDia = {};
  (extras || []).forEach((e) => { extrasPorDia[e.fecha] = (extrasPorDia[e.fecha] || 0) + Number(e.horas || 0); });
  const trabajados = [], proximos = [];
  (horarios || []).filter((h) => esTurnoTrabajo(h.turno)).sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((h) => {
    // La hora extra automática (Apoyo 2 del sábado) ya llega en horas_extras: no se cuenta también como hora de turno
    const horas = horasDeTurno(h.turno, h.fecha) - horasExtraAuto(h.turno, h.fecha);
    const fin = finTurno(h.turno, h.fecha);
    const fest = festivos[h.fecha];
    const domingo = new Date(`${h.fecha}T12:00:00`).getDay() === 0;
    const plus = fest && !domingo ? plusFestivo(horas) : 0;
    const hExtra = extrasPorDia[h.fecha] || 0;
    const dia = { ...h, horas, festivo: fest || null, plus, hExtra, importe: r2(horas * PRECIO_HORA_EVENTUAL + hExtra * PRECIO_HORA_EVENTUAL + plus) };
    if (fin && fin <= ahora) trabajados.push(dia); else proximos.push(dia);
  });
  // Horas extra confirmadas de un día sin turno trabajado: también suman (raro, pero que no se pierdan)
  const conTurno = new Set(trabajados.map((d) => d.fecha));
  const sueltas = Object.entries(extrasPorDia).filter(([f]) => !conTurno.has(f)).map(([fecha, hExtra]) => ({ fecha, turno: null, horas: 0, festivo: null, plus: 0, hExtra, importe: r2(hExtra * PRECIO_HORA_EVENTUAL), suelta: true }));
  const lineas = [...trabajados, ...sueltas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const horas = lineas.reduce((s, d) => s + d.horas + d.hExtra, 0);
  const importe = r2(lineas.reduce((s, d) => s + d.importe, 0));
  return { trabajados, proximos, lineas, dias: trabajados.length, horas, importe };
}

export function MisTurnosMes({ user, deBolsa, onSoltar, refresco, pendientes = {} }) {
  const hoy = new Date();
  const limite = { a: hoy.getMonth() === 11 ? hoy.getFullYear() + 1 : hoy.getFullYear(), m: (hoy.getMonth() + 1) % 12 };
  const [mes, setMes] = useState({ a: hoy.getFullYear(), m: hoy.getMonth() });
  const [vista, setVista] = useState("calendario");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const [dia, setDia] = useState(null);

  const desde = `${mes.a}-${String(mes.m + 1).padStart(2, "0")}-01`;
  const hasta = `${mes.a}-${String(mes.m + 1).padStart(2, "0")}-${ultimoDia(mes.a, mes.m)}`;

  const cargar = useCallback(async () => {
    try {
      const [h, e, f] = await Promise.all([
        sb.select("horarios", `select=fecha,turno&usuario_id=eq.${user.id}&fecha=gte.${desde}&fecha=lte.${hasta}&order=fecha.asc`),
        sb.select("horas_extras", `select=fecha,horas&usuario_id=eq.${user.id}&fecha=gte.${desde}&fecha=lte.${hasta}`),
        sb.select("festivos", `select=fecha,nombre&activo=eq.true&fecha=gte.${desde}&fecha=lte.${hasta}`),
      ]);
      setDatos({ horarios: h || [], extras: e || [], festivos: Object.fromEntries((f || []).map((x) => [x.fecha, x])) });
      setError(false);
    } catch (err) { setError(true); setDatos({ horarios: [], extras: [], festivos: {} }); }
  }, [user.id, desde, hasta]);

  useEffect(() => { setDatos(null); cargar(); }, [cargar]);
  useEffect(() => { if (refresco !== undefined) cargar(); }, [refresco]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(cargar, 60000);
    const v = () => { if (document.visibilityState === "visible") cargar(); };
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, [cargar]);

  const res = useMemo(() => (datos ? calcularMes(datos) : null), [datos]);
  const porFecha = useMemo(() => {
    const m = {}; if (!res) return m;
    res.trabajados.forEach((d) => { m[d.fecha] = { ...d, estado: "trabajado" }; });
    res.proximos.forEach((d) => { m[d.fecha] = { ...d, estado: "proximo" }; });
    return m;
  }, [res]);

  const mover = (d) => setMes(({ a, m }) => { let mm = m + d, aa = a; if (mm < 0) { mm = 11; aa--; } if (mm > 11) { mm = 0; aa++; } return { a: aa, m: mm }; });
  const enLimite = mes.a === limite.a && mes.m === limite.m;
  const hoyS = ymd(hoy);

  const flecha = (d, label, dis) => (
    <button onClick={() => mover(d)} disabled={dis} aria-label={label} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid #4a4a4a", background: "transparent", color: dis ? "#5c5c5c" : C.gold, fontFamily: F, fontSize: 20, fontWeight: 700, cursor: dis ? "default" : "pointer" }}>{d < 0 ? "‹" : "›"}</button>
  );
  const dato = (label, valor) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontFamily: SF, fontSize: 28, color: C.gold, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "#C9C0B0", marginTop: 2 }}>{label}</div>
    </div>
  );

  // Rejilla lunes-domingo
  const celdas = useMemo(() => {
    const primero = new Date(mes.a, mes.m, 1); const hueco = (primero.getDay() + 6) % 7;
    const out = Array(hueco).fill(null);
    for (let d = 1; d <= ultimoDia(mes.a, mes.m); d++) out.push(ymd(new Date(mes.a, mes.m, d)));
    return out;
  }, [mes]);

  const etiqueta = (d) => [
    d.festivo && d.plus > 0 ? `Festivo +${eur2(d.plus)}` : null,
    d.hExtra > 0 ? `+${hTxt(d.hExtra)} h extra` : null,
    pendientes[d.fecha] ? `+${hTxt(pendientes[d.fecha])} h pendiente` : null,
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
      <div style={{ background: C.char, borderRadius: 18, padding: "14px 14px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {flecha(-1, "Mes anterior", false)}
          <div style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: "#fff" }}>{MESES[mes.m]} {mes.a}</div>
          {flecha(1, "Mes siguiente", enLimite)}
        </div>
        <div style={{ display: "flex", marginTop: 12 }}>
          {dato(res && res.dias === 1 ? "día trabajado" : "días trabajados", res ? res.dias : "–")}
          {dato("horas", res ? hTxt(res.horas) : "–")}
          {dato("ganado", res ? `≈ ${eur0(res.importe)}` : "–")}
        </div>
      </div>

      <div role="group" aria-label="Vista" style={{ display: "flex", gap: 4, background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 13, padding: 3 }}>
        {[["calendario", "Calendario"], ["lista", "Lista"]].map(([id, l]) => (
          <button key={id} onClick={() => setVista(id)} aria-pressed={vista === id} style={{ flex: 1, minHeight: 38, border: "none", borderRadius: 10, cursor: "pointer", background: vista === id ? "#F3EEE4" : "transparent", color: C.char, fontFamily: F, fontSize: 13.5, fontWeight: vista === id ? 700 : 600 }}>{l}</button>
        ))}
      </div>

      {error && <div style={{ fontFamily: F, fontSize: 13, color: C.red, background: "#FBEAE7", borderRadius: 12, padding: "10px 12px" }}>No se han podido cargar tus turnos de este mes. Comprueba la conexión.</div>}

      {!res ? <div style={{ fontFamily: F, fontSize: 13, color: C.mut, textAlign: "center", padding: 24 }}>Cargando…</div>
        : vista === "calendario" ? (
          <div style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {SEMANA.map((s) => <div key={s} style={{ textAlign: "center", fontFamily: F, fontSize: 11, fontWeight: 700, color: C.mutL }}>{s}</div>)}
              {celdas.map((f, i) => {
                if (!f) return <div key={`h${i}`} />;
                const d = porFecha[f]; const esHoy = f === hoyS;
                const relleno = d && d.estado === "trabajado"; const borde = d && d.estado === "proximo";
                return (
                  <button key={f} onClick={() => d && setDia(d)} disabled={!d} aria-label={`${fechaLarga(f)}${relleno ? ", trabajado" : borde ? ", próximo turno" : ""}`}
                    style={{ aspectRatio: "1", border: "none", background: "transparent", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: d ? "pointer" : "default" }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
                      background: relleno ? C.gold : esHoy ? "#F3EEE4" : "transparent", border: borde ? `2px solid ${C.gold}` : esHoy && !relleno ? `1.5px solid ${C.char}` : "none",
                      fontFamily: F, fontSize: 14, fontWeight: esHoy || d ? 700 : 500, color: relleno ? C.goldDark : d || esHoy ? C.char : C.mut }}>{Number(f.slice(8))}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 12.5, color: C.mut }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: C.gold }} />Trabajado</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 12.5, color: C.mut }}><span style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${C.gold}`, boxSizing: "border-box" }} />Próximo</span>
            </div>
          </div>
        ) : (
          <>
            {res.lineas.length === 0 && res.proximos.length === 0 ? (
              <div style={{ ...card, flexDirection: "column", alignItems: "center", textAlign: "center", padding: 24 }}>
                <IcoCalendar size={26} color={C.mutL} />
                <div style={{ fontFamily: F, fontSize: 14, color: C.mut }}>No tienes turnos este mes</div>
              </div>
            ) : (<>
              {res.lineas.length > 0 && <div style={seccion}>Trabajados</div>}
              {res.lineas.map((d) => (
                <div key={`t${d.fecha}`} style={{ ...card, padding: "12px 14px" }}>
                  <DateBlock f={d.fecha} />
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                    {d.turno ? <ShiftChip turno={d.turno} /> : <span style={{ fontFamily: F, fontSize: 13, fontWeight: 700, color: C.char }}>Horas extra</span>}
                    {d.turno && <span style={{ fontFamily: F, fontSize: 13.5, fontWeight: 600, color: C.char }}>{horarioDe(d.turno, d.fecha)} · {hTxt(d.horas)} h</span>}
                    {etiqueta(d).length > 0 && <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: C.goldSub }}>{etiqueta(d).join(" · ")}</span>}
                  </div>
                  <span style={{ fontFamily: F, fontSize: 15, fontWeight: 700, color: C.char, whiteSpace: "nowrap" }}>{eur2(d.importe)}</span>
                </div>
              ))}
              {res.proximos.length > 0 && <div style={seccion}>Próximos</div>}
              {res.proximos.map((d) => {
                const b = deBolsa[d.fecha]; const puedeSoltar = b && diasHasta(d.fecha) >= DIAS_SOLTAR;
                return (
                  <div key={`p${d.fecha}`} style={{ ...card, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <DateBlock f={d.fecha} />
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                        <ShiftChip turno={d.turno} />
                        <span style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: C.char }}>{horarioDe(d.turno, d.fecha)}</span>
                        <span style={{ fontFamily: F, fontSize: 12.5, color: C.mut }}>{hTxt(d.horas)} horas</span>
                      </div>
                    </div>
                    {puedeSoltar && <button onClick={() => onSoltar({ ...b, fecha: d.fecha, turno: d.turno })} style={{ alignSelf: "flex-start", minHeight: 38, padding: "0 12px", border: `1.5px solid ${C.brd}`, borderRadius: 11, background: "#fff", fontFamily: F, fontSize: 13, fontWeight: 600, color: C.char, cursor: "pointer" }}>Ya no puedo ir</button>}
                  </div>
                );
              })}
            </>)}
            <div style={{ fontFamily: F, fontSize: 12, color: C.mut, lineHeight: 1.45, padding: "2px 4px" }}>Importe bruto aproximado. El que vale es el de tu nómina. Las horas extra suman cuando dirección las confirma.</div>
          </>
        )}

      {dia && (
        <Hoja etiqueta="Día">
          <div style={{ fontFamily: SF, fontSize: 22, color: C.char }}>{fechaLarga(dia.fecha)}</div>
          <div style={{ background: C.cream, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><ShiftChip turno={dia.turno} /><span style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: C.char }}>{horarioDe(dia.turno, dia.fecha)}</span></div>
            <span style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>{hTxt(dia.horas)} horas de turno{dia.estado === "proximo" ? " · próximo turno" : ""}</span>
            {dia.festivo && <span style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>Festivo: {dia.festivo.nombre}{dia.plus > 0 ? ` · plus ${eur2(dia.plus)}` : " · en domingo no lleva plus"}</span>}
            {dia.hExtra > 0 && <span style={{ fontFamily: F, fontSize: 13.5, color: C.char }}>Horas extra confirmadas: {hTxt(dia.hExtra)} h</span>}
            {pendientes[dia.fecha] > 0 && <span style={{ fontFamily: F, fontSize: 13.5, color: C.mut }}>Horas extra pendientes: {hTxt(pendientes[dia.fecha])} h (no suman todavía)</span>}
            <span style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: C.char, marginTop: 4 }}>{dia.estado === "trabajado" ? `Importe del día: ${eur2(dia.importe)}` : `Si lo trabajas: ≈ ${eur2(dia.importe)}`}</span>
          </div>
          <div style={{ fontFamily: F, fontSize: 12, color: C.mut, lineHeight: 1.45 }}>Importe bruto aproximado. El que vale es el de tu nómina.</div>
          <button onClick={() => setDia(null)} style={{ ...btnDark, fontSize: 16 }}>Cerrar</button>
        </Hoja>
      )}
    </div>
  );
}
