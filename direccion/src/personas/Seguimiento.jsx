// Personas · Seguimiento: cierres de turno, tareas extra (#56), tareas sin hacer (incidencias) y disciplina.
import { useEffect, useMemo, useState, useCallback } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { DisciplinaAdminView } from "../../../src/views/owner/DisciplinaAdminView.jsx";
import { Pestanas, useEquipo, hoyStr, masDias, fechaCorta, Cargando, Avatar, hace, n0, Panel } from "../ui.jsx";
import { eur } from "../fmt.js";

// sub puede ser "tareas-extra:<texto>" (desde el aviso de tarea repetida) para abrir directamente su detalle
function leerSub(sub) {
  const s = String(sub || "");
  if (s.startsWith("tareas-extra")) return { vista: "tareas-extra", tarea: s.slice("tareas-extra:".length) || null };
  return { vista: s || "cierres", tarea: null };
}

export function Seguimiento({ sub }) {
  const ini = leerSub(sub);
  const [vista, setVista] = useState(ini.vista);
  const [tareaFoco, setTareaFoco] = useState(ini.tarea);
  const [cierreFoco, setCierreFoco] = useState(null);
  const [repiten, setRepiten] = useState(0);
  const contar = useCallback(() => { sb.rpc("tareas_extra_resumen", { p_dias: 30 }).then((r) => setRepiten((r && r.repiten) || 0)).catch(() => {}); }, []);
  useEffect(() => { contar(); }, [contar]);
  useEffect(() => { const x = leerSub(sub); setVista(x.vista); setTareaFoco(x.tarea); }, [sub]);
  const abrirCierre = (c) => { setCierreFoco(c); setVista("cierres"); };
  return (
    <>
      <div className="barra-sec">
        <Pestanas valor={vista} onChange={(v) => { setVista(v); setCierreFoco(null); }} etiqueta="Seguimiento" opciones={[
          { id: "cierres", label: "Cierres de turno" }, { id: "tareas-extra", label: "Tareas extra", n: repiten }, { id: "incidencias", label: "Tareas sin hacer" }, { id: "disciplina", label: "Disciplina" },
        ]} />
      </div>
      {vista === "cierres" && <Cierres foco={cierreFoco} quitarFoco={() => setCierreFoco(null)} />}
      {vista === "tareas-extra" && <TareasExtra inicial={tareaFoco} onCambio={contar} onAbrirCierre={abrirCierre} />}
      {vista === "incidencias" && <Incidencias />}
      {vista === "disciplina" && <div className="card legado-dentro ancho"><DisciplinaAdminView /></div>}
    </>
  );
}

const PERIODOS = [{ id: "7", label: "7 días" }, { id: "30", label: "30 días" }, { id: "90", label: "90 días" }];

