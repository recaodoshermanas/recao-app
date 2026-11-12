// Accesos de cada persona: app de tienda (app.elrecao.com) y áreas del panel de dirección (direccion.elrecao.com).
// rol "admin" = dirección completa (todas las áreas). Quien no es admin entra al panel solo en sus areas_direccion.
// rol "colaborador" = sin puesto en tienda (p. ej. redes sociales): solo panel, no sale en turnos ni en el plus.

// Áreas que se pueden dar por separado. «suelta: false» = de momento solo con dirección completa,
// porque sus datos aún se comprueban como «solo dirección» en la base de datos.
// Si se cambia, cambiar también AREAS_SUELTAS en la función gestion-usuarios.
export const AREAS_ACCESO = [
  { id: "pulso", label: "Pulso", suelta: true },
  { id: "marketing", label: "Marketing", suelta: true },
  { id: "plan", label: "Plan", suelta: true },
  { id: "tecnologia", label: "Tecnología", suelta: true },
  { id: "personas", label: "Personas", suelta: false },
  { id: "finanzas", label: "Finanzas", suelta: false },
  { id: "producto", label: "Producto", suelta: false },
];
export const etiquetaArea = (id) => AREAS_ACCESO.find((a) => a.id === id)?.label || id;

export const esDireccionCompleta = (u) => !!u && u.rol === "admin";
export const areasDe = (u) => (esDireccionCompleta(u) ? AREAS_ACCESO.map((a) => a.id) : (u?.areas_direccion || []));
export const entraEnPanel = (u) => !!u && (esDireccionCompleta(u) || areasDe(u).length > 0);
export const entraEnApp = (u) => !!u && u.rol !== "colaborador" && u.acceso_app !== false;
export const puedeArea = (u, area) => esDireccionCompleta(u) || areasDe(u).includes(area);
// "no" | "algunas" | "todas"
export const modoDireccion = (u) => (esDireccionCompleta(u) ? "todas" : areasDe(u).length ? "algunas" : "no");

// Texto corto para fichas y tarjetas
export function resumenAccesos(u) {
  const partes = [];
  if (entraEnApp(u)) partes.push("App");
  if (esDireccionCompleta(u)) partes.push("Dirección completa");
  else if (areasDe(u).length) partes.push("Dirección: " + areasDe(u).map(etiquetaArea).join(", "));
  return partes.length ? partes.join(" · ") : "Sin acceso";
}
