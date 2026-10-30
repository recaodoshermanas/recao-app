// Producto · Inventario: la página de conteo del inventario (hecha el 30/10/2026 para el inventario de esa noche).
// De momento la página vive en el servidor propio (VPS); aquí se abre dentro del panel. Pendiente: pasarla del todo al panel.
import { useState } from "react";
import { avisar } from "../ui.jsx";

const URL_CONTEO = "https://brand.elrecao.com/inventario/";

export function Inventario() {
  const [ver, setVer] = useState(true);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(URL_CONTEO); avisar("Enlace copiado"); }
    catch (_) { avisar("No se ha podido copiar: " + URL_CONTEO, "mal"); }
  };
  return (
    <>
      <div className="card mt">
        <div className="head">
          <div>
            <h2>Inventario</h2>
            <p className="sub">Página para contar con el móvil: se entra con la clave del inventario, se elige la subzona y se escanea o busca cada producto. Cada apunte se suma al total. Para contar, mejor ábrela a pantalla completa en el móvil.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <a className="btn-p" href={URL_CONTEO} target="_blank" rel="noopener noreferrer">Abrir a pantalla completa</a>
          <button className="btn-l" onClick={copiar}>Copiar enlace para el equipo</button>
          <button className="btn-txt" onClick={() => setVer((v) => !v)}>{ver ? "Ocultar vista previa" : "Ver aquí"}</button>
        </div>
      </div>
      {ver && (
        <div className="card mt" style={{ padding: 0, overflow: "hidden" }}>
          <iframe title="Inventario" src={URL_CONTEO} allow="camera" style={{ width: "100%", height: "78vh", border: 0, display: "block" }} />
        </div>
      )}
    </>
  );
}
