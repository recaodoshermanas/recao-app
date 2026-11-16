// Sistema de evaluación de candidatas (dirección).
// TODA la plantilla vive aquí: ítems, textos, referencias 1/4, pesos, competencias,
// máximos, fórmula 20/80 y umbrales. La ajustaremos con el uso.
// Plantilla 2 (noviembre 2026, #210): entrevista de una hora en la tienda con
// nueve preguntas y cinco ejercicios. Los textos están copiados literalmente de
// la ficha de selección. Las evaluaciones guardadas con la plantilla anterior
// (septiembre) se muestran congeladas: no se recalculan.
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
// Campo de texto de la llamada (plantilla 2, no puntúa)
export const CAMPO_LLAMADA = {
  id: "pregunto_llamada",
  label: "¿Qué preguntó en la llamada?",
  ayuda: "Quien es inquieta se nota aquí: quiere saber qué va a hacer, cómo es el equipo, qué se vende. Quien solo pregunta por sueldo y horario también dice algo. No descarta.",
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

// ---------- PARTE B · La entrevista (plantilla 2) ----------
export const PLANTILLA_ACTUAL = 2;

export const ESCALA_B = "1 = justo lo que no queremos · 2 = floja, general o sin ejemplo · 3 = buena, con criterio · 4 = excelente, con iniciativa propia";

export const AVISO_EJERCICIOS = "No se puntúa si lo hace bien, se puntúa cómo aprende: cuántas veces hay que repetirle lo mismo, si pregunta, si se da cuenta sola de que se ha equivocado, y sobre todo si mejora del primer intento al último.";
export const AVISO_COMPANERA = "Las pone la trabajadora que le enseñó la paquetería y la vio en la caja con clientes. Si fueron dos, la media.";

export const CAMPO_PERFIL = {
  id: "perfil",
  label: "Frase de perfil",
  ayuda: "Sale de Q3 y Q4. Por ejemplo: De tarea más que de gente, metódica, necesita que le marquen el principio. Mejor apoyo que principal, y mejor mañana que tarde.",
};

// Ítems. refs = cómo suena cada nota (siempre 1 y 4; algunos también 2 y 3).
// tipo: "nota" (1-4 enteros), "media" (admite .5, notas de la compañera),
// "descriptiva" (no puntúa, opciones).
export const ITEMS = {
  T: { cod: "T", titulo: "Trato", sub: "se pone al final, con lo visto durante toda la hora", consigna: "Cómo saluda a las compañeras y a los clientes, si sonríe, si escucha, si mira a los ojos.", refs: { 1: "Seca o distante", 4: "Cercana y agradable de forma natural" } },
  E1: { cod: "E1", titulo: "El móvil", consigna: "Se le da un móvil con la app abierta en una cuenta de prueba: «esto es lo que vas a usar todos los días, échale un vistazo». Luego dos encargos, sin explicarle cómo se hace: «a ver si encuentras tu horario de esta semana» y «ahora marca estas dos tareas como hechas, y en esta otra pon que no se ha podido hacer y por qué». Te quedas callado y miras.", refs: { 1: "No se atreve a tocar, espera que le digan paso por paso, o dice que con el móvil se maneja mal", 2: "Lo saca con ayuda continua; escribe muy despacio o se pierde al cambiar de pantalla", 3: "Lo saca sola en un par de intentos, preguntando lo justo", 4: "Va sola y rápida, entiende la lógica a la primera, y hasta comenta algo de la app o pregunta para qué sirve otra parte" } },
  Q1: { cod: "Q1", titulo: "Compromiso", pregunta: "«¿Cómo acabaste trabajando en tienda?»", refs: { 1: "«Mientras encuentro algo de lo mío», o llegó por casualidad y le da igual", 4: "Le gusta el comercio, cuenta por qué se quedó y quiere aprender más" } },
  Q2: { cod: "Q2", titulo: "Trato", pregunta: "«Cuando entras tú de clienta en una tienda, ¿qué hace que vuelvas?»", refs: { 1: "Solo precio o que haya de todo", 4: "El trato: que la conozcan, que la saluden, que le resuelvan" } },
  Q3: { cod: "Q3", titulo: "No puntúa (descriptiva)", tipo: "descriptiva", pregunta: "«¿Qué llevas mejor: mostrador atendiendo toda la mañana, o que te dejen el almacén y organizarlo tú?»", opciones: [{ v: "mostrador", label: "Mostrador" }, { v: "almacen", label: "Almacén" }, { v: "las_dos", label: "Las dos por igual" }], ayuda: "Dice si es de gente o de tarea. No hay respuesta buena ni mala." },
  Q4: { cod: "Q4", titulo: "No puntúa (descriptiva)", tipo: "descriptiva", pregunta: "«¿Prefieres que te digan lo que hay que hacer, o que te den la tienda y te apañes?»", opciones: [{ v: "que_le_marquen", label: "Que le marquen" }, { v: "que_la_dejen", label: "Que la dejen" }, { v: "las_dos", label: "Las dos" }], ayuda: "Es lo que decide apoyo o principal, porque la principal se queda sola a ratos. No hay respuesta buena ni mala." },
  Q5: { cod: "Q5", titulo: "Proactividad", pregunta: "«¿Cómo sabías que habías tenido un buen día de trabajo?»", refs: { 1: "«Cuando se pasaba rápido», «cuando no había broncas», «cuando no me tocaba cerrar»", 4: "«Cuando salía con todo repuesto», «cuando dejaba la cámara ordenada»" } },
  Q6: { cod: "Q6", titulo: "Aprendizaje", pregunta: "«Cuéntame algo que aprendieras en el trabajo que al principio se te diera fatal.»", refs: { 1: "No recuerda nada, o lo cuenta como que se lo enseñaron mal", 4: "Cuenta qué hizo para aprenderlo y qué tal se le da ahora" } },
  Q7: { cod: "Q7", titulo: "Proactividad", pregunta: "«¿Qué hacía la mejor compañera que has tenido?»", refs: { 1: "«Era muy maja y nos reíamos»: su listón es la convivencia", 4: "«No paraba, siempre te dejaba el trabajo adelantado»: su listón es sacar trabajo" } },
  Q8: { cod: "Q8", titulo: "Equipo", pregunta: "«¿Has tenido que decirle a una compañera algo que no le iba a gustar? ¿Cómo lo hiciste?»", refs: { 1: "Se lo calló y se fue quemada, o fue a la encargada en vez de a ella", 4: "Se lo dijo a ella directamente, con tacto, y la relación siguió bien" } },
  Q9: { cod: "Q9", titulo: "Fiabilidad", pregunta: "«Si llamo a tu última encargada, ¿en qué te diría que eras la mejor del equipo? ¿Y en qué te diría que cojeabas?»", refs: { 1: "«Nada, la verdad», o un defecto de catálogo («soy muy perfeccionista»)", 4: "Dice algo de verdad y, si puede, qué hace para mejorarlo" } },
  P8: { cod: "P8", titulo: "Autonomía", sub: "solo en el puesto de 40 h", soloPrincipal: true, pregunta: "«¿Te ha tocado estar sola, abrir, cerrar o cuadrar caja? ¿Cómo lo hacías?»", refs: { 1: "Nunca y le da inseguridad", 4: "Sí, con pasos claros, y sabe qué hacer si la caja no cuadra" } },
  C: { cod: "C", titulo: "La caja", sub: "Tecnología", ejercicio: true, consigna: "Se le explica cómo se cobra y hace dos o tres cobros reales. Lo que se mira es la curva, no el último cobro.", refs: { 1: "En el tercer cobro sigue igual que en el primero; no pregunta; se bloquea delante del cliente", 2: "Mejora algo, pero hay que ir dándole cada paso", 3: "Del primero al tercero se nota: pregunta lo justo y ya va sola", 4: "Al tercero va sola y además se adelanta: prepara el cambio, pregunta qué hacer si pagan con tarjeta o si se equivoca" } },
  K: { cod: "K", titulo: "La paquetería", sub: "Tecnología", ejercicio: true, consigna: "Se lo explica una compañera, no dirección. Si entra un envío de esa compañía lo hace ella; si no, con un paquete de muestra.", refs: { 1: "No se atreve a tocar el programa, o va dando palos de ciego sin preguntar", 2: "Lo saca con ayuda continua", 3: "Lo saca sola tras la explicación, preguntando lo justo", 4: "Lo saca sola y entiende para qué sirve cada paso: pregunta qué pasa si el cliente no trae el código o si el paquete no cabe" } },
  H: { cod: "H", titulo: "El hueco", sub: "Proactividad", ejercicio: true, consigna: "Al acabar la paquetería se le dice «ahora vuelvo» y se la deja sola un par de minutos. Es tiempo muerto de verdad, de los que va a haber todos los días.", refs: { 1: "Se sienta o saca el móvil", 2: "Espera de pie sin hacer nada", 3: "Mira la tienda, los productos, los precios; observa a las compañeras", 4: "Se pone con algo: coloca lo que ve torcido, o le pregunta a una compañera si puede echar una mano" } },
  B: { cod: "B", titulo: "La balda", sub: "Proactividad", ejercicio: true, consigna: "Preparada antes de cada candidata, siempre igual: desordenada, con dos productos caducados escondidos y un precio mal puesto. Se le dice solo: «déjala como la dejarías tú». Nada más.", refs: { 1: "Lenta, la deja a medias, no encuentra nada y al terminar se queda parada", 2: "La deja bien pero no ve los caducados ni el precio, o los ve y no dice nada", 3: "La deja bien, encuentra algo y lo comenta sin que se le pregunte", 4: "Todo lo anterior y, al terminar, busca qué más hacer o pregunta si sigue con la de al lado" } },
  X: { cod: "X", titulo: "Que te lo explique ella", sub: "Aprendizaje", ejercicio: true, consigna: "Se le pide que explique cómo se cobra o cómo se hace el envío, como si se lo contara a una compañera que entra mañana.", refs: { 1: "No sabe por dónde empezar, o repite palabras sueltas sin orden", 2: "Lo cuenta de memoria, en el mismo orden que se lo dijeron, sin entender el porqué", 3: "Lo cuenta con sus palabras y en orden", 4: "Lo cuenta con sus palabras, avisa de dónde está el fallo fácil, y pregunta lo que no le ha quedado claro" } },
  Wt: { cod: "Wt", titulo: "Trato al público", sub: "nota de la compañera", tipo: "media", refs: { 1: "No mira ni saluda a los clientes, o lo hace seca", 4: "Saluda, sonríe y se acerca a ayudar aunque no sepa aún" } },
  We: { cod: "We", titulo: "Trabajo en equipo", sub: "nota de la compañera", tipo: "media", refs: { 1: "Va a su aire, no avisa de lo que hace, cuesta entenderse con ella", 4: "Se coordina sola, avisa, echa una mano sin que se lo pidan" } },
};
export const ITEMS_MEDIA = ["Wt", "We"]; // admiten .5 (media de dos compañeras)

// Tramos de la entrevista, en el orden en que ocurren (minutos de la cita de una hora).
// aviso: texto que sale encima del tramo. perfil: el tramo lleva la frase de perfil.
export const TRAMOS = [
  { id: "tienda", label: "Tienda y puesto", min: "0-7", items: [] },
  { id: "movil", label: "El móvil", min: "7-12", items: ["E1"] },
  { id: "preguntas", label: "Las nueve preguntas", min: "12-30", items: ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9"] },
  { id: "caja", label: "La caja", min: "30-39", items: ["C"], aviso: AVISO_EJERCICIOS },
  { id: "paqueteria", label: "La paquetería", min: "39-44", items: ["K"] },
  { id: "hueco", label: "El hueco", min: "44-46", items: ["H"] },
  { id: "balda", label: "La balda", min: "46-51", items: ["B"] },
  { id: "explicamelo", label: "Explícamelo", min: "51-54", items: ["X"] },
  { id: "cierre", label: "Cierre", min: "54-60", items: ["P8", "T", "Wt", "We"], avisoAntes: { Wt: AVISO_COMPANERA }, perfil: true },
];

// Competencias: media de sus notas × peso. Autonomía solo en principal.
// filtroActitud: si su media es < 2, descarta aunque la nota sea alta.
export const COMPETENCIAS = [
  { id: "proactividad", label: "Proactividad", notas: ["Q5", "Q7", "H", "B"], peso: 3, filtroActitud: true },
  { id: "trato", label: "Trato al público", notas: ["Q2", "T", "Wt"], peso: 3, filtroActitud: true },
  { id: "equipo", label: "Trabajo en equipo", notas: ["Q8", "We"], peso: 3, filtroActitud: true },
  { id: "tecnologia", label: "Agilidad con la tecnología", notas: ["E1", "C", "K"], peso: 2 },
  { id: "aprendizaje", label: "Capacidad de aprendizaje", notas: ["Q6", "X"], peso: 2 },
  { id: "fiabilidad", label: "Fiabilidad", notas: ["Q9"], peso: 2 },
  { id: "compromiso", label: "Compromiso con el sector", notas: ["Q1"], peso: 2 },
  { id: "autonomia", label: "Autonomía", notas: ["P8"], peso: 2, soloPrincipal: true },
];
export const UMBRAL_ACTITUD = 2;
// Desempate: mejor suma de ejercicios; si sigue, mejor experiencia.
export const EJERCICIOS_DESEMPATE = ["C", "K", "B", "X"];

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

export function aplica(it, puesto) { return !it.soloPrincipal || puesto === "principal"; }
export function comps(puesto) { return COMPETENCIAS.filter((c) => aplica(c, puesto)); }
export function maxB(puesto) { return comps(puesto).reduce((s, c) => s + c.peso * 4, 0); }
// Ítems que puntúan y hacen falta para dar la parte B por completa
export function itemsB(puesto) {
  const ids = [];
  TRAMOS.forEach((t) => t.items.forEach((id) => { const it = ITEMS[id]; if (it.tipo !== "descriptiva" && aplica(it, puesto)) ids.push(id); }));
  return ids;
}
export function etiquetaDe(nota) { return nota == null ? null : UMBRALES.find((u) => nota >= u.min); }
export function etiquetaPorId(id) { return UMBRALES.find((u) => u.id === id) || null; }

// Una evaluación es de la plantilla anterior si no lleva la marca de la plantilla 2.
export function esPlantillaAnterior(ev) {
  return !!ev && !(ev.parte_b && Number(ev.parte_b.plantilla) >= PLANTILLA_ACTUAL);
}

// Función pura (plantilla 2). Devuelve todo lo necesario para la hoja y el ranking.
export function calcularEvaluacion(puesto, parteA = {}, parteB = {}) {
  puesto = puesto === "principal" ? "principal" : "apoyo";
  parteA = parteA || {}; parteB = parteB || {};
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
  if (!bCompleta) falta.push(faltanB.length === req.length ? "entrevista (B)" : `B: ${faltanB.join(", ")}`);
  const totalB = cs.reduce((s, c) => s + (compMedias[c.id] == null ? 0 : compMedias[c.id] * c.peso), 0);

  // Filtro de actitud (solo con la Parte B completa, para no descartar a medias)
  if (!descarte && bCompleta) {
    const bajas = cs.filter((c) => c.filtroActitud && compMedias[c.id] != null && compMedias[c.id] < UMBRAL_ACTITUD);
    if (bajas.length) descarte = { tipo: "descartada_actitud", motivo: `Actitud por debajo del mínimo (${bajas.map((c) => `${c.label} ${Math.round(compMedias[c.id] * 100) / 100}`).join(" · ")} < ${UMBRAL_ACTITUD})` };
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
    plantillaAnterior: false,
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
    sumaEjercicios: EJERCICIOS_DESEMPATE.reduce((s, n) => s + (num(parteB[n]) || 0), 0),
    exp: exp == null ? 0 : exp,
    perfil: (parteB.perfil || "").trim(),
  };
}

// Resultado de una evaluación guardada. Las de la plantilla anterior NO se
// recalculan: se devuelve lo que se guardó entonces.
export function resultadoGuardado(ev) {
  if (!ev) return null;
  if (!esPlantillaAnterior(ev)) return calcularEvaluacion(ev.puesto, ev.parte_a || {}, ev.parte_b || {});
  const resultado = ev.resultado || "en_curso";
  const nota = ev.nota_final == null ? null : Number(ev.nota_final);
  const descartada = resultado === "descartada_eliminatorio" || resultado === "descartada_actitud";
  return {
    puesto: ev.puesto === "principal" ? "principal" : "apoyo",
    plantillaAnterior: true,
    totalA: ev.total_a == null ? 0 : Number(ev.total_a),
    totalB: ev.total_b == null ? 0 : Number(ev.total_b),
    maxB: PLANTILLA_ANTERIOR.maxB[ev.puesto === "principal" ? "principal" : "apoyo"],
    notaFinal: nota,
    etiqueta: descartada ? null : etiquetaPorId(ev.etiqueta),
    resultado,
    motivoDescarte: ev.motivo_descarte || null,
    descartada,
    aCompleta: !!ev.a_completa, bCompleta: !!ev.b_completa, completa: resultado === "completa",
    aviso40h: ev.puesto !== "principal" && ev.parte_a && ev.parte_a.L5 === "si",
    compMedias: {},
    falta: [!ev.a_completa && "parte A", !ev.b_completa && "parte B"].filter(Boolean),
    sumaEjercicios: 0,
    exp: num(ev.parte_a && ev.parte_a.exp) || 0,
    perfil: "",
  };
}

// ---------- Plantilla anterior (septiembre 2026) ----------
// Solo para enseñar, en modo lectura, las evaluaciones guardadas con ella.
export const PLANTILLA_ANTERIOR = {
  maxB: { apoyo: 56, principal: 64 },
  bloques: [
    { label: "Entrevista (paseo por la tienda)", items: [
      { id: "T", texto: "Trato durante la visita" },
      { id: "P1", texto: "«En tu último trabajo, ¿qué hacías en los ratos sin clientes?»" },
      { id: "P2", texto: "«¿Qué era lo que menos te gustaba hacer allí? ¿Cómo lo llevabas?»" },
      { id: "P3", texto: "«Alguna vez te habrá tocado un cliente complicado, ¿cómo lo llevaste?»" },
      { id: "P4", texto: "«¿Qué hace que alguien vuelva a una tienda de barrio en vez de ir al súper?»" },
      { id: "P5", texto: "«Estás en caja, hay cola, tu compañera está en el almacén y alguien pide que le cortes fiambre. ¿Qué harías?»" },
      { id: "P6", texto: "«¿Te acuerdas de algún despiste tuyo en un trabajo? ¿Qué pasó luego?»" },
      { id: "P7", texto: "«¿Qué te gusta de trabajar en tienda? ¿Cómo te ves de aquí a unos años?»" },
      { id: "P8", texto: "«¿Te ha tocado estar sola, abrir, cerrar o cuadrar caja? ¿Cómo lo hacías?»" },
    ] },
    { label: "Prueba práctica con las trabajadoras", items: [
      { id: "Wp", texto: "Proactividad" },
      { id: "Wt", texto: "Trato al público" },
      { id: "Wa", texto: "Aprendizaje" },
    ] },
  ],
};
