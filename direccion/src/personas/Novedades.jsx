// Personas · Equipo → Novedades: el tablón que las trabajadoras ven al entrar en la app (las 3 últimas de su público).
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Panel, avisar, hoyStr, fechaCorta, hace, Cargando } from "../ui.jsx";

const PARA = [{ id: "todas", label: "Todas" }, { id: "plantilla", label: "Plantilla" }, { id: "eventuales", label: "Eventuales" }];
const PARA_TXT = { todas: "Todas", plantilla: "Plantilla", eventuales: "Eventuales" };
const TEMAS = ["Horarios", "Vacaciones", "Fichajes", "Bolsa", "Normas", "Tienda", "Pedidos"];
const esNueva = (ts) => Date.now() - new Date(ts).getTime() < 7 * 24 * 3600 * 1000;

export function Novedades() {
  const [lista, setLista] = useState(null);
  const [editar, setEditar] = useState(null); // {} nueva | fila
  const [verRetiradas, setVerRetiradas] = useState(false);
  const cargar = useCallback(async () => {
    try { setLista(await sb.select("novedades", "select=*&order=creado_en.desc&limit=200")); }
    catch (e) { avisar("No se han podido cargar las novedades", "mal"); setLista((l) => l || []); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!lista) return <Cargando />;

  const activas = lista.filter((n) => n.activa);
  const retiradas = lista.filter((n) => !n.activa);
  const visibles = (para) => activas.filter((n) => n.para === "todas" || n.para === para).slice(0, 3).map((n) => n.id);
  const enApp = new Set([...visibles("plantilla"), ...visibles("eventuales")]);
  const cambiar = async (n, patch, ok) => {
    try { await sb.update("novedades", `id=eq.${n.id}`, patch); avisar(ok); cargar(); }
    catch (e) { avisar("No se ha podido guardar", "mal"); }
  };
  const fila = (n) => (
    <tr key={n.id}>
      <td>
        <span className="pn">{n.titulo}{n.activa && esNueva(n.creado_en) && <span className="nov-nuevo">Nuevo</span>}</span>
        <span className="pf">{n.texto}</span>
      </td>
      <td>{PARA_TXT[n.para]}</td>
      <td>{n.tema || "—"}</td>
      <td>Desde el {fechaCorta(n.desde)}<span className="pf">Publicada {hace(n.creado_en)}{n.avisar ? " · con aviso" : ""}</span></td>
      <td>{n.activa ? (enApp.has(n.id) ? <span className="nov-est on">Se ve en la app</span> : <span className="nov-est">Activa, fuera de las 3 últimas</span>) : <span className="nov-est off">Retirada</span>}</td>
      <td className="r" style={{ whiteSpace: "nowrap" }}>
        <button className="btn-l" onClick={() => setEditar(n)}>Editar</button>{" "}
        {n.activa
          ? <button className="btn-txt peligro" onClick={() => cambiar(n, { activa: false }, "Retirada: ya no se ve en la app")}>Retirar</button>
          : <button className="btn-txt" onClick={() => cambiar(n, { activa: true }, "Vuelve a estar activa")}>Volver a activar</button>}
      </td>
    </tr>
  );
  return (
    <div className="card mt">
      <div className="head">
        <div><h2>Novedades del equipo</h2><p className="sub">Cada trabajadora ve arriba de su app las 3 activas más recientes de su público. Las eventuales sin cuenta no las ven.</p></div>
        <button className="btn-p" onClick={() => setEditar({})}>+ Nueva novedad</button>
      </div>
      {!activas.length ? <p className="empty">No hay novedades activas: el inicio de la app se ve como siempre.</p> : (
        <div className="tabla-scroll">
          <table className="ranking">
            <thead><tr><th>Novedad</th><th>Para</th><th>Tema</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
            <tbody>{activas.map(fila)}</tbody>
          </table>
        </div>
      )}
      {retiradas.length > 0 && (
        <>
          <button className="btn-txt" style={{ marginTop: 12 }} onClick={() => setVerRetiradas(!verRetiradas)}>{verRetiradas ? "Ocultar" : "Ver"} las retiradas ({retiradas.length})</button>
          {verRetiradas && <div className="tabla-scroll"><table className="ranking"><tbody>{retiradas.map(fila)}</tbody></table></div>}
        </>
      )}
      {editar && <FormNovedad inicial={editar} onClose={() => setEditar(null)} onGuardada={() => { setEditar(null); cargar(); }} />}
    </div>
  );
}

function FormNovedad({ inicial, onClose, onGuardada }) {
  const nueva = !inicial.id;
  const [f, setF] = useState({ titulo: inicial.titulo || "", texto: inicial.texto || "", desde: inicial.desde || hoyStr(), tema: inicial.tema || "", para: inicial.para || "todas", avisar: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.titulo.trim() && f.texto.trim() && f.titulo.length <= 60 && f.texto.length <= 200 && f.desde;
  const guardar = async () => {
    if (!ok) return;
    setBusy(true);
    const datos = { titulo: f.titulo.trim(), texto: f.texto.trim(), desde: f.desde, tema: f.tema.trim() || null, para: f.para };
    try {
      if (nueva) await sb.insert("novedades", { ...datos, avisar: f.avisar });
      else await sb.update("novedades", `id=eq.${inicial.id}`, datos);
      avisar(nueva ? (f.avisar ? "Publicada y avisadas por la campana y el correo" : "Publicada en la app") : "Cambios guardados");
      onGuardada();
    } catch (e) { avisar("No se ha podido guardar", "mal"); }
    setBusy(false);
  };
  return (
    <Panel titulo={nueva ? "Nueva novedad" : "Editar novedad"} sub={nueva ? "Sale arriba de la app de quien elijas" : "El texto corregido se ve al volver a cargar la app, sin aviso nuevo"} onClose={onClose} ancho="520px"
      pie={<button className="btn-p" onClick={guardar} disabled={busy || !ok}>{busy ? "Guardando…" : nueva ? "Publicar" : "Guardar"}</button>}>
      <label className="campo">Título <small className="nov-cuenta">{f.titulo.length}/60</small><input value={f.titulo} maxLength={60} onChange={set("titulo")} placeholder="Ej.: Domingos: el Apoyo 2 entra a las 16:00" autoFocus /></label>
      <label className="campo">Texto <small className="nov-cuenta">{f.texto.length}/200</small><textarea rows={3} value={f.texto} maxLength={200} onChange={set("texto")} placeholder="Lo que cambia, en una o dos frases." /></label>
      <div className="fila-campos">
        <label className="campo">Desde<input type="date" value={f.desde} onChange={set("desde")} /></label>
        <label className="campo">Tema<input list="nov-temas" value={f.tema} onChange={set("tema")} placeholder="Horarios, Vacaciones…" /><datalist id="nov-temas">{TEMAS.map((t) => <option key={t} value={t} />)}</datalist></label>
      </div>
      <div className="campo-t"><span>Para</span>
        <div className="seg">{PARA.map((p) => <button key={p.id} aria-pressed={f.para === p.id} onClick={() => setF({ ...f, para: p.id })}>{p.label}</button>)}</div>
      </div>
      {nueva && (
        <label className="chk"><input type="checkbox" checked={f.avisar} onChange={(e) => setF({ ...f, avisar: e.target.checked })} /> Avisar en la campana y por email</label>
      )}
      {(f.titulo || f.texto) && (
        <div className="nov-previa" aria-label="Así se verá">
          <small>Así se verá en la app</small>
          <b>{f.titulo || "Título"} <span className="nov-nuevo">Nuevo</span></b>
          <p>{f.texto || "Texto"}</p>
          <small>Desde el {fechaCorta(f.desde)}{f.tema ? ` · ${f.tema}` : ""}</small>
        </div>
      )}
    </Panel>
  );
}
