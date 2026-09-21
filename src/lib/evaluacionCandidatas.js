// Sistema de evaluación de candidatas (dirección).
// TODA la plantilla vive aquí: ítems, textos, anclas 1/4, pesos, competencias,
// máximos, fórmula 20/80 y umbrales. La ajustaremos con el uso.
// calcularEvaluacion() es una función PURA que usan tanto la hoja (en vivo)
// como el ranking, a partir de los datos crudos guardados.

export const PUESTOS = [
  { id: "apoyo", label: "Apoyo · 28 h", corto: "Apoyo" },
  { id: "principal", label: "Principal · 40 h", corto: "Principal" },
];

// ---------- PARTE A · CV + llamada ----------
// Eliminatorios: cada uno indica qué respuesta descarta y el motivo visible.
export const ELIMINATORIOS = [
  { id: "L1", texto: "¿Puede trabajar con los ciclos rotativos de 3 semanas, incluidos 2 de cada 3 fines de semana y hasta las 23:00?", descartaSi: "no", motivo: "No puede con los turnos (rotativos · 2 de cada 3 findes · hasta 23:00)" },
  { id: "L2", texto: "¿Tiene una forma realista de llegar a la tienda en su horario?", ayuda: "En principal (40 h), también poder entrar a las 7:00.", descartaSi: "no", motivo: "Sin forma realista de llegar en su horario" },
  { id: "L4", texto: "¿Sigue buscando activamente trabajo de otra profesión y esto es «mientras tanto»?", descartaSi: "si", motivo: "Busca trabajo de su profesión (esto es «mientras tanto»)" },
];

// Informativos (no puntúan)
export const INFORMATIVOS = {
  L3: { texto: "Fecha en que puede incorporarse", tipo: "fecha" },
  L5: { texto: "¿Necesita jornada completa?", tipo: "sino", soloApoyo: true, avisaSi: "si", aviso: "quiere 40 h" },
  L6: { texto: "¿Hizo preguntas sobre el trabajo?", tipo: "sino", conNota: true },
};

// Puntuables de la Parte A
export const EXP_OPCIONES = [
  { v: 0, label: "Ninguna" },
  { v: 1, label: "Hostelería, limpieza, reponedora u otro trato con gente" },
  { v: 2, label: "Dependienta, caja, alimentación, comercio" },
];
export const TRANSPORTE_OPCIONES = [
  { v: 2, label: "Vehículo propio, o viene andando / en bici" },
  { v: 1, label: "Transporte público que cuadra con su horario" },
];
export const MAX_A = 6; // experiencia(0-2)×2 + transporte(1-2)×1

// ---------- PARTE B · Entrevista + prueba práctica ----------
export const ESCALA_B = "1 = justo lo que no queremos · 2 = floja o sin ejemplo · 3 = buena, con ejemplo concreto · 4 = excelente, con iniciativa propia";

