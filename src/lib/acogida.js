// #241 · #242: textos y cuentas de la acogida en los días de formación. Los usan el panel (Personas → Selección → Acogida)
// y la app de la principal del turno (inicio y cierre de turno): una sola versión de los guiones y de «Lo que llevamos».
const masDias = (f, n) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// #241: un guion por cada día de formación (protocolo de dirección, tal cual). {N} = la nueva · {SOLA} = el día que entra sola
export const DIAS_TXT = [
  { tit: "Que no se sienta sola", preg: "¿Qué te ha sorprendido?",
    guion: "Hoy entra {N} y la llevas tú. Es su primer día.\n\nTu trabajo no es enseñarle todo, es que no esté sola en ningún momento.\n\n· Preséntasela a todo el que esté, por su nombre.\n· Que te siga y ve contándole lo que haces.\n· A mitad de turno dale una tarea entera suya.\n· Preséntala a los clientes habituales.\n· Que no toque caja sola: que cobre contigo al lado.\n· Pregúntale cada rato si va bien.\n\nAntes de que se vaya, las tres preguntas. Y me cuentas en tres líneas cómo ha ido." },
  { tit: "La tienda trabajando", preg: "¿Qué has hecho hoy que ayer no sabías hacer?",
    guion: "Hoy es el día 2 de {N}. Toca la tienda trabajando.\n\n· Que repita la tarea de ayer, pero entera y empezándola ella.\n· Reposición de una zona de arriba abajo: de dónde se coge, cómo se coloca, qué se mira de fechas.\n· Que cobre dos o tres veces contigo al lado. En caja sola, todavía no.\n· Que fiche ella, sin que se lo recuerdes.\n\nUna cosa nueva al día basta: no le des tres. Y si pregunta lo de ayer, normal: el día 2 se olvida casi todo del día 1.\n\nAntes de que se vaya, las tres preguntas y las tres líneas." },
  { tit: "Caja y paquetería", preg: "¿Qué es lo que más miedo te da hacer sola?",
    guion: "Hoy es el día 3 de {N}. Toca lo que da miedo: caja y paquetería.\n\n· Caja cobrando ella, contigo al lado: devoluciones, tarjeta, lo que se atasca.\n· Paquetería: picar, dónde se deja, qué hacer si no aparece un paquete.\n· Repítele hoy qué hace si se equivoca cobrando: decirlo en el momento, no arreglarlo sola.\n· Las primeras tareas del cierre: reponer lo vendido y la limpieza. El cierre entero, mañana.\n\nNo la dejes en caja sin nadie cerca, aunque parezca que va suelta.\n\nAntes de que se vaya, las tres preguntas y las tres líneas." },
  { tit: "Como si fuera suyo", preg: "¿Qué harías mañana si no hubiera nadie a quien preguntar?",
    guion: "Hoy es el último día de formación de {N}. Hoy NO le enseñas: la miras.\n\n· Que haga el turno como si fuera suyo, de principio a fin, y el cierre entero.\n· No intervengas salvo que haga falta de verdad. Si lo haces tú por ella, no sabremos si puede sola.\n· Apunta qué hace sola, qué pregunta y dónde se queda parada. Se lo dices al final, no sobre la marcha.\n\nEsto es lo más importante que te pido de los cuatro días: {SOLA} entra sola.\n\nAntes de que se vaya, las tres preguntas y las tres líneas. Yo me paso al final del turno." },
];
// Si hay más de cuatro días de formación, los de más llevan el guion del día 4 (el orden y el contenido no cambian)
export const txtDia = (n) => DIAS_TXT[Math.min(Math.max(n, 1), DIAS_TXT.length) - 1];
export const PREG_FIJAS = ["«¿Qué NO has entendido hoy?»", "«¿Qué necesitas para mañana?»"];
export const LINEAS = ["¿Se ha soltado o ha ido a remolque?", "¿Qué le ha costado más?", "¿La ves lista para mañana?"];
export const dias = (a) => a.dias || [];
export const parteDe = (a, d) => (a.partes || []).find((p) => p.fecha === d?.fecha) || null;
export const nombreCorto = (s) => (s || "").split(" ")[0];
export const diaSemana = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long" });
export const diaSola = (a) => (a.primer_sola ? `el ${diaSemana(a.primer_sola)}` : "en cuanto acabe la formación");
export const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
export const listaDias = (ns) => (ns.length === 1 ? `día ${ns[0]}` : `días ${ns.slice(0, -1).join(", ")} y ${ns[ns.length - 1]}`);
export const COMO = { suelta: "Se soltó", remolque: "A remolque" };

// «Lo que llevamos» para el día d (solo días 2 en adelante). Las respuestas de la nueva y el parte de la compañera van en líneas separadas.
export function loQueLlevamos(a, d) {
  if (!d || d.n < 2) return null;
  const previos = dias(a).filter((x) => x.n < d.n);
  const ant = previos[previos.length - 1];
  const pAnt = parteDe(a, ant);
  let no = null;
  if (pAnt?.no_entendido) {
    const clave = normal(pAnt.no_entendido);
    const ns = previos.filter((x) => clave && normal(parteDe(a, x)?.no_entendido) === clave).map((x) => x.n);
    no = { texto: pAnt.no_entendido.trim(), dias: listaDias(ns.length ? ns : [ant.n]), insiste: ns.length >= 2 };
  }
  const hist = previos.map((x) => ({ n: x.n, como: parteDe(a, x)?.como_ha_ido || null }));
  const c1 = hist[hist.length - 1]?.como, c2 = hist[hist.length - 2]?.como;
  const ayer = ant && masDias(ant.fecha, 1) === d.fecha ? "Ayer" : `El día ${ant?.n}`;
  // Las tres reglas del consejo, y ninguna más
  const consejo = c1 === "remolque" && c2 === "remolque" ? "Lleva dos días a remolque: avísame hoy mismo de cómo va."
    : c1 === "remolque" ? `${ayer} fue a remolque. Hoy no corras: media cosa bien hecha vale más que tres a medias.`
    : c1 === "suelta" ? `${ayer} se soltó. Hoy puedes darle más cuerda, pero no la dejes sola en caja.` : null;
  return { ant, no, pide: pAnt?.necesita?.trim() || null, hist, consejo, hayAlgo: !!(pAnt || hist.some((h) => h.como)) };
}
export function textoLlevamos(L) {
  if (!L || !L.hayAlgo) return "";
  const l = ["LO QUE LLEVAMOS"];
  l.push(`· Sigue sin entender: ${L.no ? `${L.no.texto} (${L.no.dias})${L.no.insiste ? " ← lleva dos días con esto" : ""}` : "sin apuntar"}`);
  l.push(`· Pidió para hoy: ${L.pide || "sin apuntar"}`);
  l.push(`· Cómo ha ido: ${L.hist.map((h) => `Día ${h.n} ${h.como ? COMO[h.como].toLowerCase() : "sin parte"}`).join(" → ")}`);
  if (L.consejo) l.push(`· ${L.consejo}`);
  return l.join("\n") + "\n\n";
}
export const guionDia = (a, d) => txtDia(d.n).guion.replaceAll("{N}", nombreCorto(a.nombre)).replaceAll("{SOLA}", diaSola(a));
export const textoCopiar = (a, d) => textoLlevamos(loQueLlevamos(a, d)) + guionDia(a, d);
