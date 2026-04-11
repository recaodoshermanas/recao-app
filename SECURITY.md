# Seguridad — estado actual

## Lo que está protegido

- **Tabla `usuarios`**: RLS activado sin políticas para `anon`/`authenticated`. Imposible leer hashes bcrypt o listar usuarios desde fuera. Todo acceso pasa por funciones `SECURITY DEFINER` (`login_usuario`, `crear_usuario`, `actualizar_usuario`, `resetear_password`, `get_usuario_by_id`, `listar_usuarios`).
- **Salvaguarda anti-bloqueo**: `actualizar_usuario` impide dejar el sistema sin admins activos.
- **Sesiones**: tokens en localStorage con caducidad de 30 días. Al arrancar la app se revalida contra `get_usuario_by_id` — si el usuario fue desactivado, la sesión se cierra.

## Lo que NO está protegido (asumido conscientemente)

Las funciones SQL de gestión (`crear_usuario`, `actualizar_usuario`, `resetear_password`, `listar_usuarios`) están expuestas vía RPC a `anon`. Cualquiera con la URL de la app y conocimientos básicos podría llamarlas desde DevTools y, por ejemplo, crearse un usuario admin.

**Por qué se acepta ahora:**
- App interna, 2-5 usuarios, URL no pública.
- Sin datos de clientes ni información financiera de terceros.
- Cerrar este agujero requiere una de estas dos cosas, ninguna trivial:
  1. Migrar el login a Supabase Auth nativo y usar `auth.uid()` en políticas RLS y en funciones `SECURITY DEFINER` con check de rol.
  2. Mover la gestión de usuarios a una Edge Function que valide un token de sesión propio antes de tocar la BD, y revocar `EXECUTE` de las RPC a `anon`.

**Cuándo merece la pena cerrarlo:**
- Si la app deja de ser solo interna.
- Si se añaden datos sensibles (clientes, pagos, datos personales de terceros).
- Si el número de usuarios crece más allá del círculo de confianza directo.

## Otras tablas

`config`, `datos_mes`, `facturas_proveedores`, `proveedores` tienen RLS con política `internal_app_access` que permite todo a `anon`/`authenticated`. Mismo razonamiento: app interna, sin datos de terceros. Si en algún momento se quiere granularidad por rol (ej. trabajadoras solo escriben facturas, no leen P&L), hay que migrar también a Supabase Auth nativo.
