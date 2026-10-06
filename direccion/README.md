# Recao Dirección

Panel de dirección de Recao (direccion.elrecao.com). Lee y escribe en la misma base de datos (Supabase) que la app, con las mismas cuentas. Solo entran usuarios con rol `admin`.

## Cómo está montado

- React + Vite, con las mismas dependencias que la app (`package.json` de la raíz).
- Build propio: `vite build --config vite.direccion.config.js` → `dist-direccion/`. La app (`vite.config.js`) no se toca.
- Reutiliza las pantallas de administración de la app (`src/views/owner/…`) tal cual: lo que se arregla en un sitio se arregla en el otro. Mientras se ven, el panel se pinta en claro.

## Estructura

```
index.html               entrada
public/                  icono y manifest (app de escritorio/móvil)
src/main.jsx             arranque
src/App.jsx              login, cabecera, áreas y subpáginas (rutas #/area/subpagina)
src/areas.js             mapa de áreas y subpáginas
src/Pulso.jsx            home: carga dash_pulso cada minuto y la pinta con pulso.js
src/PersonasResumen.jsx  Personas · Resumen (avisos, turnos de hoy y mañana, vacaciones)
src/Legado.jsx           pantallas que vienen de la app
src/pulso.js, charts.js, fmt.js   home "Pulso" y gráficos SVG
src/style.css, shell.css         estilos (marca Recao, modo claro y oscuro)
```

`src/main.js` y `src/config.js` son de la versión anterior sin build y ya no se usan.

## Vercel

Proyecto con Root Directory vacío (raíz del repo), Build Command `vite build --config vite.direccion.config.js`, Output Directory `dist-direccion`.
