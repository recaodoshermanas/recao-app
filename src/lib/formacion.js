// Formación en vídeo (#79): utilidades comunes a la app de las eventuales y al panel de dirección.
export function duracionTxt(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
// «visto» = llegó al final sin saltos; «medias» = empezado; «nuevo» = sin empezar
export function estadoVideo(v) {
  if (v.completo_en) return "visto";
  return Number(v.max_seg) > 0 ? "medias" : "nuevo";
}
export function pctVideo(v) {
  const d = Number(v.duracion_seg) || 0;
  return d > 0 ? Math.min(100, Math.floor((Number(v.max_seg) / d) * 100)) : 0;
}
export function resumenFormacion(videos) {
  const total = (videos || []).length;
  const completos = (videos || []).filter((v) => v.completo_en).length;
  return { total, completos, pendientes: total - completos };
}
