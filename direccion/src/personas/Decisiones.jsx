// #202 · Personas → Seguimiento → «Decisiones»: una sola bandeja con todo lo que espera a dirección.
// Cada tarjeta se responde con un botón. «Sí cuenta» emite el aviso con sus 48 h; si la trabajadora no alega,
// el fallo se anota solo (seg_auto_tick). Si alega, vuelve aquí como «Ha alegado». Las amonestaciones van en «Expedientes».
import { useEffect, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Cargando, Panel, avisar, fechaCorta } from "../ui.jsx";
import { eur } from "../fmt.js";

export const TIPOS = [
  { id: "verif", label: "Verificaciones" },
  { id: "causa", label: "Tareas no hechas" },
  { id: "apoyo", label: "Al apoyo" },
  { id: "sin_cerrar", label: "Sin cerrar" },
  { id: "sin_verif", label: "Sin verificar" },
  { id: "alegado", label: "Han alegado" },
];
const ETIQ = { verif: "Verificación", causa: "Tarea no hecha", apoyo: "Pasadas al apoyo", sin_cerrar: "Turno sin cerrar", sin_verif: "Sin verificar", alegado: "Ha alegado" };
const PRISA_DIAS = 7;

const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const diasHasta = (f, hoy) => Math.round((new Date(`${f}T12:00:00`) - new Date(`${hoy}T12:00:00`)) / 86400000);
const diaHora = (ts) => new Date(ts).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const diaNum = (f) => { const p = String(f).slice(0, 10).split("-"); return `${p[2]}/${p[1]}`; };
const camaras = (pr, fecha) => (pr && pr.horario ? `de ${pr.horario.replace("–", " a ")} del ${diaNum(fecha)}` : `turno del ${diaNum(fecha)}`);

// Ordena y parte la bandeja: «Corre prisa» = prescribe en 7 días o menos (y aún no ha prescrito)
export function partir(items, hoy) {
  const conDias = items.map((x) => ({ ...x, dias: x.vence ? diasHasta(x.vence, hoy) : null }));
  const prisa = conDias.filter((x) => x.dias != null && x.dias >= 0 && x.dias <= PRISA_DIAS).sort((a, b) => a.dias - b.dias || String(a.desde).localeCompare(String(b.desde)));
  // el resto: lo más antiguo arriba (lo que no prescribe, por fecha)
  const resto = conDias.filter((x) => !(x.dias != null && x.dias >= 0 && x.dias <= PRISA_DIAS))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.desde).localeCompare(String(b.desde)));
  return { prisa, resto };
}

export async function cargarDecisiones() {
  const r = await sb.rpc("seg_decisiones", {});
  return (r && r.items) || [];
}

