# Accesos por persona (app y áreas del panel)

Al crear o editar una cuenta (Personas → Equipo) se elige:

- **Puesto en la tienda**: Principal, Apoyo, Eventual o **Sin puesto en tienda** (rol `colaborador`: no sale en horarios, plus ni cobertura; p. ej. redes sociales).
- **App de tienda** (`usuarios.acceso_app`): si no, app.elrecao.com le dice que no tiene acceso.
- **Panel de dirección**: sin acceso, **algunas áreas** (`usuarios.areas_direccion`) o todas (rol `admin`, como siempre).

La base de datos comprueba el área con `puede_area('marketing', …)` (dirección completa = sí a todo), así que quien tiene solo Marketing no puede leer el resto ni llamando a la API.

Áreas que ya se pueden dar sueltas: **Pulso, Marketing, Plan, Tecnología**. Personas, Finanzas y Producto todavía usan `es_admin()` en sus tablas, funciones y edge functions: hasta pasarlas a `puede_area`, solo con dirección completa. Al abrir una nueva: cambiar sus políticas y funciones, sus edge functions, `AREAS_SUELTAS` en `gestion-usuarios` y `suelta: true` en `src/lib/accesos.js`.

## Orden de despliegue (importante)

1. `migracion.sql` (columnas nuevas): **antes** de publicar el frontend, porque el login ya lee `acceso_app` y `areas_direccion`.
2. Edge function `gestion-usuarios` (`gestion-usuarios.index.ts`) y `google-resenas` (acepta también a quien tiene el área Marketing).
3. Frontend (merge a main).

## Producto «solo ver» (`usuarios.areas_lectura`)

Producto se da en modo solo ver: `puede_ver('producto')` abre la lectura de sus tablas (políticas `*_ver_producto`) y de sus funciones de consulta. Las escrituras (y las edge functions epos-producto, recepcion, consumo-socios, radar-recoger) siguen siendo solo de dirección. En el panel no se enseñan Recepción, Productos a revisar ni Inventario a quien solo ve (`SUBS_SOLO_DIRECCION`). Migración: `migracion-producto-ver.sql`.
