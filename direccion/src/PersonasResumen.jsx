import { useEffect, useState } from "react";
import { sb } from "../../src/lib/supabase.js";
import { ymd, TURNOS, TURNO_OPCIONES } from "../../src/lib/turnos.js";
import { huecosCobertura } from "../../src/lib/cobertura.js";

const LIBRES = new Set(["Descanso", "Vacaciones", "Baja", "Permiso"]);
const masDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const diaCorto = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

// Agrupa días seguidos de vacaciones de cada persona en tramos
function tramos(filas) {
  const porPersona = {};
  filas.forEach((h) => { (porPersona[h.usuario_id] ||= []).push(h.fecha); });
  const out = [];
  Object.entries(porPersona).forEach(([uid, fechas]) => {
    fechas.sort();
    let ini = fechas[0], fin = fechas[0];
    for (let i = 1; i <= fechas.length; i++) {
      const f = fechas[i];
      const sig = new Date(`${fin}T12:00:00`); sig.setDate(sig.getDate() + 1);
      if (f && f === ymd(sig)) { fin = f; continue; }
      out.push({ uid, ini, fin });
      ini = fin = f;
    }
  });
  return out.sort((a, b) => a.ini.localeCompare(b.ini));
}

function Turnos({ titulo, filas, nombres }) {
  const trabajan = filas.filter((h) => !LIBRES.has(h.turno))
    .sort((a, b) => TURNO_OPCIONES.indexOf(a.turno) - TURNO_OPCIONES.indexOf(b.turno));
  const fuera = filas.filter((h) => LIBRES.has(h.turno));
  return (
    <div className="card c6">
      <h2>{titulo}</h2>
      {trabajan.length === 0 ? <p className="empty">Sin turnos puestos.</p> : (
        <ul className="turnos">
          {trabajan.map((h) => (
            <li key={h.usuario_id + h.turno}>
              <span className="chip" style={{ background: TURNOS[h.turno]?.bg, color: TURNOS[h.turno]?.fg }}>{h.turno}</span>
              <b>{nombres[h.usuario_id] || "—"}</b>
              <span className="h">{TURNOS[h.turno]?.horas}</span>
            </li>
          ))}
        </ul>
      )}
      {fuera.length > 0 && <p className="sub fuera">Libran: {fuera.map((h) => `${nombres[h.usuario_id] || "—"} (${h.turno.toLowerCase()})`).join(", ")}</p>}
    </div>
  );
}

export function PersonasResumen() {
  const [d, setD] = useState(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const hoy = ymd(new Date()), manana = masDias(1);
        const [usuarios, vac, cambios, hor] = await Promise.all([
          sb.select("usuarios", "select=id,nombre,rol,activo"),
          sb.select("vacaciones_solicitudes", "select=id&estado=eq.pendiente"),
          sb.select("cambios_turno", "select=id&estado=eq.pendiente"),
          sb.select("horarios", `select=usuario_id,fecha,turno&fecha=gte.${hoy}&fecha=lte.${masDias(60)}`),
        ]);
        const nombres = Object.fromEntries(usuarios.map((u) => [u.id, u.nombre]));
        const huecos = huecosCobertura(hor);
        setD({
          nombres,
          equipo: usuarios.filter((u) => u.activo && u.rol === "trabajadora").length,
          vac: vac.length, cambios: cambios.length,
          diasSinCubrir: new Set(huecos.map((h) => h.fecha)).size,
          primerHueco: huecos.map((h) => h.fecha).sort()[0],
          hoy: hor.filter((h) => h.fecha === hoy),
          manana: hor.filter((h) => h.fecha === manana),
          vacaciones: tramos(hor.filter((h) => h.turno === "Vacaciones" && h.fecha <= masDias(45))),
        });
      } catch (e) { setFallo(true); }
    })();
  }, []);

  if (fallo) return <div className="state">No se han podido cargar los datos. Recarga la página en un momento.</div>;
  if (!d) return <div className="state">Cargando…</div>;

  const avisos = [
    d.vac > 0 && { n: d.vac, t: `solicitud${d.vac > 1 ? "es" : ""} de vacaciones por revisar`, ruta: "personas/vacaciones" },
    d.diasSinCubrir > 0 && { n: d.diasSinCubrir, t: `día${d.diasSinCubrir > 1 ? "s" : ""} con turnos sin cubrir${d.primerHueco ? `, el primero el ${diaCorto(d.primerHueco)}` : ""}`, ruta: "personas/cobertura" },
    d.cambios > 0 && { n: d.cambios, t: `cambio${d.cambios > 1 ? "s" : ""} de turno por revisar`, ruta: "personas/cambios" },
  ].filter(Boolean);

  return (
    <>
      <section className="avisos" aria-label="Necesita tu atención">
        {avisos.length === 0 ? (
          <div className="aviso ok"><b>✓</b><span>Nada pendiente: vacaciones, cambios de turno y cobertura están al día.</span></div>
        ) : avisos.map((a) => (
          <a key={a.ruta} className="aviso" href={`#/${a.ruta}`}><b>{a.n}</b><span>{a.t}</span><i aria-hidden="true">→</i></a>
        ))}
      </section>

      <div className="grid">
        <Turnos titulo="Hoy en tienda" filas={d.hoy} nombres={d.nombres} />
        <Turnos titulo="Mañana" filas={d.manana} nombres={d.nombres} />
        <div className="card c6">
          <h2>Vacaciones próximas</h2>
          <p className="sub">Siguientes 45 días</p>
          {d.vacaciones.length === 0 ? <p className="empty">Nadie de vacaciones.</p> : (
            <ul className="pq-l">
              {d.vacaciones.slice(0, 8).map((v) => (
                <li key={v.uid + v.ini}><span className="pn">{d.nombres[v.uid] || "—"}</span><span>{v.ini === v.fin ? diaCorto(v.ini) : `${diaCorto(v.ini)} → ${diaCorto(v.fin)}`}</span></li>
              ))}
            </ul>
          )}
          {d.vacaciones.length > 8 && <p className="sub"><a href="#/personas/horarios">y {d.vacaciones.length - 8} más en Horarios</a></p>}
        </div>
        <div className="card c6">
          <h2>Equipo</h2>
          <p className="num">{d.equipo}</p>
          <p className="sub">personas activas en la app</p>
          <p className="sub proximo">Próximamente aquí: coste de personal y venta por hora trabajada.</p>
        </div>
      </div>
    </>
  );
}
