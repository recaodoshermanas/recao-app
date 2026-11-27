// #202 · Personas → Seguimiento → «Expedientes»: por persona, contadores, faltas vigentes, fallos del mes,
// lo que espera sus 48 horas y las dos acciones aparte: fallo manual y amonestar (con la prescripción comprobada).
import { useEffect, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Panel, Pestanas, avisar, useEquipo, hoyStr } from "../ui.jsx";

const SUPTXT = { 1: "Tarea marcada hecha, desmentida", 2: "Registro no veraz", 3: "Tarea no hecha, motivo no aceptado", 4: "No cerró el turno", 5: "No verificó el turno anterior" };
const NIVEL_L = { leve: "Leve", grave: "Grave", muy_grave: "Muy grave" };
const fmtF = (s) => { if (!s) return ""; const p = String(s).slice(0, 10).split("-"); return `${p[2]}/${p[1]}/${p[0]}`; };
const diaHora = (ts) => new Date(ts).toLocaleString("es-ES", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const textoFallo = (f) => f.origen === "manual" ? "Fallo manual" : f.origen === "reaperturas" ? "3 turnos reabiertos en 30 días" : f.origen === "traspaso" ? "Tarea pasada al apoyo sin hacer" : (SUPTXT[f.supuesto] || "Fallo");

export function Expedientes() {
  const [vista, setVista] = useState("persona");
  return (
    <>
      <Pestanas valor={vista} onChange={setVista} etiqueta="Expedientes" opciones={[{ id: "persona", label: "Por persona" }, { id: "historial", label: "Historial de decisiones" }]} />
      {vista === "persona" ? <PorPersona /> : <Historial />}
    </>
  );
}

// #239: control histórico de todo lo que pasa por «Decisiones» (verificaciones, tareas no hechas y pasadas al apoyo):
// «Sí, cuenta», «No cuenta» y «No decidida · plazo vencido» (lo que llegó al último día del mes del turno sin decidir). Nada se borra.
const RES = { si: "Sí, cuenta", no: "No cuenta", vencida: "No decidida · plazo vencido" };
const TIPO_H = { verif: "Verificación", causa: "Tarea no hecha", apoyo: "Pasada al apoyo" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesTxt = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const mesMas = (m, n) => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const avisoTxt = (x) => {
  if (x.resultado !== "si") return "";
  if (x.tipo === "apoyo" && !x.aviso_estado) return "sin aviso (eventual)";
  if (!x.aviso_estado) return "";
  if (x.aviso_estado === "emitido") return x.alego ? "ha alegado: pendiente de resolver" : "en sus 48 horas para alegar";
  return x.aviso_resultado === "confirmado" ? "fallo anotado" : x.aviso_resultado === "sin_fallo" ? (x.alego ? "alegó y se quitó el fallo" : "fallo quitado") : x.aviso_resultado === "descartado" ? "aviso descartado" : "resuelto";
};

function Historial() {
  const [mes, setMes] = useState(hoyStr().slice(0, 7));
  const [filtro, setFiltro] = useState("todas");
  const [d, setD] = useState(null);
  useEffect(() => {
    let vivo = true; setD(null);
    sb.rpc("seg_historial_decisiones", { p_mes: mes }).then((r) => vivo && setD({ items: (r && r.items) || [] })).catch(() => vivo && setD({ error: true }));
    return () => { vivo = false; };
  }, [mes]);
  const items = d && d.items ? d.items : [];
  const n = (k) => items.filter((x) => x.resultado === k).length;
  const lista = filtro === "todas" ? items : items.filter((x) => x.resultado === filtro);
  const actual = hoyStr().slice(0, 7);
  return (
    <div className="card">
      <div className="filtros-linea">
        <button className="btn-l" onClick={() => setMes(mesMas(mes, -1))} aria-label="Mes anterior">‹</button>
        <b className="hist-mes">{mesTxt(mes)}</b>
        <button className="btn-l" disabled={mes >= actual} onClick={() => setMes(mesMas(mes, 1))} aria-label="Mes siguiente">›</button>
      </div>
      {!d ? <Cargando /> : d.error ? <p className="empty">No se ha podido cargar el historial.</p> : (
        <>
          <Pestanas valor={filtro} onChange={setFiltro} etiqueta="Resultado" opciones={[{ id: "todas", label: `Todas · ${items.length}` }, { id: "si", label: `Sí, cuenta · ${n("si")}` }, { id: "no", label: `No cuenta · ${n("no")}` }, { id: "vencida", label: `No decididas · ${n("vencida")}` }]} />
          {lista.length === 0 ? <p className="sub">Nada en {mesTxt(mes)}{filtro !== "todas" ? " con ese resultado" : ""}.</p> : (
            <ul className="exp-lista">{lista.map((x) => {
              const av = avisoTxt(x);
              return (
                <li key={x.key}>
                  <b><span className={`hist-res r-${x.resultado}`}>{RES[x.resultado] || x.resultado}</span> {TIPO_H[x.tipo]} · turno de {x.turno} · {fmtF(x.fecha)}</b>
                  <span>{x.tarea || "—"}</span>
                  <small>
                    {x.tipo === "apoyo" ? <>{x.quien || "La principal"} se las pasó a {x.apoyo || "la persona de apoyo"}{x.resultado === "si" && x.cuenta_a ? ` · cuenta ${x.cuenta_a === "principal" ? "a la principal" : "al apoyo"}` : ""}</> : <>{x.tipo === "verif" ? "Lo dejó sin hacer" : "Turno de"} {x.quien || "—"}{x.reporta ? ` · lo reportó ${x.reporta}` : ""}</>}
                    {av ? ` · ${av}` : ""}
                    {x.resultado === "vencida" ? ` · el plazo del plus terminó el ${fmtF(x.plus_hasta)}` : x.decidido_en ? ` · decidido el ${diaHora(x.decidido_en)}${x.decidido_por ? ` por ${x.decidido_por}` : ""}` : ""}
                  </small>
                </li>
              );
            })}</ul>
          )}
          <p className="sub">Aquí queda todo lo que ha pasado por «Decisiones», por el mes del turno. Lo que no se decide hasta el último día de ese mes sale de la bandeja y queda como «No decidida · plazo vencido», sin fallo. Nada se borra.</p>
        </>
      )}
    </div>
  );
}

function PorPersona() {
  const { equipo } = useEquipo();
  const trab = (equipo || []).filter((u) => u.rol === "trabajadora" && u.activo !== false && !u.eventual).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const [uid, setUid] = useState("");
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null); // "fallo" | "amonestar"
  useEffect(() => { if (!uid && trab[0]) setUid(trab[0].id); }, [trab, uid]);
  const cargar = useCallback(async () => {
    if (!uid) return;
    setD(null);
    try {
      const hoy = hoyStr(); const mes0 = `${hoy.slice(0, 7)}-01`;
      const [faltas, fallos, f30, s90, av] = await Promise.all([
        sb.select("faltas", `select=*&usuario_id=eq.${uid}&or=(fecha_caducidad.is.null,fecha_caducidad.gte.${hoy})&order=fecha.desc`),
        sb.select("fallos", `select=*&usuario_id=eq.${uid}&estado=eq.confirmado&fecha=gte.${masDiasStr(hoy, -90)}&order=fecha.desc&limit=100`),
        sb.rpc("disc_fallos_30", { p_uid: uid }), sb.rpc("disc_falsedades_90", { p_uid: uid }),
        sb.fn("disciplina", { action: "listar_avisos", estado: "emitido", usuario_id: uid }),
      ]);
      const esperando = ((av && av.avisos) || []).filter((a) => a.usuario_id === uid && !a.alegacion_en);
      setD({ faltas: faltas || [], fallos: fallos || [], mes: (fallos || []).filter((f) => f.fecha >= mes0), f30: Number(f30) || 0, s90: Number(s90) || 0, esperando });
    } catch (e) { setD({ error: true }); }
  }, [uid]);
  useEffect(() => { cargar(); }, [cargar]);
  const persona = trab.find((t) => t.id === uid);

  return (
    <>
      <div className="filtros-linea">
        <select value={uid} onChange={(e) => setUid(e.target.value)} aria-label="Persona">{trab.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
        {uid && <><button className="btn-l" onClick={() => setForm("fallo")}>+ Fallo manual</button><button className="btn-p" onClick={() => setForm("amonestar")}>Amonestar · leve, grave o muy grave</button></>}
      </div>
      {!uid ? <p className="empty">Elige una persona.</p> : !d ? <Cargando /> : d.error ? <p className="empty">No se ha podido cargar el expediente.</p> : (
        <div className="card">
          <div className="dec-pruebas exp-cont">
            <div className={d.f30 >= 3 ? "mal" : ""}><small>Fallos · 30 días</small><b>{d.f30}<span>/4</span></b></div>
            <div className={d.s90 >= 2 ? "mal" : ""}><small>Registros no veraces · 90 días</small><b>{d.s90}<span>/3</span></b></div>
            <div><small>Esperando sus 48 horas</small><b>{d.esperando.length}</b></div>
          </div>
          {d.f30 === 3 && <p className="dec-ambar">A un fallo del umbral de 4 en 30 días.</p>}
          <h3 className="sub-tit">Esperando sus 48 horas</h3>
          {d.esperando.length === 0 ? <p className="sub">Nada en plazo de alegación.</p> : (
            <ul className="exp-lista">{d.esperando.map((a) => <li key={a.id}><b>Turno de {a.turno} · {fmtF(a.fecha)}</b><span>{a.descripcion}</span><small>{a.plazo_vencido ? "Plazo cumplido: se anota en la próxima pasada (de 9:00 a 22:00)" : `Puede alegar hasta el ${diaHora(a.plazo_alegacion)}`}</small></li>)}</ul>
          )}
          <p className="sub">Lo que está en plazo de alegación se ve aquí desde que se emite; en «Decisiones» solo aparece si contesta.</p>
          <h3 className="sub-tit">Faltas vigentes</h3>
          {d.faltas.length === 0 ? <p className="sub">Sin faltas vigentes ✓</p> : (
            <ul className="exp-lista">{d.faltas.map((f) => <li key={f.id}><b><span className="chip-mal">{NIVEL_L[f.nivel] || f.nivel}</span> Del {fmtF(f.fecha)}</b><span>{f.descripcion || ""}</span><small>{f.acuse_en ? `Recibí: ${f.acuse_tipo === "no_conforme" ? "no conforme" : "firmado"}` : "Sin acuse de recibo"}{f.fecha_caducidad ? ` · caduca el ${fmtF(f.fecha_caducidad)}` : ""}</small></li>)}</ul>
          )}
          <h3 className="sub-tit">Fallos del mes · {d.mes.length}</h3>
          {d.mes.length === 0 ? <p className="sub">Sin fallos este mes ✓</p> : (
            <ul className="exp-lista">{d.mes.map((f) => <li key={f.id}><b>{f.turno ? `Turno de ${f.turno} · ` : ""}{fmtF(f.fecha)}</b><span>{textoFallo(f)}{f.cuenta_plus === false ? " · no cuenta al plus" : ""}</span>{f.es_falsedad && <small className="mal">registro no veraz</small>}</li>)}</ul>
          )}
          <p className="sub">Al amonestar, el sistema comprueba si la falta ha prescrito (10 días las leves, 20 las graves y 60 las muy graves, art. 42 del convenio) y no deja ponerla si se ha pasado el plazo.</p>
        </div>
      )}
      {form === "fallo" && persona && <FalloManual persona={persona} onClose={() => setForm(null)} onHecho={() => { setForm(null); cargar(); }} />}
      {form === "amonestar" && persona && d && !d.error && <Amonestar persona={persona} fallos={d.fallos} onClose={() => setForm(null)} onHecho={() => { setForm(null); cargar(); }} />}
    </>
  );
}

function masDiasStr(f, n) { const x = new Date(`${f}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }

function FalloManual({ persona, onClose, onHecho }) {
  const [fecha, setFecha] = useState(hoyStr());
  const [turno, setTurno] = useState("");
  const [desc, setDesc] = useState("");
  const [plus, setPlus] = useState(true);
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    if (!desc.trim()) { avisar("Escribe qué ha pasado", "error"); return; }
    setBusy(true);
    try { const r = await sb.fn("disciplina", { action: "crear_fallo_manual", usuario_id: persona.id, fecha, turno: turno || null, descripcion: desc.trim(), cuenta_plus: plus }); if (r && r.ok === false) throw new Error(r.error); avisar("Fallo anotado"); onHecho(); }
    catch (e) { avisar(e.message || "No se ha podido guardar", "error"); }
    setBusy(false);
  };
  return (
    <Panel titulo={`Fallo manual · ${persona.nombre}`} sub="Se anota directamente, sin plazo de alegación. Para corregir un fallo de turno." onClose={onClose}
      pie={<button className="btn-p" disabled={busy} onClick={guardar}>{busy ? "Guardando…" : "Anotar fallo"}</button>}>
      <label className="exp-campo">Fecha<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
      <label className="exp-campo">Turno<select value={turno} onChange={(e) => setTurno(e.target.value)}><option value="">—</option><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select></label>
      <label className="exp-campo">Qué ha pasado<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <label className="exp-check"><input type="checkbox" checked={plus} onChange={(e) => setPlus(e.target.checked)} /> Cuenta para el plus</label>
    </Panel>
  );
}

function Amonestar({ persona, fallos, onClose, onHecho }) {
  const [falloId, setFalloId] = useState(fallos[0] ? String(fallos[0].id) : "otro");
  const [nivel, setNivel] = useState("leve");
  const [fecha, setFecha] = useState(hoyStr());
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    setBusy(true);
    try {
      const r = await sb.fn("disciplina", { action: "amonestar", usuario_id: persona.id, nivel, fallo_id: falloId === "otro" ? null : Number(falloId), fecha: falloId === "otro" ? fecha : undefined, descripcion: desc.trim() || undefined });
      if (r && r.ok === false) throw new Error(r.error);
      avisar("Amonestación registrada: le llega para firmar el recibí"); onHecho();
    } catch (e) { avisar(e.message || "No se ha podido guardar", "error"); }
    setBusy(false);
  };
  return (
    <Panel titulo={`Amonestar · ${persona.nombre}`} sub="Acción aparte del trámite diario. Si la falta ha prescrito, no se deja poner." onClose={onClose}
      pie={<button className="btn-p" disabled={busy} onClick={guardar}>{busy ? "Comprobando…" : "Amonestar"}</button>}>
      <label className="exp-campo">Por qué hecho
        <select value={falloId} onChange={(e) => setFalloId(e.target.value)}>
          {fallos.map((f) => <option key={f.id} value={f.id}>{fmtF(f.fecha)}{f.turno ? ` · ${f.turno}` : ""} · {textoFallo(f)}</option>)}
          <option value="otro">Otro hecho (conducta)</option>
        </select>
      </label>
      {falloId === "otro" && <label className="exp-campo">Fecha en que dirección lo conoció<input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>}
      <label className="exp-campo">Nivel
        <select value={nivel} onChange={(e) => setNivel(e.target.value)}><option value="leve">Leve (prescribe a los 10 días)</option><option value="grave">Grave (20 días)</option><option value="muy_grave">Muy grave (60 días)</option></select>
      </label>
      <label className="exp-campo">Descripción de los hechos{falloId !== "otro" ? " (opcional)" : ""}<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
    </Panel>
  );
}
