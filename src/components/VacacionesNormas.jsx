import { F, SF, C } from "../lib/styles.js";

// Protocolo de vacaciones v2.0 (en vigor desde el 15/11/2026; rige para las vacaciones de 2027 en adelante).
const SECCIONES = [
  { t: "Cuántos días tienes", p: "Desde 2027, 31 días naturales al año (del 1 de enero al 31 de diciembre): cuenta cada día del periodo, se trabajara o se descansara ese día. Iguales para jornadas de 40 y de 28 horas." },
  { t: "Cómo se reparten", p: "Obligatorio: 2 semanas en verano (14 días), 1 semana en primavera (7 días), 1 semana en otoño (7 días) y 3 días sueltos. Las semanas son completas, de lunes a domingo, y no se pueden cambiar por días sueltos." },
  { t: "Las tres ventanas de elección", p: "Del 15 al 30 de noviembre: tus dos bloques de verano del año siguiente. Del 1 al 15 de diciembre: tu semana de primavera (entre marzo y mayo). Del 1 al 15 de marzo: tu semana de otoño (entre septiembre y noviembre). Cuando hay una ventana abierta, la tienes lo primero en «Mis vacaciones», con los días de plazo que te quedan; puedes cambiar tu elección hasta el último día. Te avisamos por la campana y el correo al abrir y, si aún no has presentado, a 3 días del cierre." },
  { t: "Verano: los bloques", p: "Siete bloques fijos de dos semanas, de lunes a domingo, que dirección publica cada año. Eliges un bloque principal y uno secundario; los dos son obligatorios. Si varias pedís el mismo, se sortea y quien pierde pasa a su secundario. Quien no presenta sus bloques en plazo pasa la última en el reparto y se le asigna lo que quede libre." },
  { t: "Primavera y otoño: la semana", p: "Eliges una semana libre dentro de la temporada. Si coincidís varias que la presentasteis en plazo, dirección lo resuelve al cerrar la ventana, con sorteo. Si no la presentas en plazo puedes elegirla después, pero sin prioridad: solo entre las semanas que no haya pedido en plazo ninguna compañera." },
  { t: "Días sueltos", p: "3 al año. Se piden con al menos un mes de antelación y se pueden pedir de uno en uno. Fuera de las ventanas es lo único que se puede pedir." },
  { t: "Fechas cerradas", p: "No se conceden vacaciones del 24 de diciembre al 6 de enero, ni durante la Semana Santa completa (dirección publica las fechas exactas)." },
  { t: "Cuántas a la vez", p: "Una persona de vacaciones a la vez, y nunca más de dos en el mismo mes natural." },
  { t: "Respuesta de dirección", p: "Máximo 15 días naturales, siempre por escrito. Si se deniega, se te da el motivo concreto y puedes proponer fechas alternativas." },
  { t: "Una vez aprobadas", p: "Son firmes: no se tocan salvo acuerdo entre tú y dirección. Buscar quien cubra tu turno es responsabilidad de la empresa, nunca tuya." },
  { t: "Lo que queda de 2026", p: "Los días que te queden de 2026 se piden como hasta ahora, hasta el 23 de diciembre: 22 días laborables (los descansos no restan), 45 días de antelación (90 en verano) y al menos 2 días de trabajo por petición." },
];

export function VacacionesNormas({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 30px" }}>
        <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
        <div style={{ fontFamily: SF, fontSize: 22, color: C.char }}>Normas de vacaciones</div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 3, marginBottom: 18 }}>Protocolo de vacaciones v2.0 · en vigor desde el 15/11/2026, para las vacaciones de 2027</div>
        {SECCIONES.map((s, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: C.char, marginBottom: 4 }}>{s.t}</div>
            <div style={{ fontFamily: F, fontSize: 13, color: C.mut, lineHeight: 1.5 }}>{s.p}</div>
          </div>
        ))}
        <div style={{ fontFamily: F, fontSize: 12, color: C.mutL, lineHeight: 1.5, marginTop: 6, padding: "12px 14px", background: "#fff", border: `1px solid ${C.brdL}`, borderRadius: 12 }}>Este es un resumen. Ante cualquier duda, pregunta a dirección antes de solicitar: preguntar siempre sale más barato que una solicitud denegada.</div>
        <button onClick={onClose} style={{ width: "100%", marginTop: 16, background: C.char, color: C.gold, border: "none", borderRadius: 13, padding: 14, fontFamily: SF, fontSize: 16, cursor: "pointer" }}>Entendido</button>
      </div>
    </div>
  );
}
