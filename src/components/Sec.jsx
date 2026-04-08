import { F, SF, C } from "../lib/styles.js";

export function Sec({ title, sub }) {
  return (
    <div style={{ marginTop: "18px", marginBottom: "8px" }}>
      <div style={{ fontFamily: SF, fontSize: "15px", color: C.char }}>{title}</div>
      {sub && <div style={{ fontFamily: F, fontSize: "11px", color: C.mut, marginTop: "1px" }}>{sub}</div>}
    </div>
  );
}
