// Pantallas que vienen tal cual de la app (src/views/owner). Es el mismo código:
// lo que se arregle allí se arregla aquí, y al revés.
import { DatosMesView } from "../../src/views/owner/DatosMesView.jsx";
import { TesoreriaView } from "../../src/views/owner/TesoreriaView.jsx";
import { AjustesView } from "../../src/views/owner/AjustesView.jsx";
import { AnalyticaView } from "../../src/views/owner/AnalyticaView.jsx";
import { UsuariosView } from "../../src/views/owner/UsuariosView.jsx";
import { HorariosAdminView } from "../../src/views/owner/HorariosAdminView.jsx";
import { VacacionesAdminView } from "../../src/views/owner/VacacionesAdminView.jsx";
import { CierresAdminView } from "../../src/views/owner/CierresAdminView.jsx";
import { CambiosAdminView } from "../../src/views/owner/CambiosAdminView.jsx";
import { HorasExtrasView } from "../../src/views/owner/HorasExtrasView.jsx";
import { CoberturaAdminView } from "../../src/views/owner/CoberturaAdminView.jsx";
import { IncidenciasAdminView } from "../../src/views/owner/IncidenciasAdminView.jsx";
import { DisciplinaAdminView } from "../../src/views/owner/DisciplinaAdminView.jsx";
import { PlusMesView } from "../../src/views/owner/PlusMesView.jsx";
import { TareasAdminView } from "../../src/views/owner/TareasAdminView.jsx";
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
    case "personas/horarios": vista = <HorariosAdminView />; break;
    case "personas/cobertura": vista = <CoberturaAdminView />; break;
    case "personas/vacaciones": vista = <VacacionesAdminView />; break;
    case "personas/cambios": vista = <CambiosAdminView />; break;
    case "personas/cierres": vista = <CierresAdminView />; break;
    case "personas/incidencias": vista = <IncidenciasAdminView />; break;
    case "personas/disciplina": vista = <DisciplinaAdminView />; break;
    case "personas/plus": vista = <PlusMesView />; break;
    case "personas/horas": vista = <HorasExtrasView />; break;
    case "personas/equipo": vista = <UsuariosView currentUser={user} />; break;
    case "personas/seleccion": vista = <CVCandidatosView currentUser={user} />; break;
    case "finanzas/tesoreria": vista = <TesoreriaView facturas={facturas} monthlyData={monthlyData} config={config} onReload={reload} />; break;
    case "finanzas/cierre": vista = <DatosMesView facturas={facturas} monthlyData={monthlyData} config={config} onReload={reload} initialMonth={mesFoco} />; break;
    case "finanzas/facturas": vista = <WorkerView facturas={facturas} proveedores={proveedores} onReload={reload} user={user} />; break;
    case "producto/analitica": vista = <AnalyticaView />; break;
    case "plan/tareas": vista = <TareasAdminView />; break;
    case "ajustes/general": vista = <AjustesView currentUser={user} />; break;
    default: vista = <div className="state">Esta sección aún no existe.</div>;
  }
  return <div className="legado">{vista}</div>;
}
