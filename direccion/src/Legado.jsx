// Pantallas que vienen tal cual de la app (src/views/owner). Es el mismo código:
// lo que se arregle allí se arregla aquí, y al revés.
import { DatosMesView } from "../../src/views/owner/DatosMesView.jsx";
import { TesoreriaView } from "../../src/views/owner/TesoreriaView.jsx";
import { AjustesView } from "../../src/views/owner/AjustesView.jsx";
import { AnalyticaView } from "../../src/views/owner/AnalyticaView.jsx";
import { CVCandidatosView } from "../../src/views/owner/CVCandidatosView.jsx";
import { WorkerView } from "../../src/views/WorkerView.jsx";

const NECESITA_DATOS = new Set(["finanzas"]);

export function Legado({ area, sub, datos, user, mesFoco, onEditMonth }) {
  const { facturas, monthlyData, proveedores, config, loading, error, reload } = datos;

  if (NECESITA_DATOS.has(area)) {
    if (loading) return <div className="state">Cargando…</div>;
    if (error) return (
      <div className="state">
        <div>No se han podido cargar los datos.<br /><button className="btn" onClick={reload}>Reintentar</button></div>
      </div>
    );
  }

  const v = `${area}/${sub}`;
  let vista = null;
  switch (v) {
    case "personas/seleccion": vista = <CVCandidatosView currentUser={user} />; break;
    case "finanzas/tesoreria": vista = <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={reload} />; break;
    case "finanzas/cierre": vista = <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={reload} initialMonth={mesFoco} />; break;
    case "finanzas/facturas": vista = <WorkerView facturas={facturas} proveedores={proveedores} onReload={reload} user={user} />; break;
    case "producto/analitica": vista = <AnalyticaView />; break;
    case "ajustes/general": vista = <AjustesView currentUser={user} />; break;
    default: vista = <div className="state">Esta sección aún no existe.</div>;
  }
  return <div className="legado">{vista}</div>;
}