// La entrevista es un paseo por la tienda, por paradas.
export const PARADAS = [
  { id: "entrada", label: "Parada 1 · Entrada", items: [
    { id: "T", texto: "Trato durante la visita (observado: cómo saluda a la compañera y a los clientes, si sonríe, escucha, es cercana).", a1: "Seca o distante, no saluda", a4: "Cercana y agradable de forma natural" },
  ] },
  { id: "caja", label: "Parada 2 · Caja", items: [
    { id: "P3", texto: "«Alguna vez te habrá tocado un cliente complicado, ¿cómo lo llevaste?»", a1: "Discutió, habla mal del cliente o «nunca me ha pasado»", a4: "Escuchó, mantuvo la calma y el cliente se fue bien" },
    { id: "P4", texto: "«¿Qué hace que alguien vuelva a una tienda de barrio en vez de ir al súper?»", a1: "Solo precio o producto", a4: "El trato: conocer al cliente, saludarle, ayudarle" },
  ] },
  { id: "baldas", label: "Parada 3 · Baldas", items: [
    { id: "P1", texto: "«En tu último trabajo, ¿qué hacías en los ratos sin clientes?»", a1: "«Esperaba», «lo que me mandaban», mirar el móvil", a4: "Reponía, limpiaba o revisaba fechas sin que se lo pidieran" },
    { id: "P2", texto: "«¿Qué era lo que menos te gustaba hacer allí? ¿Cómo lo llevabas?»", a1: "La evitaba o la dejaba a otros", a4: "La hacía igual, con método, incluso más rápido" },
  ] },
  { id: "mostrador", label: "Parada 4 · Mostrador", items: [
    { id: "P5", texto: "«Estás en caja, hay cola, tu compañera está en el almacén y alguien pide que le cortes fiambre. ¿Qué harías?»", a1: "Se bloquea o «le digo que espere» sin más", a4: "Avisa a la compañera, informa al cliente y organiza la cola" },
  ] },
  { id: "almacen", label: "Parada 5 · Almacén", items: [
    { id: "P6", texto: "«¿Te acuerdas de algún despiste tuyo en un trabajo? ¿Qué pasó luego?»", a1: "Culpa a otros o «nunca me equivoco»", a4: "Lo reconoció, avisó, lo arregló y cambió algo para que no se repitiera" },
  ] },
  { id: "cierre", label: "Parada 6 · Cierre", items: [
    { id: "P7", texto: "«¿Qué te gusta de trabajar en tienda? ¿Cómo te ves de aquí a unos años?»", a1: "«Mientras encuentro algo de lo mío»", a4: "Le gusta el comercio y quiere aprender más o asumir responsabilidad" },
    { id: "P8", soloPrincipal: true, texto: "«¿Te ha tocado estar sola, abrir, cerrar o cuadrar caja? ¿Cómo lo hacías?»", a1: "Nunca y le da inseguridad", a4: "Sí, con pasos claros, y sabe qué hacer si la caja no cuadra" },
  ] },
];

export const PRUEBA = {
  label: "Prueba práctica con las trabajadoras",
  ayuda: "30 min, después de la entrevista. Si puntúan dos trabajadoras, mete la media (permite .5).",
  items: [
    { id: "Wp", texto: "Proactividad", a1: "Se queda quieta esperando instrucciones", a4: "Pregunta «¿qué hago ahora?» o se pone con algo por su cuenta" },
    { id: "Wt", texto: "Trato al público", a1: "No mira ni saluda a los clientes, o lo hace seca", a4: "Saluda, sonríe y se acerca a ayudar aunque no sepa aún" },
    { id: "Wa", texto: "Aprendizaje", a1: "Hay que repetirle lo mismo y no pregunta", a4: "Lo aplica a la primera, pregunta lo que no entiende" },
  ],
};
export const ITEMS_MEDIA = ["Wp", "Wt", "Wa"]; // admiten decimales .5

// Competencias: media de sus notas × peso. Autonomía solo en principal.
export const COMPETENCIAS = [
  { id: "proactividad", label: "Proactividad", notas: ["P1", "P2", "Wp"], peso: 3 },
  { id: "trato", label: "Trato al público", notas: ["P3", "P4", "T", "Wt"], peso: 3 },
  { id: "aprendizaje", label: "Aprendizaje", notas: ["Wa"], peso: 2 },
  { id: "resolucion", label: "Resolución", notas: ["P5"], peso: 2 },
  { id: "fiabilidad", label: "Fiabilidad", notas: ["P6"], peso: 2 },
  { id: "compromiso", label: "Compromiso con el sector", notas: ["P7"], peso: 2 },
  { id: "autonomia", label: "Autonomía", notas: ["P8"], peso: 2, soloPrincipal: true },
];

export const UMBRALES = [
  { min: 75, id: "a_contratar", label: "A contratar", fg: "#1E7A46", bg: "#E7F3EC" },
  { min: 60, id: "reserva", label: "Reserva", fg: "#8a6a1e", bg: "#FBF0DA" },
  { min: 0, id: "no", label: "No", fg: "#B23A2C", bg: "#FBEAE7" },
];

export const RESULTADO_L = {
  en_curso: "Evaluación incompleta",
  completa: "Evaluada",
  descartada_eliminatorio: "Descartada (eliminatorio)",
  descartada_actitud: "Descartada por actitud",
};

