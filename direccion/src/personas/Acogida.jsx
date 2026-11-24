// #230: Personas → Selección → Acogida. Guía el primer día de una trabajadora nueva.
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
const PREGUNTAS = ["«¿Qué te ha sorprendido hoy?»", "«¿Qué NO has entendido?»", "«¿Qué necesitas para mañana?»"];
const LINEAS = ["¿Se ha soltado o ha ido a remolque?", "¿Qué ha costado más?", "¿La ves volviendo mañana?"];
const guionDe = (n, c) => `Hola ${c}. Hoy entra ${n} y la acoges tú.\n\nTu trabajo no es enseñarle todo, es que no esté sola en ningún momento.\n\n· Que te siga y ve contándole lo que haces.\n· A mitad de turno dale una tarea entera suya.\n· Preséntala a los clientes habituales.\n· Que no toque caja sola: que cobre contigo al lado.\n· Pregúntale cada rato si va bien.\n\nAntes de que se vaya, estas tres: ¿qué te ha sorprendido? ¿qué NO has entendido? ¿qué necesitas para mañana?\n\nY me cuentas en tres líneas cómo ha ido:\n1. ${LINEAS[0]}\n2. ${LINEAS[1]}\n3. ${LINEAS[2]}`;

// Casillas de la ficha, en tres bloques
const BLOQUES = (a, c) => [
  { id: "antes", t: "Antes de que llegue", items: [["antes_cuenta", "Cuenta en la app creada y probada"], ["antes_horario", "Horario cargado, primer ciclo"], ["antes_sitio", "Sitio para sus cosas"], ["antes_equipo", "Equipo avisado"], ["antes_docs", "Documentación impresa"], ["antes_avisar", `Avisar a ${c || "la compañera"} de que acoge`]] },
  { id: "dia", t: "El primer día", items: [["dia_recepcion", "Recepción de dirección · 30 min"], ["dia_guion", "Guion enviado a la compañera"], ["dia_parte", "Parte del final del turno recibido"]] },
  { id: "despues", t: "Después", items: [["despues_videos", "Adelantarle 2 vídeos"], ["despues_d7", `Repaso del día 7${a.fecha_entrada ? " · " + fechaCorta(masDias(a.fecha_entrada, 7)) : ""}`], ["despues_d30", `Repaso del día 30${a.fecha_entrada ? " · " + fechaCorta(masDias(a.fecha_entrada, 30)) : ""}`]] },
];
const TOTAL_CASILLAS = 12;
const nombreCorto = (s) => (s || "").split(" ")[0];
const casillasHechas = (a) => Object.values(a.checks || {}).filter(Boolean).length;
const pct = (a) => Math.round((Math.min(casillasHechas(a), TOTAL_CASILLAS) / TOTAL_CASILLAS) * 100);
const pasosHechos = (a) => (a.recepcion?.hechos || []).length;
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
  const [vista, setVista] = useState("ficha"); // ficha | guiado | guion (con foco)
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

  if (a && vista === "guiado") return <Guiado a={a} guardar={guardar} salir={(v) => setVista(v || "ficha")} />;
  if (a && vista === "guion") return <Guion a={a} guardar={guardar} volver={() => setVista("ficha")} />;
  if (a) return <Ficha a={a} hoy={hoy} equipo={equipo} guardar={guardar} volver={() => setFoco(null)} ver={setVista} recargar={cargar} />;

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

function etiqueta(a, hoy) {
  if (a.estado === "borrador") return { c: "gris", t: "Sin fecha" };
  if (!a.fecha_entrada) return null;
  if (a.fecha_entrada === hoy) return { c: "rojo", t: "Hoy" };
  if (a.fecha_entrada > hoy) return { c: "gris", t: a.fecha_entrada === masDias(hoy, 1) ? "Mañana" : "Próxima" };
  if (hoy >= masDias(a.fecha_entrada, 30) && !a.checks?.despues_d30) return { c: "oro", t: "Día 30" };
  if (hoy >= masDias(a.fecha_entrada, 7) && !a.checks?.despues_d7) return { c: "oro", t: "Día 7" };
  return null;
}
const guionDesfasado = (a) => a.guion_para && a.acoge_final_id && a.guion_para !== a.acoge_final_id;

