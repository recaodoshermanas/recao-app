import { useEffect, useRef, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import { renderPulso, drawCharts } from "./pulso.js";
import { initTips } from "./charts.js";

const REFRESCO_MS = 60 * 1000;
let tipsOn = false;

async function rpc(nombre, args = {}) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) throw error;
  return data;
}

// La home de siempre (pulso.js pinta el HTML y los gráficos); aquí solo se carga y refresca.
export function Pulso() {
  const ref = useRef(null);
  const datos = useRef(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const el = ref.current;
    el.innerHTML = `<div class="state">Cargando…</div>`;
    if (!tipsOn) { initTips(document.body); tipsOn = true; }
    let vivo = true;
    const cargar = async () => {
      try {
        const d = await rpc("dash_pulso");
        if (!vivo) return;
        datos.current = d;
        setFallo(false);
        renderPulso(el, d, { comparar: (r) => rpc("dash_comparar", r) });
      } catch (e) {
        if (vivo && !datos.current) { el.innerHTML = ""; setFallo(true); }
      }
    };
    cargar();
    const t = setInterval(() => { if (!document.hidden) cargar(); }, REFRESCO_MS);
    const vis = () => { if (!document.hidden) cargar(); };
    let rt = null;
    const rs = () => { clearTimeout(rt); rt = setTimeout(() => datos.current && drawCharts(el, datos.current), 120); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("resize", rs);
    return () => {
      vivo = false; clearInterval(t); clearTimeout(rt);
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("resize", rs);
    };
  }, []);

  return (
    <>
      {fallo && <div className="state">No se han podido cargar los datos. Recarga la página en un momento.</div>}
      <div ref={ref} />
    </>
  );
}
