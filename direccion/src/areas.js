// Mapa del panel: áreas y sus subpáginas. La URL es #/area/subpagina[/detalle].
// "legado" = pantalla que viene tal cual de la app (con el tema del panel).
export const AREAS = [
  { id: "pulso", label: "Pulso" },
  {
    id: "personas", label: "Personas", quien: "Pablo",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "horarios", label: "Horarios" },
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
      { id: "resultados", label: "Cuenta de resultados" },
      { id: "caja", label: "Caja" },
      { id: "compras", label: "Compras" },
      { id: "facturas", label: "Facturas", legado: true },
      { id: "cierre", label: "Cierre de mes", legado: true },
      { id: "tesoreria", label: "Tesorería", legado: true },
    ],
  },
  {
    id: "producto", label: "Producto", quien: "Javi",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "catalogo", label: "Catálogo" },
      { id: "familias", label: "Familias" },
      { id: "proveedores", label: "Proveedores" },
      { id: "salud", label: "Salud del catálogo" },
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
  { id: "marketing", label: "Marketing", pronto: true },
  // fuera del menú principal: se abre desde el usuario
  { id: "ajustes", label: "Ajustes", oculto: true, subs: [{ id: "general", label: "Ajustes", legado: true }] },
];

// Lo que mandan las notificaciones de la app (evento "recao-nav") → dónde se abre aquí
export const DESTINOS = {
  horarios: "personas/horarios", cobertura: "personas/horarios", vacaciones: "personas/solicitudes",
  cambios: "personas/solicitudes", cierres: "personas/seguimiento", incidencias: "personas/seguimiento",
  disciplina: "personas/seguimiento/disciplina", horas: "personas/equipo", usuarios: "personas/equipo",
  candidatos: "personas/seleccion", plus: "personas/equipo",
};

// Enlaces antiguos de Personas → secciones nuevas
const ANTIGUAS = { cobertura: "horarios", vacaciones: "solicitudes", cambios: "solicitudes", cierres: "seguimiento", incidencias: "seguimiento", disciplina: "seguimiento", plus: "equipo", horas: "equipo" };

export function leerRuta(hash) {
  const [a, s0, extra] = String(hash || "").replace(/^#\/?/, "").split("/");
  const area = AREAS.find((x) => x.id === a && !x.pronto) || AREAS[0];
  const s = area.id === "personas" && ANTIGUAS[s0] ? ANTIGUAS[s0] : s0;
  const sub = area.subs ? (area.subs.find((x) => x.id === s) || area.subs[0]) : null;
  const extraFinal = extra || (area.id === "personas" && ["cierres", "incidencias", "disciplina"].includes(s0) ? (s0 === "incidencias" ? "incidencias" : s0) : undefined);
  return { area, sub, extra: extraFinal ? decodeURIComponent(extraFinal) : undefined };
}
