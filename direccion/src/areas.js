// Mapa del panel: áreas y sus subpáginas. La URL es #/area/subpagina[/detalle].
// "legado" = pantalla que viene tal cual de la app (con el tema del panel).
import { BOLSA_ACTIVA } from "../../src/lib/bolsa.js";
export const AREAS = [
  { id: "pulso", label: "Pulso" },
  {
    id: "personas", label: "Personas", quien: "Pablo",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "horarios", label: "Horarios" },
      { id: "fichajes", label: "Fichajes" },
      { id: "documentos", label: "Documentos" },
      ...(BOLSA_ACTIVA ? [{ id: "bolsa", label: "Bolsa de turnos" }] : []),
      { id: "solicitudes", label: "Vacaciones y cambios" },
      { id: "seguimiento", label: "Seguimiento" },
      { id: "equipo", label: "Equipo" },
      { id: "seleccion", label: "Selección", legado: true },
    ],
  },
  {
    id: "finanzas", label: "Finanzas", quien: "Miguel",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "dia", label: "Día a día" },
      { id: "cierre", label: "Cierre de mes" },
      { id: "como", label: "Cómo vamos" },
      { id: "stock", label: "Stock" },
      { id: "glosario", label: "Glosario" },
    ],
  },
  {
    id: "producto", label: "Producto", quien: "Javi",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "catalogo", label: "Catálogo" },
      { id: "recepcion", label: "Recepción" },
      { id: "revisar", label: "Productos a revisar" },
      { id: "consumo", label: "Consumo socios" },
      { id: "inventario", label: "Inventario" },
      { id: "app", label: "App de tienda" },
      { id: "familias", label: "Familias" },
      { id: "proveedores", label: "Proveedores" },
      { id: "salud", label: "Salud del catálogo" },
      { id: "lab", label: "Lab" },
      { id: "radar", label: "Radar" },
    ],
  },
  {
    id: "plan", label: "Plan",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "proyectos", label: "Proyectos" },
      { id: "tareas", label: "Tareas" },
      { id: "calendario", label: "Calendario" },
    ],
  },
  {
    id: "marketing", label: "Marketing", quien: "Adrián",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "clientes", label: "Clientes" },
      { id: "captacion", label: "Captación" },
      { id: "campanas", label: "Campañas y calendario" },
      { id: "reputacion", label: "Reputación" },
    ],
  },
  {
    id: "tecnologia", label: "Tecnología", quien: "Adrián",
    subs: [{ id: "solicitudes", label: "Solicitudes" }, { id: "como-pedir", label: "Cómo pedir" }],
  },
  // fuera del menú principal: se abre desde el usuario
  { id: "ajustes", label: "Ajustes", oculto: true, subs: [{ id: "general", label: "Ajustes", legado: true }] },
];

// #60: Finanzas se agrupa en 5 apartados; cada uno tiene dentro sus pestañas (la primera es la de por defecto).
// La URL es #/finanzas/<apartado>/<pestaña>. Las pantallas "legado" vienen de la app (Facturas, Cierre de mes, Tesorería).
export const FIN_PESTANAS = {
  dia: [{ id: "sobres", label: "Sobres" }, { id: "facturas", label: "Facturas" }, { id: "compras", label: "Compras" }, { id: "bancos", label: "Bancos" }, { id: "pagos", label: "Facturas pendientes de pago" }, { id: "mantenimiento", label: "Mantenimiento" }, { id: "inversiones", label: "Inversiones" }],
  cierre: [{ id: "cierre", label: "Lista de cierre" }, { id: "caja", label: "Descuadres de caja" }],
  como: [{ id: "resultados", label: "Cuenta de resultados" }, { id: "tesoreria", label: "Tesorería" }],
};
// #142: Finanzas se reorganiza por tareas. Los enlaces antiguos (#/finanzas/efectivo/caja, #/finanzas/banco/bancos…)
// siguen funcionando: cada pestaña antigua lleva a su sitio nuevo. Los correos y avisos de la app usan estas rutas antiguas.
const FIN_DESTINO = {
  sobres: "dia", facturas: "dia", compras: "dia", bancos: "dia", pagos: "dia", mantenimiento: "dia", inversiones: "dia",
  cierre: "cierre", caja: "cierre", resultados: "como", tesoreria: "como",
};
const FIN_SUB_ANTIGUO = { efectivo: "caja", banco: "bancos", gastos: "facturas" }; // apartado antiguo sin pestaña → su primera pestaña

// Lo que mandan las notificaciones de la app (evento "recao-nav") → dónde se abre aquí
// El botón de los correos (función notificaciones-email) usa estas mismas rutas: si se cambian aquí, cambiarlas también allí.
export const DESTINOS = {
  horarios: "personas/horarios", cobertura: "personas/horarios", vacaciones: "personas/solicitudes",
  cambios: "personas/solicitudes", cierres: "personas/seguimiento/cierres", incidencias: "personas/seguimiento/incidencias",
  disciplina: "personas/seguimiento/disciplina", horas: "personas/equipo", usuarios: "personas/equipo",
  candidatos: "personas/seleccion", plus: "personas/equipo", bolsa: "personas/bolsa",
  recepcion_admin: "producto/recepcion", fichajes_admin: "personas/fichajes", documentos_admin: "personas/documentos",
  tareas_extra: "personas/seguimiento", solicitudes_tec: "tecnologia/solicitudes", formacion_admin: "personas/equipo", caja_fuerte: "finanzas/efectivo/caja", bancos: "finanzas/banco/bancos", pagos: "finanzas/banco/pagos", productos_revisar: "producto/revisar",
};

// Enlaces antiguos de Personas → secciones nuevas
const ANTIGUAS = { cobertura: "horarios", vacaciones: "solicitudes", cambios: "solicitudes", cierres: "seguimiento", incidencias: "seguimiento", disciplina: "seguimiento", plus: "equipo", horas: "equipo" };

export function leerRuta(hash) {
  const [a, s0, extra] = String(hash || "").split("?")[0].replace(/^#\/?/, "").split("/"); // #81: «?mes=…» no cuenta para la ruta
  const area = AREAS.find((x) => x.id === a && !x.pronto) || AREAS[0];
  if (area.id === "finanzas") {
    let subId = s0, pedida = extra;
    if (!["resumen", "dia", "cierre", "como", "stock", "glosario"].includes(s0)) { // enlace antiguo
      if (s0 === "resultados") { pedida = extra === "cierre" ? "cierre" : "resultados"; subId = FIN_DESTINO[pedida]; }
      else if (FIN_SUB_ANTIGUO[s0]) { pedida = extra || FIN_SUB_ANTIGUO[s0]; subId = FIN_DESTINO[pedida]; }
      else if (FIN_DESTINO[s0]) { pedida = s0; subId = FIN_DESTINO[s0]; }
    }
    const sub = area.subs.find((x) => x.id === subId) || area.subs[0];
    const pestanas = FIN_PESTANAS[sub.id];
    const tab = pestanas ? (pestanas.find((t) => t.id === pedida) || pestanas[0]).id : undefined;
    return { area, sub, extra: tab };
  }
  const s = area.id === "personas" && ANTIGUAS[s0] ? ANTIGUAS[s0] : s0;
  const sub = area.subs ? (area.subs.find((x) => x.id === s) || area.subs[0]) : null;
  const extraFinal = extra || (area.id === "personas" && ["cierres", "incidencias", "disciplina"].includes(s0) ? (s0 === "incidencias" ? "incidencias" : s0) : undefined);
  return { area, sub, extra: extraFinal ? decodeURIComponent(extraFinal) : undefined };
}
