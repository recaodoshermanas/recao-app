// Build del panel de dirección (direccion.elrecao.com).
// Usa las mismas dependencias y pantallas que la app (src/), pero con su propia entrada en direccion/.
// La config de la app (vite.config.js) no se toca.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Valores públicos (URL del proyecto y clave publicable). Si Vercel define las variables, mandan esas.
const URL_PUBLICA = "https://fbkqkcvfiwlnknbconwb.supabase.co";
const CLAVE_PUBLICA = "sb_publishable_V0mVZ18Pr3Z8ikDeaeSpIw_cfrkdxO2";

export default defineConfig({
  root: fileURLToPath(new URL("./direccion", import.meta.url)),
  plugins: [react()],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(process.env.VITE_SUPABASE_URL || URL_PUBLICA),
    "import.meta.env.VITE_SUPABASE_KEY": JSON.stringify(process.env.VITE_SUPABASE_KEY || CLAVE_PUBLICA),
  },
  build: {
    outDir: fileURLToPath(new URL("./dist-direccion", import.meta.url)),
    emptyOutDir: true,
  },
});
