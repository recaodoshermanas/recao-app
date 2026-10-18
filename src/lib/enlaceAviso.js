// Enlace del botón de un correo de aviso: app.elrecao.com/?ir=<pantalla> (ver la función notificaciones-email).
// Se lee una sola vez al cargar la app y se limpia la dirección, para que al recargar no vuelva a saltar.
export const IR_CORREO = (() => {
  try {
    const ir = new URLSearchParams(window.location.search).get("ir");
    if (ir) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    return ir || null;
  } catch (e) { return null; }
})();