export function Decisiones({ filtro, setFiltro, onCuenta }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [fotos, setFotos] = useState(null);
  const cargar = useCallback(async () => {
    setError("");
    try { const l = await cargarDecisiones(); setItems(l); onCuenta && onCuenta(l.length); }
    catch (e) { setError("No se ha podido cargar la bandeja."); setItems([]); }
  }, [onCuenta]);
  useEffect(() => { cargar(); }, [cargar]);

  const quitar = (key) => setItems((l) => { const n = (l || []).filter((x) => x.key !== key); onCuenta && onCuenta(n.length); return n; });
  const hacer = async (x, fn, ok) => {
    setBusy(x.key);
    try { const r = await fn(); if (r && r.ok === false) throw new Error(r.error || "No se ha podido guardar"); avisar(ok); quitar(x.key); }
    catch (e) { avisar(e.message || "No se ha podido guardar", "error"); }
    setBusy("");
  };
  const disc = (action, extra) => sb.fn("disciplina", { action, ...extra });

  const acciones = {
    verif_si: (x) => hacer(x, () => disc("emitir_verificacion", { incidencia_id: x.id }), "Aviso enviado con sus 48 horas para alegar"),
    verif_no: (x) => hacer(x, () => disc("descartar_verificacion", { incidencia_id: x.id }), "Archivada: no se avisa a nadie"),
    causa_si: (x) => hacer(x, () => disc("revisar_causa", { cierre_item_id: x.id, decision: "rechazada" }), "Aviso enviado a las personas del turno con sus 48 horas"),
    causa_no: (x) => hacer(x, () => disc("revisar_causa", { cierre_item_id: x.id, decision: "validada" }), "Archivada: el motivo vale y no cuenta"),
    apoyo: (x, quien) => hacer(x, () => sb.rpc("seg_traspaso_decidir", { p_cierre_id: x.id, p_quien: quien }),
      quien === "nadie" ? "Guardado: no cuenta a nadie" : (quien === "apoyo" && x.apoyo_eventual) ? "Guardado. Es eventual: no lleva aviso ni plus" : `Aviso enviado ${quien === "principal" ? "a la principal" : "al apoyo"} con sus 48 horas`),
    reabrir: (x) => { if (!window.confirm(`Se reabre el cierre del turno de ${x.turno} del ${diaNum(x.fecha)}: a ${x.quien || "la principal"} le llega el aviso y tiene 48 horas para cerrarlo con la fecha original. Si lo cierra a tiempo, no hay fallo por no cerrar, pero la reapertura cuenta para la regla de 3 en 30 días. ¿Reabrir?`)) return; hacer(x, () => sb.rpc("reabrir_turno_cierre", { p_fecha: x.fecha, p_turno: x.turno }), "Turno reabierto: 48 horas para cerrarlo"); },
    dejar: (x) => hacer(x, () => disc("emitir_no_cierre", { fecha: x.fecha, turno: x.turno }), "Hecho: aviso a la principal con sus 48 horas"),
    visto: (x) => hacer(x, () => sb.rpc("seg_sin_verificar_visto", { p_fecha: x.fecha, p_turno: x.turno }), "Hecho"),
    mantener: (x) => hacer(x, () => disc("resolver", { aviso_id: x.id, resultado: "confirmado" }), "Fallo mantenido"),
    quitarFallo: (x) => hacer(x, () => disc("resolver", { aviso_id: x.id, resultado: "sin_fallo" }), "Fallo quitado"),
  };
  const verFotos = async (x) => {
    setFotos({ x, lista: null });
    try { const r = await sb.fn("incidencias", { action: "detalle", id: x.id }); setFotos({ x, lista: (r.fotos && r.fotos.length ? r.fotos : (r.foto ? [r.foto] : [])) }); }
    catch (e) { setFotos({ x, lista: [] }); }
  };

  if (!items) return <Cargando />;
  const hoy = hoyMadrid();
  const n = (t) => items.filter((x) => x.tipo === t).length;
  const vis = filtro ? items.filter((x) => x.tipo === filtro) : items;
  const { prisa, resto } = partir(vis, hoy);
  const props = { hoy, busy, acciones, verFotos };
  return (
    <>
      <div className="dec-chips" role="group" aria-label="Filtrar por tipo">
        <button className={!filtro ? "on" : ""} onClick={() => setFiltro("")}>Todo · {items.length}</button>
        {TIPOS.filter((t) => n(t.id) > 0 || filtro === t.id).map((t) => <button key={t.id} className={filtro === t.id ? "on" : ""} onClick={() => setFiltro(filtro === t.id ? "" : t.id)}>{t.label} · {n(t.id)}</button>)}
      </div>
      {error && <p className="empty">{error}</p>}
      {error ? null : vis.length === 0 ? <div className="card"><p className="dec-vacio">Nada que decidir ✓</p></div> : (
        <>
          {prisa.length > 0 && <><h3 className="dec-tit">Corre prisa · prescribe esta semana</h3><div className="dec-lista">{prisa.map((x) => <Tarjeta key={x.key} x={x} {...props} />)}</div></>}
          {resto.length > 0 && <><h3 className="dec-tit">El resto</h3><div className="dec-lista">{resto.map((x) => <Tarjeta key={x.key} x={x} {...props} />)}</div></>}
          <p className="sub dec-pie">Al decir «sí cuenta», le llega el aviso escrito con sus 48 horas para alegar. Si no alega, el fallo se anota solo y no vuelve a aparecer aquí; si alega, vuelve como «Ha alegado». Las amonestaciones no están en este trámite: se ponen desde «Expedientes».</p>
        </>
      )}
      {fotos && (
        <Panel titulo={fotos.x.tarea} sub={`Fotos de ${fotos.x.reporta || "la compañera"} · ${fechaCorta(fotos.x.fecha)}`} onClose={() => setFotos(null)}>
          {fotos.lista === null ? <Cargando texto="Cargando fotos…" /> : fotos.lista.length === 0 ? <p className="empty">Sin fotos.</p> : fotos.lista.map((u, i) => <img key={i} className="foto-inc" src={u} alt={`Foto ${i + 1} de ${fotos.x.tarea}`} style={{ marginBottom: 10 }} />)}
        </Panel>
      )}
    </>
  );
}

function Plazo({ x }) {
  if (x.tipo === "sin_cerrar") return <span className="dec-plazo prisa">{x.puede_reabrir ? `reabrir hasta ${diaHora(x.reabrir_hasta)}` : "ya no se puede reabrir"}</span>;
  if (x.dias == null) return <span className="dec-plazo">sin plazo</span>;
  if (x.dias < 0) return <span className="dec-plazo pasado" title="Pasado el plazo se puede confirmar el fallo del plus, pero no poner la falta">prescrita · solo plus</span>;
  return <span className={`dec-plazo ${x.dias <= 3 ? "prisa" : ""}`}>{x.dias === 0 ? "prescribe hoy" : x.dias === 1 ? "prescribe mañana" : `prescribe en ${x.dias} días`}</span>;
}