function Tarjeta({ a, hoy, onClick }) {
  const et = etiqueta(a, hoy);
  const entra = a.fecha_entrada ? (a.fecha_entrada < hoy ? `entró el ${fechaCorta(a.fecha_entrada)}` : `entra el ${fechaCorta(a.fecha_entrada)}`) : "sin fecha: ponle su primer turno de Formación en Horarios";
  return (
    <button className="aco-card" onClick={onClick}>
      <div className="aco-who"><span className="aco-av">{(a.nombre || "?")[0]}</span><span className="aco-t"><b>{a.nombre}</b><small>{a.tipo_turno === "principal" ? "Principal" : "Apoyo"} · {entra}</small></span>{et && <span className={`aco-tag ${et.c}`}>{et.t}</span>}</div>
      <div className="aco-pb"><i style={{ width: `${pct(a)}%` }} /></div>
      <div className="aco-row"><span>{pasosHechos(a)} de 9 pasos de la recepción</span><span>{a.acoge_final_nombre ? `Acoge: ${nombreCorto(a.acoge_final_nombre)}` : "Sin compañera que acoja"}</span></div>
      {guionDesfasado(a) && <div className="aco-row aco-rojo">El guion se mandó a {nombreCorto(a.guion_para_nombre)} y ahora acoge {nombreCorto(a.acoge_final_nombre)}: vuelve a mandarlo.</div>}
      <div className="aco-row aco-link">Abrir la ficha →</div>
    </button>
  );
}

