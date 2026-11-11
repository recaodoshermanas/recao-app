// Personas · Solicitudes · Ventanas (#186): las tres ventanas de elección del Protocolo de vacaciones v2.0.
// Quién ha presentado y quién no, fechas editables (se revisan cada enero), bloques de verano y reabrir la ventana a una persona.
import { useEffect, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { avisar, fechaCorta, Cargando, Avatar, Panel } from "../ui.jsx";

const NOMBRE = { verano: "Verano · dos bloques", primavera: "Primavera · una semana", otono: "Otoño · una semana" };
const ESTADO = { futura: "Aún no abre", abierta: "Abierta", cerrada: "Cerrada" };
const errMsg = (e) => { const t = String(e?.message || e || ""); const i = t.indexOf("{"); if (i >= 0) { try { return JSON.parse(t.slice(i)).message || t; } catch (x) { /* noop */ } } return t || "No se ha podido"; };
const sumar = (f, d) => { const x = new Date(f + "T00:00:00"); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };

export function VentanasVacaciones() {
  const [d, setD] = useState(null);
  const [editar, setEditar] = useState(null);
  const [reabrir, setReabrir] = useState(null);
  const cargar = useCallback(async () => {
    try { setD(await sb.rpc("vac_ventanas_panel")); } catch (e) { avisar("No se han podido cargar las ventanas", "mal"); setD({ ventanas: [] }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!d) return <Cargando />;
  const vs = d.ventanas || [];
  const ultimoAnio = vs.reduce((m, v) => Math.max(m, v.anio), 0);

  const crearAnio = async () => {
    const a = ultimoAnio + 1;
    if (!window.confirm(`Se crearán las ventanas de ${a} copiando las de ${ultimoAnio} un año más tarde. Luego revisa las fechas y los bloques. ¿Seguir?`)) return;
    try { const r = await sb.rpc("vac_ventanas_crear_anio", { p_anio: a }); avisar(`Creadas ${r?.creadas ?? 0} ventanas de ${a}`); cargar(); } catch (e) { avisar(errMsg(e), "mal"); }
  };

  return (
    <>
      <div className="card">
        <h2>Ventanas de elección de vacaciones</h2>
        <p className="sub">Protocolo v2.0. Cuando hay una ventana abierta, cada trabajadora la ve lo primero en «Mis vacaciones». Avisos automáticos: al abrir (campana y correo), a 3 días del cierre solo a quien falta, y a dirección al cerrar con quién no ha presentado. Fuera de ventana solo se piden días sueltos.</p>
      </div>
      {vs.length === 0 && <div className="card"><p className="empty">No hay ventanas configuradas.</p></div>}
      {vs.map((v) => {
        const pres = v.personas.filter((p) => p.presentado).length;
        const coinciden = {};
        if (v.tipo !== "verano") v.personas.forEach((p) => { if (p.sol_inicio && !p.fuera_plazo) (coinciden[p.sol_inicio] ||= []).push(p.nombre); });
        const pedidosVerano = {};
        if (v.tipo === "verano") v.personas.forEach((p) => { if (p.principal) (pedidosVerano[p.principal] ||= []).push(p.nombre); });
        return (
          <div className="card" key={v.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0 }}>{NOMBRE[v.tipo]} {v.anio}</h2>
                <p className="sub" style={{ margin: "4px 0 0" }}>
                  Ventana del <b>{fechaCorta(v.abre)}</b> al <b>{fechaCorta(v.cierra)}</b> · vacaciones entre el {fechaCorta(v.rango_desde)} y el {fechaCorta(v.rango_hasta)} · <b>{ESTADO[v.estado]}</b> · {pres} de {v.personas.length} han presentado
                </p>
              </div>
              <button className="btn-l" onClick={() => setEditar(v)}>Cambiar fechas{v.tipo === "verano" ? " y bloques" : ""}</button>
            </div>
            {v.tipo === "verano" && (
              <p className="sub" style={{ marginTop: 8 }}>
                {(v.bloques || []).map((b) => <span key={b.n} style={{ display: "inline-block", marginRight: 12 }}>B{b.n}: {fechaCorta(b.ini)}–{fechaCorta(b.fin)}{pedidosVerano[b.n] ? ` (${pedidosVerano[b.n].length} de principal)` : ""}</span>)}
              </p>
            )}
            <div className="tabla-scroll">
              <table className="ranking">
                <thead><tr><th>Persona</th><th>Ha presentado</th><th>Elección</th><th /></tr></thead>
                <tbody>
                  {v.personas.map((p) => {
                    const reab = p.cierra_mia && p.cierra_mia > v.cierra;
                    let elec = "–";
                    if (v.tipo === "verano" && p.principal) elec = `Principal B${p.principal} · Secundario B${p.secundario}`;
                    if (v.tipo !== "verano" && p.sol_inicio) {
                      const otras = (coinciden[p.sol_inicio] || []).filter((n) => n !== p.nombre);
                      elec = `${fechaCorta(p.sol_inicio)} – ${fechaCorta(p.sol_fin)}${p.fuera_plazo ? " · fuera de plazo" : ""}${p.sol_estado === "aceptado" ? " · aprobada" : ""}${otras.length ? ` · coincide con ${otras.join(", ")}` : ""}`;
                    }
                    return (
                      <tr key={p.id}>
                        <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatar nombre={p.nombre} size={24} />{p.nombre}</span></td>
                        <td>{p.presentado ? <span className="estado e-aceptado">Sí</span> : <span className="estado e-pendiente">{v.estado === "futura" ? "Aún no" : "No"}</span>}{reab && <small style={{ marginLeft: 6 }}>reabierta hasta {fechaCorta(p.cierra_mia)}</small>}</td>
                        <td>{elec}</td>
                        <td className="r">{v.estado !== "futura" && <button className="btn-txt" onClick={() => setReabrir({ v, p })}>Reabrir</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {v.tipo !== "verano" && <p className="sub" style={{ marginTop: 8 }}>Las semanas se aprueban o rechazan en «Por decidir», como cualquier solicitud. Si dos coinciden en plazo, resuélvelo al cerrar la ventana (sorteo).</p>}
            {v.tipo === "verano" && <p className="sub" style={{ marginTop: 8 }}>El sorteo y el reparto de verano todavía se hacen a mano (va en la solicitud #184). Cuando esté resuelto, añade los bloques con «+ Añadir vacaciones».</p>}
          </div>
        );
      })}
      {ultimoAnio > 0 && <div className="card"><button className="btn-l" onClick={crearAnio}>Crear las ventanas de {ultimoAnio + 1}</button></div>}

      {editar && <EditarVentana v={editar} onClose={() => setEditar(null)} onHecho={() => { setEditar(null); cargar(); }} />}
      {reabrir && <Reabrir {...reabrir} onClose={() => setReabrir(null)} onHecho={() => { setReabrir(null); cargar(); }} />}
    </>
  );
}

function EditarVentana({ v, onClose, onHecho }) {
  const [f, setF] = useState({ abre: v.abre, cierra: v.cierra, desde: v.rango_desde, hasta: v.rango_hasta });
  const [bloques, setBloques] = useState((v.bloques || []).map((b) => b.ini));
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    setBusy(true);
    try {
      await sb.rpc("vac_ventana_guardar", { p_id: v.id, p_abre: f.abre, p_cierra: f.cierra, p_desde: f.desde, p_hasta: f.hasta, p_bloques: v.tipo === "verano" ? bloques.map((ini) => ({ ini })) : null });
      avisar("Ventana guardada"); onHecho();
    } catch (e) { avisar(errMsg(e), "mal"); }
    setBusy(false);
  };
  const campo = (k, t) => <label className="campo" style={{ display: "block", marginBottom: 10 }}><span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t}</span><input type="date" value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>;
  return (
    <Panel titulo={`${NOMBRE[v.tipo]} ${v.anio}`} sub="Fechas de la ventana" onClose={onClose}
      pie={<><button className="btn-l" onClick={onClose}>Cancelar</button><button className="btn-p" disabled={busy} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</button></>}>
      {campo("abre", "Abre el")}
      {campo("cierra", "Cierra el (último día para presentar)")}
      {campo("desde", "Vacaciones desde")}
      {campo("hasta", "Vacaciones hasta")}
      {v.tipo === "verano" && (
        <>
          <p className="sub">Bloques de dos semanas: pon el lunes en que empieza cada uno (acaba el domingo de la semana siguiente).</p>
          {bloques.map((ini, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ width: 70, fontSize: 13, fontWeight: 600 }}>Bloque {i + 1}</span>
              <input type="date" value={ini} onChange={(e) => setBloques(bloques.map((x, j) => (j === i ? e.target.value : x)))} />
              <small>hasta {ini ? fechaCorta(sumar(ini, 13)) : "–"}</small>
            </label>
          ))}
        </>
      )}
      <p className="sub">Si cambias la fecha de apertura a un día futuro, el aviso de apertura se volverá a mandar ese día. Si cambias el cierre, el recordatorio y el aviso de cierre se ajustan a la nueva fecha.</p>
    </Panel>
  );
}

function Reabrir({ v, p, onClose, onHecho }) {
  const hoy = new Date(); const def = sumar(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`, 7);
  const [hasta, setHasta] = useState(p.cierra_mia && p.cierra_mia > v.cierra ? p.cierra_mia : def);
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    setBusy(true);
    try { await sb.rpc("vac_ventana_reabrir", { p_ventana: v.id, p_usuario: p.id, p_hasta: hasta }); avisar(`Ventana reabierta a ${p.nombre} hasta el ${fechaCorta(hasta)}`); onHecho(); }
    catch (e) { avisar(errMsg(e), "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo={`Reabrir a ${p.nombre}`} sub={`${NOMBRE[v.tipo]} ${v.anio}`} onClose={onClose}
      pie={<><button className="btn-l" onClick={onClose}>Cancelar</button><button className="btn-p" disabled={busy || !hasta} onClick={guardar}>{busy ? "Guardando…" : "Reabrir"}</button></>}>
      <p className="sub">Para quien no ha podido presentar en plazo (por ejemplo, de baja toda la ventana). Hasta la fecha que pongas podrá elegir como si la ventana siguiera abierta, con prioridad. Le llegará un aviso.</p>
      <label style={{ display: "block" }}><span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Puede presentar hasta el</span><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
    </Panel>
  );
}
