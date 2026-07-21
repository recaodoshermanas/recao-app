export const F = `'DM Sans', system-ui, sans-serif`;
export const SF = `'DM Serif Display', Georgia, serif`;
export const C = {
  cream: "#FAF7F2", char: "#2C2C2C", gold: "#F1BE49", brd: "#E4DDD0",
  mut: "#8A8070", grn: "#2D8B4E", red: "#C44D3F", blu: "#4A7AB5", pur: "#8B6DAF",
  brdL: "#EBE3D5", mutL: "#A89A80", goldDark: "#402300", goldSub: "#714403",
};
export const LOGO = "https://elrecao.com/wp-content/uploads/2025/07/cropped-Recao.png";

export const inp = { width: "100%", padding: "14px 16px", border: `1.5px solid ${C.brd}`, borderRadius: "14px", fontFamily: F, fontSize: "15px", color: C.char, background: "#fff", boxSizing: "border-box", outline: "none" };
export const lbl = { display: "block", fontFamily: F, fontSize: "11px", fontWeight: 700, color: C.mut, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" };
export const crd = { background: "#fff", borderRadius: "18px", border: `1px solid ${C.brdL}`, padding: "16px", marginBottom: "12px", boxShadow: "0 1px 2px rgba(44,44,44,.03)" };

export const SHADOW = {
  card: "0 1px 2px rgba(44,44,44,.03)",
  panel: "0 1px 2px rgba(44,44,44,.04), 0 22px 44px -30px rgba(44,44,44,.28)",
  hero: "0 10px 24px -12px rgba(200,150,30,.8)",
};

export const btnDark = { width: "100%", boxSizing: "border-box", textAlign: "center", background: C.char, color: C.gold, fontFamily: SF, fontSize: "16px", padding: "15px", borderRadius: "14px", border: "none", cursor: "pointer" };
export const btnGhost = { textAlign: "center", background: "#fff", color: C.char, border: `1.5px solid ${C.brd}`, fontFamily: F, fontWeight: 600, fontSize: "14px", padding: "11px 14px", borderRadius: "12px", cursor: "pointer" };

export const CHIP = {
  pendiente: { bg: "#FBF0DA", fg: "#8A6410", label: "Pendiente" },
  aceptado: { bg: "#E7F3EC", fg: "#1E7A46", label: "Aceptado" },
  rechazado: { bg: "#FBEAE7", fg: "#B23A2C", label: "Rechazado" },
};
export function chipStyle(estado) {
  const c = CHIP[estado] || CHIP.pendiente;
  return { fontFamily: F, fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "5px 11px", borderRadius: "999px", background: c.bg, color: c.fg };
}

const AVATARS = ["#F1BE49", "#8B6DAF", "#2D8B4E", "#4A7AB5", "#C44D3F", "#E08A3C"];
export function avatar(name) {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const bg = AVATARS[h % AVATARS.length];
  return { bg, fg: bg === "#F1BE49" ? "#402300" : "#fff", inicial: (s.trim().charAt(0) || "?").toUpperCase() };
}

export const FONT_LINK = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap";
