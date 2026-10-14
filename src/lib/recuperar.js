import { sb } from "./supabase.js";

// "¿Has olvidado tu contraseña?": el correo trae un enlace .../#recuperar=<token> (un solo uso, 1 hora)
export function tokenRecuperar() {
  const m = (window.location.hash || "").match(/^#recuperar=([0-9a-f]{64})$/);
  return m ? m[1] : null;
}
export function limpiarTokenRecuperar() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}
export const pedirRecuperacion = (email, destino) => sb.fn("recuperar-password", { action: "pedir", email: email.trim(), destino });
export const cambiarConToken = (token, password) => sb.fn("recuperar-password", { action: "cambiar", token, password });