const num = (v) => (v === 0 || v ? Number(v) : null);
const media = (arr) => { const xs = arr.map(num).filter((v) => v !== null && !Number.isNaN(v)); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
const r1 = (n) => Math.round(n * 10) / 10;

export function comps(puesto) { return COMPETENCIAS.filter((c) => !c.soloPrincipal || puesto === "principal"); }
export function maxB(puesto) { return comps(puesto).reduce((s, c) => s + c.peso * 4, 0); }
export function itemsB(puesto) {
  const ids = [];
  PARADAS.forEach((p) => p.items.forEach((it) => { if (!it.soloPrincipal || puesto === "principal") ids.push(it.id); }));
  PRUEBA.items.forEach((it) => ids.push(it.id));
  return ids;
}
export function etiquetaDe(nota) { return nota == null ? null : UMBRALES.find((u) => nota >= u.min); }

// Función pura. Devuelve todo lo necesario para la hoja y el ranking.
export function calcularEvaluacion(puesto, parteA = {}, parteB = {}) {
  puesto = puesto === "principal" ? "principal" : "apoyo";
  const falta = [];

  // Eliminatorios (aplican en cuanto se responden)
  let descarte = null;
  for (const e of ELIMINATORIOS) {
    if (parteA[e.id] === e.descartaSi) { descarte = { tipo: "descartada_eliminatorio", motivo: e.motivo }; break; }
  }

  const aviso40h = puesto === "apoyo" && parteA.L5 === "si";

  // Total A
  const exp = num(parteA.exp);
  const transporte = num(parteA.transporte);
  const totalA = (exp == null ? 0 : exp * 2) + (transporte == null ? 0 : transporte * 1);
  const elimOk = ELIMINATORIOS.every((e) => parteA[e.id] === "si" || parteA[e.id] === "no");
  const aCompleta = elimOk && exp != null && transporte != null;
  if (!elimOk) falta.push("eliminatorios (A)");
  if (exp == null) falta.push("experiencia (A)");
  if (transporte == null) falta.push("transporte (A)");

  // Competencias / Total B
  const cs = comps(puesto);
  const compMedias = {};
  cs.forEach((c) => { compMedias[c.id] = media(c.notas.map((n) => parteB[n])); });
  const req = itemsB(puesto);
  const faltanB = req.filter((id) => num(parteB[id]) == null);
  const bCompleta = faltanB.length === 0;
  if (!bCompleta) falta.push("entrevista/prueba (B)");
  const totalB = cs.reduce((s, c) => s + (compMedias[c.id] == null ? 0 : compMedias[c.id] * c.peso), 0);

  // Descarte por actitud (solo con la Parte B completa, para no descartar a medias)
  const mProac = compMedias.proactividad;
  const mTrato = compMedias.trato;
  if (!descarte && bCompleta && ((mProac != null && mProac < 2) || (mTrato != null && mTrato < 2))) {
    descarte = { tipo: "descartada_actitud", motivo: "Actitud por debajo del mínimo (Proactividad o Trato < 2)" };
  }

  const completa = aCompleta && bCompleta;
  const mxB = maxB(puesto);
  const notaFinal = completa ? r1(20 * (totalA / MAX_A) + 80 * (totalB / mxB)) : null;
  const etiqueta = descarte ? null : etiquetaDe(notaFinal);

  let resultado;
  if (descarte) resultado = descarte.tipo;
  else if (completa) resultado = "completa";
  else resultado = "en_curso";

  return {
    puesto,
    totalA: Math.round(totalA * 100) / 100,
    totalB: Math.round(totalB * 100) / 100,
    maxB: mxB,
    notaFinal,
    etiqueta,
    resultado,
    motivoDescarte: descarte ? descarte.motivo : null,
    descartada: !!descarte,
    aCompleta, bCompleta, completa,
    aviso40h,
    compMedias,
    falta,
    sumaW: ITEMS_MEDIA.reduce((s, n) => s + (num(parteB[n]) || 0), 0),
    exp: exp == null ? 0 : exp,
  };
}
