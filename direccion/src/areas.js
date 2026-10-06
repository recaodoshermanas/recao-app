// Mapa del panel: áreas y sus subpáginas. La URL es #/area/subpagina.
// "legado" = pantalla que viene tal cual de la app (se pinta en claro, con su estilo de siempre).
export const AREAS = [
  { id: "pulso", label: "Pulso" },
  {
    id: "personas", label: "Personas", quien: "Pablo",
    subs: [
      { id: "resumen", label: "Resumen" },
      { id: "horarios", label: "Horarios", legado: true },
      { id: "cobertura", label: "Cobertura", legado: true },
      { id: "vacaciones", label: "Vacaciones", legado: true },
      { id: "cambios", label: "Cambios de turno", legado: true },
      { id: "cierres", label: "Cierres", legado: true },
      { id: "incidencias", label: "Incidencias", legado: true },
      { id: "disciplina", label: "Disciplina", legado: true },
      { id: "plus", label: "Plus del mes", legado: true },
      { id: "horas", label: "Horas extras", legado: true },
      { id: "equipo", label: "Equipo", legado: true },
      { id: "seleccion", label: "Selección", legado: true },
    ],
  },
  {
    id: "finanzas", label: "Finanzas", quien: "Miguel",
    subs: [
      { id: "evolucion", label: "Evolución", legado: true },
      { id: "resultados", label: "Cuenta de resultados", legado: true },
      { id: "tesoreria", label: "Tesorería", legado: true },
      { id: "mes", label: "Datos del mes", legado: true },
      { id: "facturas", label: "Facturas", legado: true },
    ],
  },
  {
    id: "producto", label: "Producto", quien: "Javi",
    subs: [
      { id: "analitica", label: "Analítica", legado: true },
    ],
  },
  {
    id: "plan", label: "Plan",
    subs: [
      { id: "tareas", label: "Tareas", legado: true },
    ],
  },
  { id: "marketing", label: "Marketing", pronto: true },
  // fuera del menú principal: se abre desde el usuario
  { id: "ajustes", label: "Ajustes", oculto: true, subs: [{ id: "general", label: "Ajustes", legado: true }] },
];

// Lo que mandan las notificaciones de la app (evento "recao-nav") → dónde se abre aquí
export const DESTINOS = {
  horarios: "personas/horarios", cobertura: "personas/cobertura", vacaciones: "personas/vacaciones",
  cambios: "personas/cambios", cierres: "personas/cierres", incidencias: "personas/incidencias",
  disciplina: "personas/disciplina", horas: "personas/horas", usuarios: "personas/equipo",
  candidatos: "personas/seleccion", plus: "personas/plus",
};

export function leerRuta(hash) {
  const [a, s] = String(hash || "").replace(/^#\/?/, "").split("/");
  const area = AREAS.find((x) => x.id === a && !x.pronto) || AREAS[0];
  const sub = area.subs ? (area.subs.find((x) => x.id === s) || area.subs[0]) : null;
  return { area, sub };
}
