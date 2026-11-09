// Lector de códigos de barras compartido: el del navegador (Android/Chrome) o, si no lo hay (iPhone/iPad),
// uno que se carga de internet solo en ese caso.
export async function crearLector() {
  const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"];
  if ("BarcodeDetector" in window) {
    try { const sup = await window.BarcodeDetector.getSupportedFormats(); if (sup?.length) return new window.BarcodeDetector({ formats: formats.filter((f) => sup.includes(f)) }); } catch (_) {}
  }
  const urls = ["https://cdn.jsdelivr.net/npm/barcode-detector@2/dist/es/pure.min.js", "https://esm.sh/barcode-detector@2/pure", "https://cdn.jsdelivr.net/npm/barcode-detector@3/dist/es/ponyfill.min.js"];
  for (const u of urls) {
    try { const m = await import(/* @vite-ignore */ u); const BD = m.BarcodeDetector || m.default; if (BD) return new BD({ formats }); } catch (_) {}
  }
  return null;
}

export const MSG_SIN_LECTOR = "Este móvil no consigue leer códigos con la cámara: usa la pistola o escribe el código.";

// Mensaje claro según el motivo del fallo al abrir la cámara
export function mensajeErrorCamara(e) {
  const n = e && e.name;
  if (n === "NotAllowedError" || n === "SecurityError" || n === "PermissionDeniedError")
    return "La cámara está bloqueada. Actívala en los ajustes del móvil (Safari/Chrome → Cámara → Permitir para esta página) y vuelve a intentarlo. Mientras tanto puedes usar la pistola o escribir el código.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No encuentro la cámara en este móvil: usa la pistola o escribe el código.";
  if (n === "NotReadableError") return "La cámara está siendo usada por otra aplicación. Ciérrala y vuelve a intentarlo, o escribe el código.";
  return "No he podido abrir la cámara: usa la pistola o escribe el código.";
}

// Abre la cámara trasera (con plan B si el móvil no admite facingMode)
export async function abrirCamara() {
  try { return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); }
  catch (e) { if (e && (e.name === "OverconstrainedError" || e.name === "NotFoundError")) return await navigator.mediaDevices.getUserMedia({ video: true, audio: false }); throw e; }
}