function Cierres({ foco, quitarFoco }) {
  const hoy = hoyStr();
  const { equipo } = useEquipo();
  const [dias, setDias] = useState("7");
  const [uid, setUid] = useState("");
  const [filas, setFilas] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const cargar = useCallback(async () => {
    setFilas(null);
    const q = "select=*,items:cierre_items(tarea_texto,hecha,justificacion),extras:cierre_tareas_extra(texto),caja:cierres_caja(caja1_efectivo,caja1_tarjeta,caja2_efectivo,caja2_tarjeta,tickets:facturas_proveedores(proveedor,importe,caja))&order=fecha.desc,completado_en.desc"
      + (foco ? `&id=eq.${foco.cierre_id}` : (uid ? `&usuario_id=eq.${uid}` : "") + `&fecha=gte.${masDias(hoy, -(Number(dias) - 1))}`);
    try { const r = await sb.select("cierres_turno", q); setFilas(r); if (foco && r[0]) setAbierto(r[0].id); } catch (e) { setFilas([]); }
  }, [dias, uid, hoy, foco]);
  useEffect(() => { cargar(); }, [cargar]);
  const nombreDe = useMemo(() => Object.fromEntries((equipo || []).map((u) => [u.id, u.nombre])), [equipo]);
  const trab = (equipo || []).filter((u) => u.rol === "trabajadora" && !u.eventual);
  const tot = (filas || []).reduce((a, c) => { const it = c.items || []; a.n++; a.tareas += it.length; a.sin += it.filter((i) => !i.hecha).length; a.extra += (c.extras || []).length; return a; }, { n: 0, tareas: 0, sin: 0, extra: 0 });

  return (
    <>
      <div className="filtros-linea">
        {foco ? <button className="btn-l" onClick={quitarFoco}>‹ Ver todos los cierres</button> : <>
        <Pestanas valor={dias} onChange={setDias} etiqueta="Periodo" opciones={PERIODOS} />
        <select value={uid} onChange={(e) => setUid(e.target.value)} aria-label="Persona"><option value="">Todo el equipo</option>{trab.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
        </>}
      </div>
      {!filas ? <Cargando /> : (
        <div className="card">
          <div className="head">
            <div><h2>{tot.n} cierres</h2><p className="sub">{tot.tareas ? `${Math.round((1 - tot.sin / tot.tareas) * 100)} % de las tareas hechas · ${tot.sin} sin hacer` : "Sin tareas registradas"}{tot.extra ? ` · ${tot.extra} extra` : ""}</p></div>
          </div>
          {filas.length === 0 ? <p className="empty">No hay cierres en este periodo.</p> : (
            <ul className="cierres">
              {filas.map((c) => {
                const it = c.items || []; const hechas = it.filter((i) => i.hecha).length; const ex = c.extras || [];
                const caja = c.caja && c.caja[0];
                const ventas = caja ? n0(caja.caja1_efectivo) + n0(caja.caja1_tarjeta) + n0(caja.caja2_efectivo) + n0(caja.caja2_tarjeta) : null;
                const open = abierto === c.id;
                return (
                  <li key={c.id} className={open ? "abierto" : ""}>
                    <button className="cierre-fila" onClick={() => setAbierto(open ? null : c.id)} aria-expanded={open}>
                      <span className="f">{fechaCorta(c.fecha)}<small>{c.turno}</small></span>
                      <span className="p"><Avatar nombre={nombreDe[c.usuario_id]} size={24} />{nombreDe[c.usuario_id] || "—"}</span>
                      <span className={`t ${hechas < it.length ? "mal" : "ok"}`}>{it.length ? `${hechas}/${it.length} tareas` : "—"}{ex.length > 0 && <em className="extra-n" title={`${ex.length} tareas extra`}>+{ex.length}</em>}</span>
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
                        {it.length > 0 && <p className="sub resumen-cierre">{hechas} hechas · {it.length - hechas} sin hacer{ex.length ? ` · +${ex.length} extra` : ""}</p>}
                        {ex.length > 0 && (
                          <>
                            <h3 className="sub-tit">Tareas extra</h3>
                            <ul className="checklist ver">
                              {ex.map((x, k) => <li key={k} className="hecha extra"><span>+</span><div>{x.texto}</div></li>)}
                            </ul>
                          </>
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

// #56 · Tareas extra apuntadas en los cierres: agrupadas por texto, repetidas y detalle
const PERIODOS_EXTRA = [{ id: "30", label: "Últimos 30 días" }, { id: "90", label: "3 meses" }, { id: "todo", label: "Todo" }];
const dondeTurno = (m, t) => (m && t ? "mañana y tarde" : m ? "mañana" : t ? "tarde" : "—");

function TareasExtra({ inicial, onCambio, onAbrirCierre }) {
  const [dias, setDias] = useState("30");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(inicial ? { clave: inicial } : null);
  const pDias = dias === "todo" ? null : Number(dias);
  const cargar = useCallback(async () => {
    setDatos(null); setError("");
    try { setDatos(await sb.rpc("tareas_extra_resumen", { p_dias: pDias })); } catch (e) { setError("No se han podido cargar las tareas extra."); setDatos({ lista: [], repiten: 0 }); }
  }, [pDias]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (inicial) setDetalle({ clave: inicial }); }, [inicial]);
  if (!datos) return <Cargando />;
  const lista = datos.lista || [];
  return (
    <>
      <div className="filtros-linea">
        <Pestanas valor={dias} onChange={setDias} etiqueta="Periodo" opciones={PERIODOS_EXTRA} />
      </div>
      {datos.repiten > 0 && <p className="aviso-repite">{datos.repiten === 1 ? "1 tarea se repite" : `${datos.repiten} tareas se repiten`} · 3 veces o más en los últimos 30 días</p>}
      <div className="card">
        <div className="head"><div><h2>{lista.length} {lista.length === 1 ? "tarea extra" : "tareas extra"}</h2><p className="sub">Lo que las trabajadoras apuntan al cerrar el turno y no está en la lista · pulsa una para ver el detalle</p></div></div>
        {error && <p className="empty">{error}</p>}
        {!error && lista.length === 0 ? <p className="empty">No se ha apuntado ninguna tarea extra en este periodo.</p> : (
          <ul className="te-lista">
            {lista.map((t) => (
              <li key={t.clave}>
                <button className={t.se_repite ? "repite" : ""} onClick={() => setDetalle({ clave: t.clave })}>
                  <span className="te-txt"><b>{t.texto}</b><small>{t.personas} {t.personas === 1 ? "persona" : "personas"} · suele ser de {dondeTurno(t.manana, t.tarde)}</small></span>
                  {t.se_repite && <span className="chip-mal">Se repite</span>}
                  <span className="te-n"><b>{t.veces}</b><small>{t.veces === 1 ? "vez" : "veces"}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {detalle && <DetalleExtra clave={detalle.clave} pDias={pDias} onClose={() => setDetalle(null)} onRevisada={() => { cargar(); onCambio && onCambio(); }} onAbrirCierre={(c) => { setDetalle(null); onAbrirCierre(c); }} />}
    </>
  );
}

function DetalleExtra({ clave, pDias, onClose, onRevisada, onAbrirCierre }) {
  const [d, setD] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cargar = useCallback(async () => {
    try { setD(await sb.rpc("tareas_extra_detalle", { p_clave: clave, p_dias: pDias })); } catch (e) { setD({ error: true }); }
  }, [clave, pDias]);
  useEffect(() => { cargar(); }, [cargar]);
  const revisar = async () => {
    setGuardando(true);
    try { await sb.rpc("tareas_extra_revisar", { p_clave: clave }); await cargar(); onRevisada(); } catch (e) { /* noop */ }
    setGuardando(false);
  };
  const titulo = d && d.texto ? d.texto : "Tarea extra";
  return (
    <Panel titulo={titulo} sub={d && !d.error ? (pDias ? `En el periodo elegido` : "Desde el principio") : undefined} onClose={onClose}
      pie={d && !d.error && d.veces > 0 ? (d.se_repite
        ? <button className="btn-p" onClick={revisar} disabled={guardando}>{guardando ? "Guardando…" : "Marcar como revisada"}</button>
        : <p className="sub">{d.revisada_en ? `Revisada ${hace(d.revisada_en)}. Si se vuelve a apuntar 3 veces en 30 días, saldrá otra vez como «Se repite».` : "No se repite: menos de 3 veces en los últimos 30 días."}</p>) : null}>
      {!d ? <Cargando /> : d.error ? <p className="empty">No se ha podido cargar el detalle.</p> : d.veces === 0 ? <p className="empty">No hay cierres con esta tarea en el periodo elegido.</p> : (
        <>
          {d.se_repite && <p className="aviso-repite">Se repite: {d.veces_30} veces en los últimos 30 días</p>}
          <dl className="kv">
            <dt>Veces</dt><dd>{d.veces}</dd>
            <dt>Personas</dt><dd>{d.personas}</dd>
            <dt>Por turno</dt><dd>Mañana {d.manana} · Tarde {d.tarde}</dd>
          </dl>
          <h3 className="sub-tit">Quién la hace</h3>
          <ul className="ranking-barras">
            {(d.quien || []).map((q) => (
              <li key={q.usuario_id}><div className="te-quien"><span className="n">{q.nombre}</span><span className="b"><i style={{ width: `${(q.veces / (d.quien[0]?.veces || 1)) * 100}%` }} /></span><b>{q.veces}</b></div></li>
            ))}
          </ul>
          <h3 className="sub-tit">Cierres</h3>
          <ul className="te-cierres">
            {(d.cierres || []).map((c) => (
              <li key={c.cierre_id}><button onClick={() => onAbrirCierre(c)}><span>{fechaCorta(c.fecha)} · {c.turno}</span><span>{c.nombre}</span><span aria-hidden="true">›</span></button></li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