function Pruebas({ x, conFotos, verFotos }) {
  const pr = x.pruebas || {};
  const provs = pr.proveedores || [];
  return (
    <>
      <div className="dec-pruebas">
        <div><small>Ventas del turno</small><b>{pr.ventas != null ? eur(pr.ventas) : "—"}</b></div>
        <div title={provs.map((p) => `${p.proveedor} ${p.hora}`).join(" · ")}><small>Proveedores</small><b>{provs.length || "Ninguno"}</b>{provs.length > 0 && <em>{provs.map((p) => p.hora).join(" y ")}</em>}</div>
        <div><small>Cámaras</small><b className="dec-cam">{camaras(pr, x.fecha)}</b></div>
        {conFotos && <div><small>Fotos</small><b>{x.fotos || 0}</b>{x.fotos > 0 && <button className="dec-link" onClick={() => verFotos(x)}>Ver {x.fotos === 1 ? "la foto" : `las ${x.fotos} fotos`}</button>}</div>}
      </div>
      {pr.eventual && <p className="dec-eventual"><b>Turno con eventual</b> ({pr.eventual}): comprueba de quién era la tarea. Si era de la eventual, di que no cuenta.</p>}
    </>
  );
}

function Tarjeta({ x, busy, acciones, verFotos }) {
  const ocupado = busy === x.key;
  const cab = (titulo) => (
    <div className="dec-cab"><span className={`dec-tipo t-${x.tipo}`}>{ETIQ[x.tipo]}</span><b className="dec-titulo">{titulo}</b><Plazo x={x} /></div>
  );
  const turnoTxt = `Turno de ${x.turno} · ${fechaCorta(x.fecha)}`;
  if (x.tipo === "verif") return (
    <div className="card dec-card">
      {cab(x.tarea)}
      <p className="dec-linea">{turnoTxt} · lo dejó sin hacer <b>{x.quien || "—"}</b> · lo reportó <b>{x.reporta || "—"}</b>{x.fotos ? `, con ${x.fotos === 1 ? "1 foto" : `${x.fotos} fotos`}` : ""}</p>
      {x.comentario && <p className="dec-cita">“{x.comentario}”</p>}
      <Pruebas x={x} conFotos verFotos={verFotos} />
      <div className="dec-preg"><span>¿Cuenta?</span><button className="btn-p" disabled={ocupado} onClick={() => acciones.verif_si(x)}>Sí, cuenta</button><button className="btn-l" disabled={ocupado} onClick={() => acciones.verif_no(x)}>No cuenta</button></div>
    </div>
  );
  if (x.tipo === "causa") return (
    <div className="card dec-card">
      {cab(x.tarea)}
      <p className="dec-linea">{turnoTxt} · <b>{x.quien || "—"}</b>{x.apoyo ? <> y {x.apoyo}</> : null}</p>
      <p className="dec-cita">“{x.comentario || "(sin motivo)"}”</p>
      <Pruebas x={x} verFotos={verFotos} />
      <div className="dec-preg"><span>¿Cuenta?</span><button className="btn-p" disabled={ocupado} onClick={() => acciones.causa_si(x)}>Sí, cuenta</button><button className="btn-l" disabled={ocupado} onClick={() => acciones.causa_no(x)}>No cuenta</button></div>
      <p className="sub dec-nota">Si cuenta, el aviso va a las dos personas del turno, como hasta ahora.</p>
    </div>
  );
  if (x.tipo === "apoyo") {
    const tareas = x.tareas || [];
    const porTarea = x.n ? x.minutos / x.n : null;
    const ambar = porTarea != null && porTarea < x.umbral;
    const hechas = tareas.filter((t) => t.estado === "hecha").length;
    const fin = (t) => t.estado === "hecha" ? `hecha${t.hora ? ` a las ${t.hora}` : ""}` : t.estado === "no_hecha" ? (t.a_medias ? "a medias" : "no hecha") : t.estado === "sin_cerrar" ? "sin cerrar" : "pendiente";
    return (
      <div className={`card dec-card ${ambar ? "ambar" : ""}`}>
        {cab(`${x.n} ${x.n === 1 ? "tarea" : "tareas"} · ${tareas.map((t) => t.texto).join(", ")}`)}
        <p className="dec-linea">{turnoTxt} · <b>{x.quien || "La principal"}</b> se las pasó a <b>{x.apoyo || "la persona de apoyo"}</b>{x.apoyo_eventual ? " (eventual)" : ""}</p>
        <div className="dec-pruebas">
          <div><small>Le pasó</small><b>{x.n} {x.n === 1 ? "tarea" : "tareas"}</b></div>
          <div><small>A {x.apoyo || "la apoyo"} le quedaban</small><b>{x.minutos} min</b></div>
          <div><small>Resultado</small><b>{hechas} {hechas === 1 ? "hecha" : "hechas"} · {tareas.length - hechas} sin hacer</b></div>
        </div>
        <ul className="dec-tareas">{tareas.map((t, i) => <li key={i} className={t.estado === "hecha" ? "ok" : "mal"}><span>{t.estado === "hecha" ? "✓" : "✗"}</span>{t.texto} · {fin(t)}{t.justificacion ? <em> “{t.justificacion}”</em> : null}</li>)}</ul>
        {ambar && <p className="dec-ambar">{Math.round(porTarea)} minutos por tarea. Por debajo de {x.umbral}, así que míralo antes de decidir: puede que no le diera tiempo a nadie.</p>}
        <div className="dec-preg"><span>¿A quién cuenta?</span><button className="btn-p" disabled={ocupado} onClick={() => acciones.apoyo(x, "principal")}>A la principal</button><button className="btn-p" disabled={ocupado} onClick={() => acciones.apoyo(x, "apoyo")}>Al apoyo</button><button className="btn-l" disabled={ocupado} onClick={() => acciones.apoyo(x, "nadie")}>A nadie</button></div>
        {x.apoyo_eventual && <p className="sub dec-nota">{x.apoyo} es eventual: si dices que cuenta al apoyo, queda registrado, pero no lleva aviso ni resta plus.</p>}
      </div>
    );
  }
  if (x.tipo === "sin_cerrar") return (
    <div className="card dec-card">
      {cab(`${x.turno === "mañana" ? "Mañana" : "Tarde"} · ${fechaCorta(x.fecha)}`)}
      <p className="dec-linea">El plazo para cerrarlo terminó el {diaHora(x.plazo_fin)} · principal <b>{x.quien || "—"}</b>{x.reabierto_vencido ? " · se reabrió y pasaron sus 48 horas sin cerrarlo" : ""}</p>
      <p className="dec-cita normal"><b>El fallo ya está contado:</b> no hay nada que decidir. {x.puede_reabrir ? "Si no lo reabres, el aviso le llega solo al pasar las 72 horas. " : "El aviso le llega solo en la siguiente pasada. "}Reabrir sirve para que no se pierda el registro del turno.</p>
      <div className="dec-preg"><span>{x.puede_reabrir ? "¿Lo reabres?" : "¿Qué hago?"}</span>{x.puede_reabrir && <button className="btn-p" disabled={ocupado} onClick={() => acciones.reabrir(x)}>Reabrir</button>}<button className="btn-l" disabled={ocupado} onClick={() => acciones.dejar(x)}>Dejarlo así</button></div>
      <p className="sub dec-nota">«Dejarlo así» envía ya el aviso a la principal con sus 48 horas para alegar.</p>
    </div>
  );
  if (x.tipo === "sin_verif") return (
    <div className="card dec-card">
      {cab(`Cierre de ${x.prev_turno} · ${fechaCorta(x.prev_fecha)}`)}
      <p className="dec-linea">Lo cerró <b>{x.cerro || "—"}</b> · tocaba verificarlo en el turno de {x.turno} del {diaNum(x.fecha)}, hasta las {x.hasta} · no se verificó</p>
      <p className="dec-cita normal">El aviso a <b>{x.quien || "la responsable"}</b> ya salió solo (supuesto 5){x.aviso_alegado ? " y ha alegado: lo tienes también como «Ha alegado»." : ". Si no alega en 48 horas, el fallo se anota solo; si alega, vuelve aquí."}</p>
      <div className="dec-preg"><button className="btn-l" disabled={ocupado} onClick={() => acciones.visto(x)}>Entendido</button></div>
    </div>
  );
  if (x.tipo === "alegado") return (
    <div className="card dec-card">
      {cab(`${x.quien || "—"} · ${x.tarea || (x.descripcion || "").slice(0, 60)}`)}
      <p className="dec-linea">{turnoTxt} · {x.descripcion}</p>
      <div className="dec-alega"><small>Lo que dice {x.quien || "la trabajadora"} ({diaHora(x.alegacion_en)})</small><p>{x.alegacion || "(sin texto)"}</p></div>
      <Pruebas x={x} verFotos={verFotos} />
      <div className="dec-preg"><span>¿Mantienes el fallo?</span><button className="btn-p" disabled={ocupado} onClick={() => acciones.mantener(x)}>Lo mantengo</button><button className="btn-l" disabled={ocupado} onClick={() => acciones.quitarFallo(x)}>Lo quito</button></div>
      <p className="sub dec-nota">«Lo mantengo» anota el fallo sin poner falta. Si además quieres amonestar, hazlo desde «Expedientes».</p>
    </div>
  );
  return null;
}
