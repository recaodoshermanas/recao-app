// #230: Personas → Selección → Acogida. Guía el primer día de una trabajadora nueva.
// #241: la acogida se reparte en los días de Formación del horario (normalmente cuatro): un bloque y un guion por día,
// «Lo que llevamos» con los partes de los días anteriores y el cierre de formación con la decisión de si entra sola.
// La acogida nace por dos vías: «Contratar y empezar acogida» en Ranking (borrador, sin fecha)
// o el primer turno de Formación del horario (le pone fecha y la activa). Todo lo calcula la base de datos (acogidas_panel).
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { CVCandidatosView } from "../../../src/views/owner/CVCandidatosView.jsx";
import { NuevaCuenta } from "./Equipo.jsx";
import { avisar, confirmar, fechaCorta, masDias, useEquipo, Cargando, ir } from "../ui.jsx";
import "./acogida.css";

// Los nueve pasos de la recepción (protocolo de dirección, tal cual). {N} = la nueva · {C} = la compañera que acoge
const PASOS = [
  { min: "min 0", tit: "Antes de que entre",
    do: ["Ten a mano la documentación impresa y el móvil con la app en la cuenta de prueba.", "Comprueba que {C} sabe que hoy acoge."],
    warn: "Si falta algo, búscalo ahora. Empezar buscando cosas delante de ella da mala impresión y te come los 30 minutos." },
  { min: "min 0", tit: "Preséntala con nombres",
    say: "«Mirad, esta es {N}, que empieza hoy con nosotras.»",
    do: ["Di el nombre de cada compañera en voz alta, aunque creas que ya se lo sabe."],
    warn: "No la compares con nadie, ni para bien. «La anterior lo hacía así» le pone un listón que no ha pedido." },
  { min: "min 2", tit: "La frase del día",
    say: "«Hoy no tienes que rendir. Hoy mira, pregunta y equivócate. Si al final del día has preguntado mucho, lo has hecho bien.»",
    do: ["Dícelo mirándola, sin prisa."],
    warn: "Es lo que más se le va a quedar de todo el día. No la sueltes de pasada mientras andáis." },
  { min: "min 3", tit: "Sus cosas y el sitio",
    do: ["Dónde deja el bolso.", "El baño.", "Dónde se come y cuándo descansa."],
    warn: "Nada de normas todavía. Aquí solo lo práctico." },
  { min: "min 5", tit: "La vuelta a la tienda",
    do: ["Las zonas de la tienda.", "El almacén y la cámara.", "Dónde va la basura.", "Dónde está el material de limpieza."],
    warn: "No expliques el porqué de cada cosa. Hoy el qué; el porqué, cuando ya lo haga sola." },
  { min: "min 13", tit: "Lo que más preguntan",
    do: ["Los cuatro o cinco productos por los que preguntan los clientes todos los días, y dónde están."],
    warn: "Parece una tontería y es lo que le salva el primer apuro con un cliente. No lo saltes." },
  { min: "min 15", tit: "Las tres cosas que pedimos",
    say: "«Aquí pedimos tres cosas: buen trato al público, que rindas en tu trabajo y que te lleves bien con tus compañeras. Ya está.»\n\n«Y todos los meses hay un plus por hacer bien el trabajo.»",
    do: ["Dilo entero y pasa al siguiente punto."],
    warn: "No cuentes cómo se pierde el plus, ni los fallos, ni los plazos. Y no menciones las cámaras: el primer día suena a vigilancia y no lo necesita para nada." },
  { min: "min 20", tit: "Lo que no se puede deshacer",
    say: "«Si no sabes algo con un cliente delante, dices: no lo sé, ahora mismo te lo miro. Aquí eso está bien visto.»",
    do: ["Si se equivoca cobrando, que lo diga en el momento. Que no lo arregle sola.", "Si ve algo caducado, que avise.", "Alérgenos: que nunca improvise. Si no está segura, que pregunte."],
    warn: "Es la única parte seria del día. Cinco minutos, no quince. Y que acabe con la frase, no con una advertencia." },
  { min: "min 27", tit: "El traspaso y la documentación",
    say: "«Hoy vas con {C}. Cualquier duda, a ella.»\n\n«Esto te lo llevas a casa y lo lees con calma. La semana que viene nos sentamos y me preguntas lo que quieras.»",
    do: ["Llama a {C} y dilo delante de las dos.", "Entrégale la documentación."],
    warn: "Entregada no es explicada. No te pongas a explicársela ahora: firmar no es haber leído." },
];
// #241: un guion por cada día de formación (protocolo de dirección, tal cual). {N} = la nueva · {SOLA} = el día que entra sola
const DIAS_TXT = [
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
const txtDia = (n) => DIAS_TXT[Math.min(Math.max(n, 1), DIAS_TXT.length) - 1];
const PREG_FIJAS = ["«¿Qué NO has entendido hoy?»", "«¿Qué necesitas para mañana?»"];
const LINEAS = ["¿Se ha soltado o ha ido a remolque?", "¿Qué le ha costado más?", "¿La ves lista para mañana?"];
const CIERRE_PREG = ["¿Con qué te has quedado más insegura?", "¿Qué de estos cuatro días crees que no vas a saber hacer sola?", "¿Hay algo que te haya chocado de cómo trabajamos aquí?", "Dudas de la documentación que se llevó a casa. De paso te enteras de si la ha leído."];

const ANTES = [["antes_cuenta", "Cuenta en la app creada y probada"], ["antes_horario", "Horario cargado, primer ciclo"], ["antes_sitio", "Sitio para sus cosas"], ["antes_equipo", "Equipo avisado"], ["antes_docs", "Documentación impresa"], ["antes_avisar", "Compañera del día 1 avisada"]];
const DIA_KEYS = ["guion", "preguntas", "parte"];
// Las acogidas de antes (#230) guardaban el día 1 como dia_guion / dia_parte
const LEGADO = { d1_guion: "dia_guion", d1_parte: "dia_parte" };
const ck = (a, k) => { const c = a.checks || {}; return k in c ? !!c[k] : !!(LEGADO[k] && c[LEGADO[k]]); };
const dias = (a) => a.dias || [];
const parteDe = (a, d) => (a.partes || []).find((p) => p.fecha === d?.fecha) || null;
const diaHecho = (a, d) => DIA_KEYS.every((k) => ck(a, `d${d.n}_${k}`));
const DESPUES = (a) => [
  ["despues_videos", "Adelantarle 2 vídeos"],
  ["despues_sola", `Dos preguntas al acabar su primer turno sola${a.primer_sola ? " · " + fechaCorta(a.primer_sola) : ""}`],
  ["despues_d15", `Repaso a los 15 días${a.ultimo_formacion ? " · " + fechaCorta(masDias(a.ultimo_formacion, 15)) : ""}`],
];
const totales = (a) => {
  const keys = [...ANTES.map(([k]) => k), ...dias(a).flatMap((d) => DIA_KEYS.map((k) => `d${d.n}_${k}`)), ...DESPUES(a).map(([k]) => k)];
  const hechos = keys.filter((k) => ck(a, k)).length + (a.decision ? 1 : 0);
  const total = keys.length + 1;
  return { hechos, total, pct: Math.round((hechos / total) * 100) };
};
const pct = (a) => totales(a).pct;
const nombreCorto = (s) => (s || "").split(" ")[0];
const pasosHechos = (a) => (a.recepcion?.hechos || []).length;
const diaSemana = (f) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long" });
const diaSola = (a) => (a.primer_sola ? `el ${diaSemana(a.primer_sola)}` : "en cuanto acabe la formación");
const quienLleva = (a, d) => (d?.n === 1 ? a.acoge_final_nombre : d?.lleva_nombre) || null;
const diaDeHoy = (a, hoy) => dias(a).find((d) => d.fecha === hoy) || null;
const normal = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
const listaDias = (ns) => (ns.length === 1 ? `día ${ns[0]}` : `días ${ns.slice(0, -1).join(", ")} y ${ns[ns.length - 1]}`);
const COMO = { suelta: "Se soltó", remolque: "A remolque" };

// «Lo que llevamos» para el día d (solo días 2 en adelante). Las respuestas de la nueva y el parte de la compañera van en líneas separadas.
function loQueLlevamos(a, d) {
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
function textoLlevamos(L) {
  if (!L || !L.hayAlgo) return "";
  const l = ["LO QUE LLEVAMOS"];
  l.push(`· Sigue sin entender: ${L.no ? `${L.no.texto} (${L.no.dias})${L.no.insiste ? " ← lleva dos días con esto" : ""}` : "sin apuntar"}`);
  l.push(`· Pidió para hoy: ${L.pide || "sin apuntar"}`);
  l.push(`· Cómo ha ido: ${L.hist.map((h) => `Día ${h.n} ${h.como ? COMO[h.como].toLowerCase() : "sin parte"}`).join(" → ")}`);
  if (L.consejo) l.push(`· ${L.consejo}`);
  return l.join("\n") + "\n\n";
}
const guionDia = (a, d) => txtDia(d.n).guion.replaceAll("{N}", nombreCorto(a.nombre)).replaceAll("{SOLA}", diaSola(a));
const textoCopiar = (a, d) => textoLlevamos(loQueLlevamos(a, d)) + guionDia(a, d);
const conNombres = (t, a) => String(t || "").replaceAll("{N}", nombreCorto(a.nombre)).replaceAll("{C}", nombreCorto(a.acoge_final_nombre) || "la compañera");

export function useAcogidas() {
  const [datos, setDatos] = useState(null);
  const cargar = useCallback(async () => {
    try { setDatos(await sb.rpc("acogidas_panel", {})); } catch (e) { setDatos((d) => d || { acogidas: [], sin_acogida: [], error: true }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  return { datos, cargar, setDatos };
}

// Selección del panel: Candidatas · Ranking · Acogida (las dos primeras son las de siempre)
export function Seleccion({ user, extra }) {
  const ac = useAcogidas();
  const [contratando, setContratando] = useState(null);
  const [foco, setFoco] = useState(() => (String(extra || "").startsWith("acogida:") ? String(extra).slice(8) : null));
  const abrirAcogida = String(extra || "").startsWith("acogida");
  const [forzar, setForzar] = useState(0);
  useEffect(() => { if (String(extra || "").startsWith("acogida:")) setFoco(String(extra).slice(8)); }, [extra]);
  const enCurso = (ac.datos?.acogidas || []).filter((a) => a.estado === "en_curso" || a.estado === "borrador").length;
  return (
    <>
      <CVCandidatosView currentUser={user} abrirId={abrirAcogida ? null : extra}
        pestanaExtra={{ id: "acogida", label: "Acogida", n: enCurso, abrir: abrirAcogida ? extra : forzar, el: <Acogida ac={ac} foco={foco} setFoco={setFoco} /> }}
        onContratar={(c) => setContratando(c)} />
      {contratando && (
        <NuevaCuenta inicial={{ nombre: contratando.nombre || "", email: contratando.email || "", tel: contratando.telefono || "", tipo: "apoyo" }}
          titulo={`Contratar a ${contratando.nombre}`}
          onClose={() => setContratando(null)}
          onCreada={async (r) => {
            const uid = r?.usuario?.id;
            if (uid) {
              try { const id = await sb.rpc("acogida_desde_candidata", { p_candidato: contratando.id, p_usuario: uid }); setFoco(String(id)); avisar("Cuenta creada y acogida empezada. Ponle su primer turno de Formación en Horarios y cogerá la fecha."); }
              catch (e) { avisar("Cuenta creada, pero no se ha podido empezar la acogida", "mal"); }
            }
            setContratando(null); await ac.cargar(); setForzar((n) => n + 1);
          }} />
      )}
    </>
  );
}

export function Acogida({ ac, foco, setFoco }) {
  const { datos, cargar, setDatos } = ac;
  const [vista, setVista] = useState("ficha"); // ficha | guiado | guion | cierre (con foco)
  const [diaSel, setDiaSel] = useState(null);
  const { equipo } = useEquipo();
  if (!datos) return <Cargando />;
  if (datos.error) return <p className="empty">No se han podido cargar las acogidas. <button className="btn-txt" onClick={cargar}>Reintentar</button></p>;
  const lista = datos.acogidas || [];
  const hoy = datos.hoy;
  const a = foco ? lista.find((x) => String(x.id) === String(foco)) : null;

  // Guarda al momento en pantalla y luego en la base de datos (sin recargar)
  // «local»: datos solo para la pantalla (nombres), no van a la base de datos
  const guardar = async (acog, patch, local = {}, recargarDespues = false) => {
    setDatos((d) => ({ ...d, acogidas: d.acogidas.map((x) => (x.id === acog.id ? { ...x, ...patch, ...local } : x)) }));
    try { await sb.update("acogidas", `id=eq.${acog.id}`, { ...patch, actualizado_en: new Date().toISOString() }); if (recargarDespues) cargar(); }
    catch (e) { avisar("No se ha podido guardar", "mal"); cargar(); }
  };
  const verGuion = (n) => { setDiaSel(n); setVista("guion"); };

  if (a && vista === "guiado") return <Guiado a={a} guardar={guardar} salir={(v) => (v === "guion" ? verGuion(1) : setVista(v || "ficha"))} />;
  if (a && vista === "guion") return <Guion a={a} hoy={hoy} n={diaSel} setN={setDiaSel} guardar={guardar} volver={() => setVista("ficha")} />;
  if (a && vista === "cierre") return <Cierre a={a} guardar={guardar} volver={() => setVista("ficha")} />;
  if (a) return <Ficha a={a} hoy={hoy} equipo={equipo} guardar={guardar} volver={() => setFoco(null)} ver={setVista} verGuion={verGuion} recargar={cargar} />;

  const activas = lista.filter((x) => x.estado === "en_curso" || x.estado === "borrador");
  const cerradas = lista.filter((x) => x.estado === "terminada" || x.estado === "cancelada");
  const crear = async (s) => {
    try { const id = await sb.rpc("acogida_desde_candidata", { p_candidato: null, p_usuario: s.usuario_id }); await cargar(); setFoco(String(id)); }
    catch (e) { avisar("No se ha podido crear la acogida", "mal"); }
  };
  return (
    <div className="aco">
      <p className="aco-cap">{activas.length === 1 ? "1 en curso" : `${activas.length} en curso`}</p>
      {(datos.sin_acogida || []).map((s) => (
        <div key={s.usuario_id} className="aco-aviso">
          <b>{s.nombre} tiene turnos y no tiene acogida</b>
          <span>Su primer turno es {s.turno} el {fechaCorta(s.primer_turno)} y no entró por Ranking ni con un turno de Formación.</span>
          <button className="aco-btn ghost" onClick={() => crear(s)}>Crear su acogida</button>
        </div>
      ))}
      {activas.length === 0 && <p className="empty">No hay ninguna acogida en curso. Nacen al contratar desde Ranking o al ponerle a una trabajadora nueva su primer turno de Formación.</p>}
      {activas.map((x) => <Tarjeta key={x.id} a={x} hoy={hoy} onClick={() => { setVista("ficha"); setFoco(String(x.id)); }} />)}
      {cerradas.length > 0 && (
        <div className="aco-blk">
          <div className="aco-bh">Terminadas y canceladas<em>{cerradas.length}</em></div>
          {cerradas.map((x) => (
            <button key={x.id} className="aco-ck" onClick={() => { setVista("ficha"); setFoco(String(x.id)); }}>
              <span>{x.nombre}<small>{x.estado === "terminada" ? "Terminada" : "Cancelada"}{x.fecha_entrada ? ` · entró el ${fechaCorta(x.fecha_entrada)}` : ""}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const faltaDecision = (a, hoy) => a.estado === "en_curso" && !a.decision && a.ultimo_formacion && hoy >= a.ultimo_formacion;
function etiqueta(a, hoy) {
  if (a.estado === "borrador") return { c: "gris", t: "Sin fecha" };
  if (!a.fecha_entrada) return null;
  const dh = diaDeHoy(a, hoy);
  if (dh) return { c: "rojo", t: `Día ${dh.n} de ${dias(a).length}` };
  if (a.fecha_entrada > hoy) return { c: "gris", t: a.fecha_entrada === masDias(hoy, 1) ? "Mañana" : "Próxima" };
  if (faltaDecision(a, hoy)) return { c: "rojo", t: "Falta decidir si entra sola" };
  if (a.decision && a.ultimo_formacion && hoy >= masDias(a.ultimo_formacion, 15) && !ck(a, "despues_d15")) return { c: "oro", t: "15 días" };
  if (a.decision) return { c: "gris", t: "Formación terminada" };
  return null;
}
const guionDesfasado = (a) => a.guion_para && a.acoge_final_id && a.guion_para !== a.acoge_final_id;
const rangoFormacion = (a) => (a.fecha_entrada && a.ultimo_formacion && a.ultimo_formacion !== a.fecha_entrada ? `formación del ${fechaCorta(a.fecha_entrada)} al ${fechaCorta(a.ultimo_formacion)}` : a.fecha_entrada ? `formación el ${fechaCorta(a.fecha_entrada)}` : "sin fecha: ponle sus turnos de Formación en Horarios");

function Tarjeta({ a, hoy, onClick }) {
  const et = etiqueta(a, hoy);
  const ds = dias(a);
  const dh = diaDeHoy(a, hoy);
  return (
    <button className="aco-card" onClick={onClick}>
      <div className="aco-who"><span className="aco-av">{(a.nombre || "?")[0]}</span><span className="aco-t"><b>{a.nombre}</b><small>{a.tipo_turno === "principal" ? "Principal" : "Apoyo"} · {rangoFormacion(a)}</small></span>{et && <span className={`aco-tag ${et.c}`}>{et.t}</span>}</div>
      <div className="aco-pb"><i style={{ width: `${pct(a)}%` }} /></div>
      <div className="aco-row"><span>{ds.filter((d) => diaHecho(a, d)).length} de {ds.length} días cerrados</span><span>{dh ? (quienLleva(a, dh) ? `Hoy la lleva: ${nombreCorto(quienLleva(a, dh))}` : "Hoy no hay principal en el horario") : a.decision ? (a.decision === "entra_sola" ? "Entra sola" : "Necesita otro día") : ""}</span></div>
      {guionDesfasado(a) && <div className="aco-row aco-rojo">El guion del día 1 se mandó a {nombreCorto(a.guion_para_nombre)} y ahora la lleva {nombreCorto(a.acoge_final_nombre)}: vuelve a mandarlo.</div>}
      {a.estado === "en_curso" && ds.length === 0 && <div className="aco-row aco-rojo">No tiene ningún turno de Formación en el horario.</div>}
      <div className="aco-row aco-link">Abrir la ficha →</div>
    </button>
  );
}

function Ficha({ a, hoy, equipo, guardar, volver, ver, verGuion, recargar }) {
  const activa = a.estado === "en_curso" || a.estado === "borrador";
  const marcar = (k) => activa && guardar(a, { checks: { ...(a.checks || {}), [k]: !ck(a, k) } });
  const companeras = (equipo || []).filter((u) => u.activo && u.rol === "trabajadora" && u.id !== a.usuario_id);
  const ds = dias(a);
  const ult = ds[ds.length - 1];
  const tot = totales(a);
  const cambiarEstado = async (estado) => {
    if (estado === "terminada" && !a.decision) { avisar("Antes de darla por terminada, guarda la decisión del cierre de formación: entra sola o necesita otro día.", "mal"); return; }
    const txt = estado === "cancelada" ? `¿Cancelar la acogida de ${a.nombre}? Queda guardada como cancelada.` : `¿Dar por terminada la acogida de ${a.nombre}?`;
    if (!(await confirmar(txt))) return;
    await guardar(a, { estado, ...(estado === "cancelada" ? { cancelada_en: new Date().toISOString() } : { terminada_en: new Date().toISOString() }) });
    avisar(estado === "cancelada" ? "Acogida cancelada" : "Acogida terminada"); recargar(); volver();
  };
  const Casilla = ({ k, t, mini }) => (
    <button className={`aco-ck${ck(a, k) ? " done" : ""}`} onClick={() => marcar(k)} disabled={!activa} aria-pressed={ck(a, k)}><i /><span>{t}{mini && <small>{mini}</small>}</span></button>
  );
  const Enlace = ({ t, onClick }) => <button className="aco-ck aco-ir" onClick={onClick}><i /><span>{t}</span></button>;
  return (
    <div className="aco">
      <button className="aco-back" onClick={volver}>← Acogida</button>
      <div className="aco-card fija">
        <div className="aco-who"><span className="aco-av">{(a.nombre || "?")[0]}</span><span className="aco-t"><b>{a.nombre}</b>
          <small>{a.tipo_turno === "principal" ? "Principal" : "Apoyo"} · {ds.length ? `${ds.length === 1 ? "un día" : `${ds.length} días`} de formación` : "sin días de formación"}{a.primer_sola ? ` · primer turno sola: ${fechaCorta(a.primer_sola)}` : ""}</small></span>
          {a.estado !== "en_curso" ? <span className="aco-tag gris">{a.estado === "borrador" ? "Borrador" : a.estado === "terminada" ? "Terminada" : "Cancelada"}</span> : a.decision ? <span className="aco-tag gris">Formación terminada</span> : null}</div>
        <div className="aco-pb"><i style={{ width: `${tot.pct}%` }} /></div>
        <div className="aco-row"><span>{tot.hechos} de {tot.total} pasos</span><span>{tot.pct} %</span></div>
        {a.estado === "borrador" && <div className="aco-row aco-rojo">Aún no tiene fecha: coge sus días de los turnos de Formación en Horarios. <button className="btn-txt" onClick={() => ir("personas/horarios")}>Ir a Horarios</button></div>}
        {a.estado === "en_curso" && ds.length === 0 && <div className="aco-row aco-rojo">No tiene ningún turno de Formación en el horario: ponle sus días en Horarios. <button className="btn-txt" onClick={() => ir("personas/horarios")}>Ir a Horarios</button></div>}
        {faltaDecision(a, hoy) && <div className="aco-row aco-rojo">Ha acabado la formación y falta decidir si entra sola. <button className="btn-txt" onClick={() => ver("cierre")}>Abrir el cierre</button></div>}
        {guionDesfasado(a) && <div className="aco-row aco-rojo">El guion del día 1 se mandó a {nombreCorto(a.guion_para_nombre)} y ahora la lleva {nombreCorto(a.acoge_final_nombre)}: vuelve a mandarlo.</div>}
      </div>

      <div className="aco-blk">
        <div className="aco-bh">Antes de que llegue<em>{ANTES.filter(([k]) => ck(a, k)).length} de {ANTES.length}</em></div>
        {ANTES.map(([k, t]) => <Casilla key={k} k={k} t={t} />)}
      </div>

      {ds.map((d) => {
        const T = txtDia(d.n);
        const esHoy = d.fecha === hoy;
        const quien = quienLleva(a, d);
        const p = parteDe(a, d);
        const hechas = DIA_KEYS.filter((k) => ck(a, `d${d.n}_${k}`)).length;
        return (
          <div key={d.fecha} className={`aco-blk${esHoy ? " aco-hoy" : ""}`}>
            <div className="aco-bh">Día {d.n} · {T.tit}<em>{esHoy ? "HOY · " : ""}{fechaCorta(d.fecha)} · {hechas} de 3</em></div>
            <div className="aco-lleva">{quien ? <>La lleva <b>{quien}</b>{d.n === 1 && a.acoge_id ? " (elegida a mano)" : ", la principal del turno"}</> : "Ese día no hay principal en el horario"}</div>
            {d.n === 1 && activa && (
              <label className="aco-sel aco-sel-in">Quién la lleva el día 1
                <select value={a.acoge_id || ""} onChange={(e) => guardar(a, { acoge_id: e.target.value || null }, {}, true)}>
                  <option value="">{d.lleva_nombre ? `La principal del turno: ${d.lleva_nombre}` : "La principal del turno (aún sin horario)"}</option>
                  {companeras.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </label>
            )}
            <Casilla k={`d${d.n}_guion`} t={`Guion enviado a ${nombreCorto(quien) || "la compañera"}`} mini={`el guion del día ${d.n}`} />
            <Casilla k={`d${d.n}_preguntas`} t="Las preguntas del cierre hechas" mini={`las dos fijas + la del día: «${T.preg}»`} />
            <Casilla k={`d${d.n}_parte`} t="Parte de esa tarde recibido" mini="si se ha soltado · qué le ha costado · si la ve lista para mañana" />
            {p && (
              <>
                <div className="aco-sub"><em>Lo que contestó ella · la ayuda, no la califica</em>
                  <span><b>¿Qué NO has entendido?</b> {p.no_entendido || "—"}</span>
                  <span><b>¿Qué necesitas para mañana?</b> {p.necesita || "—"}</span>
                  <span><b>{T.preg}</b> {p.pregunta_dia || "—"}</span>
                </div>
                <div className="aco-sub"><em>Parte de {nombreCorto(p.autor_nombre) || "la compañera"}</em>
                  <span><b>Cómo ha ido:</b> {p.como_ha_ido ? COMO[p.como_ha_ido] : "—"} · <b>¿Lista para mañana?</b> {{ si: "Sí", casi: "Casi", no: "No" }[p.lista] || "—"}</span>
                  {p.algo_mas && <span>{p.algo_mas}</span>}
                </div>
              </>
            )}
            {d.n === 1 && activa && <Enlace t={`${pasosHechos(a) || a.recepcion?.paso ? "Seguir la recepción" : "Abrir la recepción de 30 min"} · ${pasosHechos(a)} de 9 pasos →`} onClick={() => ver("guiado")} />}
            <Enlace t={`Ver el guion del día ${d.n} →`} onClick={() => verGuion(d.n)} />
          </div>
        );
      })}

      <div className="aco-blk">
        <div className="aco-bh">Cierre de formación{ult ? ` · día ${ult.n}` : ""}<em>{ult ? `${fechaCorta(ult.fecha)} · ` : ""}15 min en la tienda</em></div>
        <div className={`aco-ck${a.decision ? " done" : ""}`}><i /><span>Conversación de cierre con dirección<small>{a.decision ? `${a.decision === "entra_sola" ? "Entra sola" : "Necesita otro día"} · guardado el ${fechaCorta(a.decision_en)}` : "las cuatro preguntas y la decisión de si entra sola"}</small></span></div>
        {activa && <Enlace t="Abrir el cierre de formación →" onClick={() => ver("cierre")} />}
      </div>

      <div className="aco-blk">
        <div className="aco-bh">Después de la formación<em>{DESPUES(a).filter(([k]) => ck(a, k)).length} de 3</em></div>
        {DESPUES(a).map(([k, t]) => <Casilla key={k} k={k} t={t} />)}
      </div>
      <p className="aco-small">Cuando se guarda la decisión del cierre, saltan solos en la campana del panel el recordatorio del primer turno sola (la mañana siguiente) y el repaso de los 15 días. Ya no hay repasos del día 7 ni del día 30.</p>
      {activa && (
        <div className="aco-btns">
          <button className={`aco-btn${tot.hechos >= tot.total ? "" : " ghost"}`} onClick={() => cambiarEstado("terminada")}>Dar por terminada</button>
          <button className="aco-btn ghost peligro" onClick={() => cambiarEstado("cancelada")}>No ha llegado a entrar: cancelar</button>
        </div>
      )}
    </div>
  );
}

function Cierre({ a, guardar, volver }) {
  const ds = dias(a);
  const ult = ds[ds.length - 1];
  const sola = diaSola(a);
  const decidir = async (decision) => {
    const ahora = new Date().toISOString();
    await guardar(a, { decision, decision_en: ahora, formacion_terminada_en: a.formacion_terminada_en || ahora });
    avisar(decision === "entra_sola" ? `Guardado: entra sola ${sola}.` : "Guardado: necesita otro día. Ponle el turno de Formación de más en Horarios y saldrá su bloque.");
    volver();
  };
  return (
    <div className="aco-full">
      <div className="aco-gwrap">
        <button className="aco-back" onClick={volver}>← Ficha de {nombreCorto(a.nombre)}</button>
        <div className="aco-gmeta"><span>{ult ? `Día ${ult.n} · ` : ""}cierre de formación · {a.nombre}</span><span className="aco-min">15 min</span></div>
        <h2 className="aco-gtit">En la tienda, al acabar su último día</h2>
        <p className="aco-small">Antes de que entre sola {sola}. Cara a cara, no por teléfono.</p>
        <ul className="aco-do">{CIERRE_PREG.map((t) => <li key={t}>{t}</li>)}</ul>
        <div className="aco-warn"><em>No lo dejes en el aire</em>Aquí se decide y se dice: entra sola {sola}, o necesita otro día de formación. Si no se dice, {sola} entra sola por inercia.</div>
        {a.decision && <p className="aco-small">Decisión guardada el {fechaCorta(a.decision_en)}: <b>{a.decision === "entra_sola" ? "entra sola" : "necesita otro día"}</b>. Puedes cambiarla.</p>}
        <div className="aco-btns">
          <button className="aco-btn" onClick={() => decidir("entra_sola")}>Entra sola {sola}</button>
          <button className="aco-btn ghost" onClick={() => decidir("otro_dia")}>Necesita otro día</button>
        </div>
      </div>
    </div>
  );
}

function Guiado({ a, guardar, salir }) {
  const rec = { paso: 0, hechos: [], saltados: [], ...(a.recepcion || {}) };
  const paso = Math.min(Math.max(0, rec.paso || 0), PASOS.length);
  const mover = (p, marca) => {
    const hechos = new Set(rec.hechos); const saltados = new Set(rec.saltados);
    if (marca === "hecho") { hechos.add(paso); saltados.delete(paso); }
    if (marca === "salta") { saltados.add(paso); hechos.delete(paso); }
    const nuevo = { paso: p, hechos: [...hechos].sort((x, y) => x - y), saltados: [...saltados].sort((x, y) => x - y) };
    const patch = { recepcion: nuevo };
    if (p >= PASOS.length) patch.checks = { ...(a.checks || {}), dia_recepcion: true };
    guardar(a, patch);
  };
  if (paso >= PASOS.length) {
    return (
      <div className="aco-full">
        <div className="aco-gwrap">
          <button className="aco-back" onClick={() => salir()}>← Salir de la recepción</button>
          <div className="aco-done"><b>Recepción terminada</b>
            <p>{pasosHechos(a)} de 9 pasos hechos{(rec.saltados || []).length ? `, ${(rec.saltados || []).length} saltados (hoy no aplicaban)` : ""}. Ahora le toca a {nombreCorto(a.acoge_final_nombre) || "la compañera"}: mándale su guion y al final del turno pídele las tres líneas.</p>
            <div className="aco-btns"><button className="aco-btn" onClick={() => salir("guion")}>Ver el guion de {nombreCorto(a.acoge_final_nombre) || "la compañera"}</button><button className="aco-btn ghost" onClick={() => salir()}>Volver a la ficha</button></div>
            <button className="btn-txt" onClick={() => mover(PASOS.length - 1)}>← Volver al último paso</button>
          </div>
        </div>
      </div>
    );
  }
  const p = PASOS[paso];
  return (
    <div className="aco-full">
      <div className="aco-gwrap">
        <button className="aco-back" onClick={() => salir()}>← Salir de la recepción</button>
        <div className="aco-gmeta"><span>Paso {paso + 1} de {PASOS.length} · {a.nombre}</span><span className="aco-min">{p.min}</span></div>
        <h2 className="aco-gtit">{p.tit}</h2>
        {p.say && <div className="aco-say"><em>Dilo tal cual</em>{conNombres(p.say, a)}</div>}
        <ul className="aco-do">{p.do.map((t, i) => <li key={i}>{conNombres(t, a)}</li>)}</ul>
        <div className="aco-warn"><em>Ojo con esto</em>{p.warn}</div>
        <div className="aco-dots">{PASOS.map((_, n) => <i key={n} className={n === paso ? "on" : rec.hechos.includes(n) ? "ok" : rec.saltados.includes(n) ? "skip" : ""} />)}</div>
        <div className="aco-gbtns">
          <button className="aco-btn ghost" disabled={paso === 0} onClick={() => mover(paso - 1)}>Atrás</button>
          <button className="aco-btn ghost" onClick={() => mover(paso + 1, "salta")}>Hoy no aplica</button>
          <button className="aco-btn grande" onClick={() => mover(paso + 1, "hecho")}>{paso === PASOS.length - 1 ? "Terminar recepción" : "Hecho"}</button>
        </div>
      </div>
    </div>
  );
}

function Guion({ a, hoy, n, setN, guardar, volver }) {
  const ds = dias(a);
  const porDefecto = diaDeHoy(a, hoy) || ds.find((d) => !ck(a, `d${d.n}_guion`)) || ds[0];
  const d = ds.find((x) => x.n === n) || porDefecto;
  const [estado, setEstado] = useState("");
  if (!d) {
    return (
      <div className="aco">
        <button className="aco-back" onClick={volver}>← Ficha de {nombreCorto(a.nombre)}</button>
        <p className="empty">Todavía no tiene turnos de Formación en el horario. Los guiones salen uno por cada día de formación.</p>
      </div>
    );
  }
  const T = txtDia(d.n);
  const quien = quienLleva(a, d);
  const L = loQueLlevamos(a, d);
  const texto = textoCopiar(a, d);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setEstado("Copiado: pégalo en WhatsApp"); }
    catch (e) { setEstado("No se ha podido copiar solo: selecciona el texto y cópialo"); return; }
    const patch = { checks: { ...(a.checks || {}), [`d${d.n}_guion`]: true } };
    if (d.n === 1) { patch.guion_para = a.acoge_final_id || null; guardar(a, patch, { guion_para_nombre: a.acoge_final_nombre || null }); }
    else guardar(a, patch);
  };
  const kParte = `d${d.n}_parte`;
  return (
    <div className="aco">
      <button className="aco-back" onClick={volver}>← Ficha de {nombreCorto(a.nombre)}</button>
      <h2 className="aco-h">Guion de la compañera</h2>
      <p className="aco-cap">Un guion por día: cada día se le pide otra cosa</p>
      <div className="aco-seg">{ds.map((x) => <button key={x.n} className={x.n === d.n ? "on" : ""} onClick={() => { setN(x.n); setEstado(""); }}>Día {x.n}</button>)}</div>
      <p className="aco-cap">{fechaCorta(d.fecha)} · {T.tit} · {quien ? `la lleva ${nombreCorto(quien)}` : "ese día no hay principal en el horario"}</p>
      {L && (
        <div className="aco-prev"><em>Lo que llevamos · {d.n === 2 ? "día 1" : `días 1 a ${d.n - 1}`}</em>
          {!L.hayAlgo && <span className="aco-small">Todavía no ha llegado ningún parte de los días anteriores.</span>}
          {L.hayAlgo && <>
            <div className="aco-pr"><b>Sigue sin entender</b><span>{L.no ? <>{L.no.texto} <i>({L.no.dias})</i>{L.no.insiste && <u>lleva dos días con esto</u>}</> : "sin apuntar"}</span></div>
            <div className="aco-pr"><b>Pidió para hoy</b><span>{L.pide || "sin apuntar"}</span></div>
            <div className="aco-pr"><b>Cómo ha ido</b><span className="aco-hist">{L.hist.map((h) => <span key={h.n} className={h.como === "suelta" ? "ok" : h.como === "remolque" ? "no" : ""}>Día {h.n} · {h.como ? COMO[h.como] : "sin parte"}</span>)}</span></div>
            {L.consejo && <div className="aco-cons">{L.consejo}</div>}
          </>}
        </div>
      )}
      <p className="aco-small">Esto es lo que se copia:</p>
      <div className="aco-wa">{texto}</div>
      <button className="aco-btn" onClick={copiar}>Copiar para WhatsApp</button>
      {estado && <p className="aco-small">{estado}</p>}
      {ck(a, `d${d.n}_guion`) && <p className="aco-small">Guion del día {d.n} marcado como enviado{d.n === 1 && a.guion_para_nombre ? ` a ${nombreCorto(a.guion_para_nombre)}` : ""}.</p>}
      <div className="aco-blk">
        <div className="aco-bh">Las preguntas del cierre · día {d.n}<em>antes de que se vaya</em></div>
        <div className="aco-ck"><i /><span>{PREG_FIJAS[0]}<small>si contesta «nada», no ha entendido la pregunta: que insista</small></span></div>
        <div className="aco-ck"><i /><span>{PREG_FIJAS[1]}</span></div>
        <div className="aco-ck"><i /><span>«{T.preg}»<small>la del día {d.n}</small></span></div>
      </div>
      <p className="aco-small">Dos fijas los cuatro días y una del día. Las contesta ella: sirven para ayudarla, no la califican. Lo que la califica es el parte de abajo.</p>
      <div className="aco-blk">
        <div className="aco-bh">Las tres líneas a dirección<em>{ck(a, kParte) ? "recibidas" : "pendiente"}</em></div>
        {LINEAS.map((t) => <div key={t} className="aco-ck"><i /><span>{t}</span></div>)}
        <button className={`aco-ck${ck(a, kParte) ? " done" : ""}`} onClick={() => guardar(a, { checks: { ...(a.checks || {}), [kParte]: !ck(a, kParte) } })}><i /><span><b>Ya me las ha mandado</b> (marca «Parte de esa tarde recibido» del día {d.n})</span></button>
      </div>
    </div>
  );
}
