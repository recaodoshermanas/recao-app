// Personas · Equipo · Horas extra: peticiones de la plantilla y las eventuales por confirmar (solicitud #39).
import { useCallback, useEffect, useState } from "react";
import { sb } from "../../../src/lib/supabase.js";
import { Avatar, Panel, avisar, fechaCorta, n0 } from "../ui.jsx";

const msg = (e) => { const t = String(e?.message || e || ""); const m = /"message"\s*:\s*"([^"]+)"/.exec(t); return m ? m[1] : "No se ha podido"; };
const hm = (t) => String(t || "").slice(0, 5);
const hTxt = (v) => n0(v).toLocaleString("es-ES");

export function usePorConfirmar() {
  const [lista, setLista] = useState(null);
  const cargar = useCallback(async () => { try { setLista(await sb.rpc("he_por_confirmar")); } catch (e) { setLista((l) => l || []); } }, []);
  useEffect(() => { cargar(); }, [cargar]);
  return { lista, recargar: cargar };
}

export function HorasPorConfirmar({ lista, onCambio }) {
  const [rechazar, setRechazar] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!lista || lista.length === 0) return null;

  const confirmar = async (p) => {
    setBusy(true);
    try { await sb.rpc("he_resolver", { p_id: p.id, p_accion: "confirmar", p_motivo: null }); avisar("Horas confirmadas"); onCambio(); }
    catch (e) { avisar(msg(e), "mal"); }
    setBusy(false);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="head"><div><h2>Por confirmar · {lista.length}</h2><p className="sub">Horas que la plantilla y las eventuales dicen que les pediste en el momento. Al confirmar se suman al registro del mes y a «Salarios del mes» (8 € por hora).</p></div></div>
      {lista.map((p) => (
        <div key={p.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px", margin: "10px 0", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar nombre={p.nombre} size={26} /><strong>{p.nombre}</strong><span className="es-chip">{p.eventual ? "Eventual" : "Plantilla"}</span></div>
            <div style={{ marginTop: 6 }}>{fechaCorta(p.fecha)}{p.turno ? ` · ${p.turno}` : ""}{p.ini ? ` (${hm(p.ini)}–${hm(p.fin)})` : ""} · <b>+{hTxt(p.horas)} h</b></div>
            <span className="pf">«{p.motivo}»</span>
            {p.fichaje_salida && <span className="pf">Salida fichada en la caja: {p.fichaje_salida}</span>}
            {n0(p.ya_apuntadas) > 0 && <span className="pf" style={{ color: "var(--down)", fontWeight: 700 }}>Ojo: ese día ya hay {hTxt(p.ya_apuntadas)} h apuntadas a mano. Mira que no se cuenten dos veces.</span>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <button className="btn-p" disabled={busy} onClick={() => confirmar(p)}>Confirmar</button>
            <button className="btn-l" disabled={busy} onClick={() => setRechazar(p)}>Rechazar</button>
          </div>
        </div>
      ))}
      {rechazar && <PanelRechazo p={rechazar} onClose={() => setRechazar(null)} onListo={() => { setRechazar(null); onCambio(); }} />}
    </div>
  );
}

function PanelRechazo({ p, onClose, onListo }) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const guardar = async () => {
    setBusy(true);
    try { await sb.rpc("he_resolver", { p_id: p.id, p_accion: "rechazar", p_motivo: motivo }); avisar("Petición rechazada"); onListo(); }
    catch (e) { avisar(msg(e), "mal"); setBusy(false); }
  };
  return (
    <Panel titulo="Rechazar horas extra" sub={`${p.nombre} · ${fechaCorta(p.fecha)} · +${hTxt(p.horas)} h`} onClose={onClose} ancho="420px"
      pie={<button className="btn-p" disabled={busy || !motivo.trim()} onClick={guardar}>{busy ? "Guardando…" : "Rechazar"}</button>}>
      <label className="campo">Motivo (lo verá la persona)<input value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Ej.: Ya estaban apuntadas a mano" /></label>
      <p className="sub">No se suma nada y la persona recibe un aviso con este motivo.</p>
    </Panel>
  );
}