function Ficha({ a, hoy, equipo, guardar, volver, ver, recargar }) {
  const c = a.acoge_final_nombre;
  const activa = a.estado === "en_curso" || a.estado === "borrador";
  const marcar = (k) => activa && guardar(a, { checks: { ...(a.checks || {}), [k]: !a.checks?.[k] } });
  const companeras = (equipo || []).filter((u) => u.activo && u.rol === "trabajadora" && u.id !== a.usuario_id);
  const cambiarEstado = async (estado) => {
    const txt = estado === "cancelada" ? `¿Cancelar la acogida de ${a.nombre}? Queda guardada como cancelada.` : `¿Dar por terminada la acogida de ${a.nombre}?`;
    if (!(await confirmar(txt))) return;
    await guardar(a, { estado, ...(estado === "cancelada" ? { cancelada_en: new Date().toISOString() } : { terminada_en: new Date().toISOString() }) });
    avisar(estado === "cancelada" ? "Acogida cancelada" : "Acogida terminada"); recargar(); volver();
  };
  const todo = casillasHechas(a) >= TOTAL_CASILLAS;
  return (
    <div className="aco">
      <button className="aco-back" onClick={volver}>← Acogida</button>
      <div className="aco-card fija">
        <div className="aco-who"><span className="aco-av">{(a.nombre || "?")[0]}</span><span className="aco-t"><b>{a.nombre}</b>
          <small>{a.fecha_entrada ? `Entra el ${fechaCorta(a.fecha_entrada)}` : "Sin fecha todavía"}{a.turno_dia === "Formación" && a.ini ? ` · Formación ${a.ini.slice(0, 5)}–${(a.fin || "").slice(0, 5)}` : ""}{c ? ` · acoge ${nombreCorto(c)}` : ""}</small></span>
          {a.estado !== "en_curso" && <span className="aco-tag gris">{a.estado === "borrador" ? "Borrador" : a.estado === "terminada" ? "Terminada" : "Cancelada"}</span>}</div>
        <div className="aco-pb"><i style={{ width: `${pct(a)}%` }} /></div>
        <div className="aco-row"><span>{pasosHechos(a)} de 9 pasos de la recepción</span><span>{pct(a)} %</span></div>
        {a.estado === "borrador" && <div className="aco-row aco-rojo">Aún no tiene fecha: la coge sola de su primer turno de Formación en Horarios. <button className="btn-txt" onClick={() => ir("personas/horarios")}>Ir a Horarios</button></div>}
        {guionDesfasado(a) && <div className="aco-row aco-rojo">El guion se mandó a {nombreCorto(a.guion_para_nombre)} y ahora acoge {nombreCorto(c)}: vuelve a mandarlo.</div>}
      </div>
      {activa && (
        <label className="aco-sel">Quién la acoge
          <select value={a.acoge_id || ""} onChange={(e) => guardar(a, { acoge_id: e.target.value || null }, {}, true)}>
            <option value="">{a.acoge_horario_nombre ? `La principal del turno: ${a.acoge_horario_nombre}` : "La principal del turno (aún sin horario)"}</option>
            {companeras.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </label>
      )}
      {activa && (
        <div className="aco-btns">
          <button className="aco-btn" onClick={() => ver("guiado")}>{pasosHechos(a) || a.recepcion?.paso ? "Seguir la recepción" : "Empezar recepción · 30 min"}</button>
          <button className="aco-btn ghost" onClick={() => ver("guion")}>Guion de la compañera</button>
        </div>
      )}
      {BLOQUES(a, nombreCorto(c)).map((b) => {
        const d = b.items.filter(([k]) => a.checks?.[k]).length;
        return (
          <div key={b.id} className="aco-blk">
            <div className="aco-bh">{b.t}<em>{d} de {b.items.length}</em></div>
            {b.items.map(([k, t]) => (
              <button key={k} className={`aco-ck${a.checks?.[k] ? " done" : ""}`} onClick={() => marcar(k)} disabled={!activa} aria-pressed={!!a.checks?.[k]}><i /><span>{t}</span></button>
            ))}
          </div>
        );
      })}
      <p className="aco-small">Los repasos del día 7 y del día 30 saltan solos en la campana del panel.</p>
      {activa && (
        <div className="aco-btns">
          <button className={`aco-btn${todo ? "" : " ghost"}`} onClick={() => cambiarEstado("terminada")}>Dar por terminada</button>
          <button className="aco-btn ghost peligro" onClick={() => cambiarEstado("cancelada")}>No ha llegado a entrar: cancelar</button>
        </div>
      )}
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

function Guion({ a, guardar, volver }) {
  const c = nombreCorto(a.acoge_final_nombre) || "compañera";
  const texto = guionDe(nombreCorto(a.nombre), c);
  const [estado, setEstado] = useState("");
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setEstado("Copiado: pégalo en WhatsApp"); }
    catch (e) { setEstado("No se ha podido copiar solo: selecciona el texto y cópialo"); return; }
    guardar(a, { checks: { ...(a.checks || {}), dia_guion: true }, guion_para: a.acoge_final_id || null }, { guion_para_nombre: a.acoge_final_nombre || null });
  };
  return (
    <div className="aco">
      <button className="aco-back" onClick={volver}>← Ficha de {nombreCorto(a.nombre)}</button>
      <h2 className="aco-h">Guion para {c}</h2>
      <p className="aco-cap">{a.fecha_entrada ? fechaCorta(a.fecha_entrada) : "Sin fecha"} · acoge a {nombreCorto(a.nombre)}{!a.acoge_final_id ? " · todavía no hay nadie que la acoja: elígela en la ficha" : ""}</p>
      <div className="aco-wa">{texto}</div>
      <button className="aco-btn" onClick={copiar}>Copiar para WhatsApp</button>
      {estado && <p className="aco-small">{estado}</p>}
      {a.checks?.dia_guion && <p className="aco-small">Guion marcado como enviado{a.guion_para_nombre ? ` a ${nombreCorto(a.guion_para_nombre)}` : ""}.</p>}
      <div className="aco-blk">
        <div className="aco-bh">Las tres preguntas de cierre<em>antes de que se vaya</em></div>
        {PREGUNTAS.map((t) => <div key={t} className="aco-ck"><i /><span>{t}</span></div>)}
      </div>
      <p className="aco-small">La segunda es la importante: si contesta «nada», no ha entendido la pregunta. Que insista.</p>
      <div className="aco-blk">
        <div className="aco-bh">Las tres líneas a dirección<em>{a.checks?.dia_parte ? "recibidas" : "pendiente"}</em></div>
        {LINEAS.map((t) => <div key={t} className="aco-ck"><i /><span>{t}</span></div>)}
        <button className={`aco-ck${a.checks?.dia_parte ? " done" : ""}`} onClick={() => guardar(a, { checks: { ...(a.checks || {}), dia_parte: !a.checks?.dia_parte } })}><i /><span><b>Ya me las ha mandado</b> (marca «Parte del final del turno recibido»)</span></button>
      </div>
    </div>
  );
}
