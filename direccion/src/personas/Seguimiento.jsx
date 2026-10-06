// Personas · Seguimiento: cierres de turno, tareas sin hacer (incidencias) y disciplina.
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { DisciplinaAdminView } from "../../../src/views/owner/DisciplinaAdminView.jsx";
import { Pestanas, useEquipo, hoyStr, masDias, fechaCorta, Cargando, Avatar, hace, n0, Panel } from "../ui.jsx";
import { eur } from "../fmt.js";

export function Seguimiento({ sub }) {
  const [vista, setVista] = useState(sub || "cierres");
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={setVista} etiqueta="Seguimiento" opciones={[
          { id: "cierres", label: "Cierres de turno" }, { id: "incidencias", label: "Tareas sin hacer" }, { id: "disciplina", label: "Disciplina" },
        ]} />
      </div>
      {vista === "cierres" && <Cierres />}
      {vista === "incidencias" && <Incidencias />}
      {vista === "disciplina" && <div className="card legado-dentro ancho"><DisciplinaAdminView /></div>}
    </>
  );
}

const PERIODOS = [{ id: "7", label: "7 días" }, { id: "30", label: "30 días" }, { id: "90", label: "90 días" }];

function Cierres() {
  const hoy = hoyStr();
  const { equipo } = useEquipo();
  const [dias, setDias] = useState("7");
  const [uid, setUid] = useState("");
  const [filas, setFilas] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const cargar = useCallback(async () => {
    setFilas(null);
    const q = "select=*,items:cierre_items(tarea_texto,hecha,justificacion),caja:cierres_caja(caja1_efectivo,caja1_tarjeta,caja2_efectivo,caja2_tarjeta,tickets:facturas_proveedores(proveedor,importe,caja))&order=fecha.desc,completado_en.desc"
      + (uid ? `&usuario_id=eq.${uid}` : "") + `&fecha=gte.${masDias(hoy, -(Number(dias) - 1))}`;
    try { setFilas(await sb.select("cierres_turno", q)); } catch (e) { setFilas([]); }
  }, [dias, uid, hoy]);
  useEffect(() => { cargar(); }, [cargar]);
  const nombreDe = useMemo(() => Object.fromEntries((equipo || []).map((u) => [u.id, u.nombre])), [equipo]);
  const trab = (equipo || []).filter((u) => u.rol === "trabajadora" && !u.eventual);
  const tot = (filas || []).reduce((a, c) => { const it = c.items || []; a.n++; a.tareas += it.length; a.sin += it.filter((i) => !i.hecha).length; return a; }, { n: 0, tareas: 0, sin: 0 });

  return (
    <>
      <div className="filtros-linea">
        <Pestanas valor={dias} onChange={setDias} etiqueta="Periodo" opciones={PERIODOS} />
        <select value={uid} onChange={(e) => setUid(e.target.value)} aria-label="Persona"><option value="">Todo el equipo</option>{trab.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
      </div>
      {!filas ? <Cargando /> : (
        <div className="card">
          <div className="head">
            <div><h2>{tot.n} cierres</h2><p className="sub">{tot.tareas ? `${Math.round((1 - tot.sin / tot.tareas) * 100)} % de las tareas hechas · ${tot.sin} sin hacer` : "Sin tareas registradas"}</p></div>
          </div>
          {filas.length === 0 ? <p className="empty">No hay cierres en este periodo.</p> : (
            <ul className="cierres">
              {filas.map((c) => {
                const it = c.items || []; const hechas = it.filter((i) => i.hecha).length;
                const caja = c.caja && c.caja[0];
                const ventas = caja ? n0(caja.caja1_efectivo) + n0(caja.caja1_tarjeta) + n0(caja.caja2_efectivo) + n0(caja.caja2_tarjeta) : null;
                const open = abierto === c.id;
                return (
                  <li key={c.id} className={open ? "abierto" : ""}>
                    <button className="cierre-fila" onClick={() => setAbierto(open ? null : c.id)} aria-expanded={open}>
                      <span className="f">{fechaCorta(c.fecha)}<small>{c.turno}</small></span>
                      <span className="p"><Avatar nombre={nombreDe[c.usuario_id]} size={24} />{nombreDe[c.usuario_id] || "—"}</span>
                      <span className={`t ${hechas < it.length ? "mal" : "ok"}`}>{it.length ? `${hechas}/${it.length} tareas` : "—"}</span>
                      <span className="v">{ventas != null ? eur(ventas) : "—"}</span>
                      <span className="nota">{c.notas ? "📝" : ""}</span>
                    </button>
                    {open && (
                      <div className="cierre-det">
                        {caja && (
                          <dl className="kv">
                            <dt>Caja 1 · efectivo / tarjeta</dt><dd>{eur(caja.caja1_efectivo, 2)} / {eur(caja.caja1_tarjeta, 2)}</dd>
                            <dt>Caja 2 · efectivo / tarjeta</dt><dd>{eur(caja.caja2_efectivo, 2)} / {eur(caja.caja2_tarjeta, 2)}</dd>
                            <dt>Ventas del turno</dt><dd>{eur(ventas, 2)}</dd>
                            {(caja.tickets || []).length > 0 && <><dt>Pagado a proveedores desde la caja</dt><dd>{eur((caja.tickets || []).reduce((s, t) => s + n0(t.importe), 0), 2)}<em>{caja.tickets.map((t) => t.proveedor).join(", ")}</em></dd></>}
                          </dl>
                        )}
                        {it.length > 0 && (
                          <ul className="checklist ver">
                            {it.map((i, k) => <li key={k} className={i.hecha ? "hecha" : "no"}><span>{i.hecha ? "✓" : "✗"}</span><div>{i.tarea_texto}{!i.hecha && i.justificacion && <small>“{i.justificacion}”</small>}</div></li>)}
                          </ul>
                        )}
                        {c.notas && <p className="nota-txt">{c.notas}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function Incidencias() {
  const [dias, setDias] = useState("30");
  const [lista, setLista] = useState(null);
  const [quien, setQuien] = useState("");
  const [foto, setFoto] = useState(null);
  useEffect(() => { sb.fn("incidencias", { action: "listar" }).then((r) => setLista(r.incidencias || [])).catch(() => setLista([])); }, []);
  if (!lista) return <Cargando />;
  const desde = Date.now() - Number(dias) * 86400000;
  const per = lista.filter((x) => new Date(x.creado_en).getTime() >= desde);
  const ranking = Object.values(per.reduce((a, x) => { const k = x.cerrado_por || "?"; (a[k] ||= { id: k, nombre: x.cerrado_por_nombre || "—", n: 0 }).n++; return a; }, {})).sort((a, b) => b.n - a.n);
  const max = ranking[0]?.n || 1;
  const vis = per.filter((x) => !quien || x.cerrado_por === quien);
  const verFoto = async (x) => {
    setFoto({ x, url: null });
    try { const r = await sb.fn("incidencias", { action: "detalle", id: x.id }); setFoto({ x, url: (r.fotos && r.fotos[0]) || r.foto || "" }); } catch (e) { setFoto({ x, url: "" }); }
  };
  return (
    <>
      <div className="filtros-linea">
        <Pestanas valor={dias} onChange={setDias} etiqueta="Periodo" opciones={PERIODOS} />
        {quien && <button className="btn-l" onClick={() => setQuien("")}>Quitar filtro</button>}
      </div>
      <div className="grid sin-margen">
        <div className="card c5">
          <h2>Quién deja tareas sin hacer</h2>
          <p className="sub">Tareas que la compañera del turno siguiente marcó como no hechas · pulsa para filtrar</p>
          {ranking.length === 0 ? <p className="empty">Nada en este periodo ✓</p> : (
            <ul className="ranking-barras">
              {ranking.map((r) => (
                <li key={r.id}><button className={quien === r.id ? "sel" : ""} onClick={() => setQuien(quien === r.id ? "" : r.id)}>
                  <span className="n">{r.nombre}</span><span className="b"><i style={{ width: `${(r.n / max) * 100}%` }} /></span><b>{r.n}</b>
                </button></li>
              ))}
            </ul>
          )}
        </div>
        <div className="card c7">
          <h2>{vis.length} tareas sin hacer</h2>
          <ul className="incidencias">
            {vis.map((x) => (
              <li key={x.id}>
                <div className="i-t"><b>{x.tarea_texto}</b><span className="pf">{fechaCorta(x.fecha)} · turno de {x.turno} · lo dejó {x.cerrado_por_nombre || "—"} · avisó {x.reportado_por_nombre || "—"} · {hace(x.creado_en)}</span>{x.comentario && <span className="i-c">“{x.comentario}”</span>}</div>
                <button className="btn-l" onClick={() => verFoto(x)}>Foto</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {foto && (
        <Panel titulo={foto.x.tarea_texto} sub={fechaCorta(foto.x.fecha)} onClose={() => setFoto(null)}>
          {foto.url === null ? <p className="empty">Cargando foto…</p> : foto.url ? <img className="foto-inc" src={foto.url} alt={`Foto de ${foto.x.tarea_texto}`} /> : <p className="empty">Sin foto.</p>}
        </Panel>
      )}
    </>
  );
}
