// Tema de dirección para las pantallas que vienen de la app.
// En el build del panel, este archivo sustituye a src/lib/styles.js (ver vite.direccion.config.js):
// mismos nombres, colores y tipografía de direccion.elrecao.com. La app no cambia.
export const F = `'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`;
export const SF = `'Fraunces', Georgia, serif`;
export const C = {
  cream: "#F6F5F1", char: "#1E272E", gold: "#F1BE49", brd: "#E4E2DB",
  mut: "#6E787F", grn: "#317039", red: "#B2412A", blu: "#3D6E9E", pur: "#7A5E9E",
  brdL: "#ECEAE4", mutL: "#8E979D", goldDark: "#1E272E", goldSub: "#4E5961",
};
export const LOGO = "/icono.png";

export const inp = { width: "100%", padding: "12px 14px", border: `1px solid ${C.brd}`, borderRadius: "12px", fontFamily: F, fontSize: "15px", color: C.char, background: "#fff", boxSizing: "border-box", outline: "none" };
export const lbl = { display: "block", fontFamily: F, fontSize: "12px", fontWeight: 700, color: C.mut, marginBottom: "6px" };
export const crd = { background: "#fff", borderRadius: "18px", border: `1px solid ${C.brd}`, padding: "18px", marginBottom: "12px", boxShadow: "none" };

export const SHADOW = {
  card: "none",
  panel: "0 1px 2px rgba(30,39,46,.04), 0 18px 40px -28px rgba(30,39,46,.25)",
  hero: "none",
};

export const btnDark = { width: "100%", boxSizing: "border-box", textAlign: "center", background: C.char, color: "#fff", fontFamily: F, fontWeight: 700, fontSize: "15px", padding: "14px", borderRadius: "12px", border: "none", cursor: "pointer" };
export const btnGhost = { textAlign: "center", background: "#fff", color: C.char, border: `1px solid ${C.brd}`, fontFamily: F, fontWeight: 600, fontSize: "14px", padding: "10px 14px", borderRadius: "12px", cursor: "pointer" };

export const CHIP = {
  pendiente: { bg: "#FBF0D6", fg: "#7A5A0E", label: "Pendiente" },
  aceptado: { bg: "#E3F0E5", fg: "#317039", label: "Aceptado" },
  rechazado: { bg: "#F7E4DF", fg: "#B2412A", label: "Rechazado" },
};
export function chipStyle(estado) {
  const c = CHIP[estado] || CHIP.pendiente;
  return { fontFamily: F, fontSize: "11px", fontWeight: 700, padding: "5px 11px", borderRadius: "999px", background: c.bg, color: c.fg };
}

const AVATARS = ["#F1BE49", "#7A5E9E", "#317039", "#3D6E9E", "#B2412A", "#D9822B"];
export function avatar(name) {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const bg = AVATARS[h % AVATARS.length];
  return { bg, fg: bg === "#F1BE49" ? "#1E272E" : "#fff", inicial: (s.trim().charAt(0) || "?").toUpperCase() };
}

export const FONT_LINK = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,600..900,100&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";
