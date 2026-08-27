import { F, SF, C } from "../lib/styles.js";

const SECCIONES = [
  { t: "Cuántos días tienes", p: "22 días laborables al año (del 1 de enero al 31 de diciembre). Solo se descuentan los días en los que te tocaba trabajar: si dentro de tus vacaciones cae un descanso, ese día no te resta saldo." },
  { t: "Cómo repartir los 22 días", p: "Obligatorio: 2 semanas seguidas en verano (entre el 15/6 y el 15/9) y 1 semana seguida en el resto del año. El saldo que te quede, en días sueltos o semanas completas. Cada petición de días sueltos debe incluir al menos 2 días de trabajo; no se concede un solo turno." },
  { t: "Cuándo pueden empezar", p: "Un periodo no puede empezar en domingo, festivo ni en tu día de descanso: tiene que arrancar en un día en el que te tocara trabajar." },
  { t: "Con cuánta antelación pedirlas", p: "45 días en general. 90 días si las fechas caen entre el 15/6 y el 15/9. El bloque de 2 semanas de verano se pide en una ventana fija: del 1 al 15 de marzo." },
  { t: "Fechas cerradas", p: "No se conceden vacaciones del 24 de diciembre al 6 de enero, ni durante la Semana Santa completa (dirección publica las fechas exactas en enero). El último día del año para disfrutar vacaciones es el 23 de diciembre." },
  { t: "Cuántas a la vez", p: "Como máximo dos personas: una de turno principal y una de apoyo. Nunca dos del mismo tipo de turno. Antes de pedir puedes ver si el cupo de tu rol está libre en esas fechas." },
  { t: "Si dos pedís las mismas fechas", p: "Se decide por rotación anual (si una lo disfrutó el año pasado, este año cede), luego por orden de llegada y, en último caso, por sorteo delante de las dos." },
  { t: "Respuesta de dirección", p: "Máximo 15 días naturales, siempre por escrito. Si se deniega, se te da el motivo concreto y puedes proponer fechas alternativas." },
  { t: "Una vez aprobadas", p: "Son firmes: no se tocan salvo acuerdo entre tú y dirección. Buscar quien cubra tu turno es responsabilidad de la empresa, nunca tuya." },
  { t: "Fechas tope", p: "A 30 de septiembre debes tener solicitado todo tu saldo del año. Lo que quede sin pedir lo asigna dirección, preguntándote antes y comunicándotelo por escrito antes del 5 de octubre." },
];

export function VacacionesNormas({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,26,20,0.5)", zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cream, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "18px 18px 30px" }}>
        <div style={{ width: 40, height: 4, background: C.brd, borderRadius: 999, margin: "0 auto 16px" }} />
        <div style={{ fontFamily: SF, fontSize: 22, color: C.char }}>Normas de vacaciones</div>
        <div style={{ fontFamily: F, fontSize: 12, color: C.mut, marginTop: 3, marginBottom: 18 }}>Protocolo de Recao · en vigor desde el 1/9/2026</div>
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
