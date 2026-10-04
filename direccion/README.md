# Recao Dirección

Dashboard de dirección de Recao. Web estática, sin dependencias ni paso de build, que lee la misma base de datos (Supabase) que la app.

- **Acceso:** con las mismas cuentas de la app. Solo entran usuarios con rol `admin`.
- **Datos:** la función `public.dash_pulso()` de Supabase devuelve todo lo que necesita la home en una sola llamada. Las ventas llegan de Epos cada 10 minutos (función `epos-v4`).
- **Refresco:** la página vuelve a pedir datos cada 2 minutos y al volver a la pestaña.

## Estructura

```
index.html        página
src/main.js       login (Supabase Auth por REST) y arranque
src/pulso.js      home "Pulso"
src/charts.js     gráficos SVG (carrera del día, semana, 13 meses)
src/fmt.js        formatos en español
src/config.js     URL y clave publicable de Supabase
src/style.css     estilos (marca Recao, modo claro y oscuro)
```

## Publicar en un subdominio (Vercel)

1. En Vercel: Add New, Project, importar `recaodoshermanas/recao-app`.
2. Root Directory: `direccion`. Framework Preset: Other. Sin build command ni output directory.
3. Deploy. Después, en Settings, Domains, añadir `direccion.elrecao.com` y crear en el DNS el registro CNAME que indique Vercel.

## Probar en local

Cualquier servidor estático en esta carpeta, por ejemplo `npx serve .` o `python3 -m http.server`.
