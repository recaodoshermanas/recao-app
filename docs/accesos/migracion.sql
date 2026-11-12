-- Accesos por persona: app de tienda sí/no y áreas del panel de dirección.
-- rol 'admin' = dirección completa (sin cambios). Quien tiene areas_direccion entra al panel solo en esas áreas.
-- rol 'colaborador' = persona sin puesto en tienda (p. ej. redes sociales): no sale en turnos, plus ni cobertura.
alter table public.usuarios add column if not exists acceso_app boolean not null default true;
alter table public.usuarios add column if not exists areas_direccion text[];
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check check (rol = any (array['admin','trabajadora','colaborador']));
alter table public.usuarios drop constraint if exists usuarios_areas_direccion_check;
alter table public.usuarios add constraint usuarios_areas_direccion_check
  check (areas_direccion is null or areas_direccion <@ array['pulso','personas','finanzas','producto','plan','marketing','tecnologia']);
comment on column public.usuarios.acceso_app is 'Puede entrar en app.elrecao.com';
comment on column public.usuarios.areas_direccion is 'Áreas del panel de dirección a las que entra sin ser dirección completa (rol admin = todas)';

-- ¿La persona conectada puede usar alguna de estas áreas del panel? Dirección completa = sí a todo.
create or replace function public.puede_area(variadic p_areas text[])
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.usuarios
    where auth_id = auth.uid() and activo = true
      and (rol = 'admin' or coalesce(areas_direccion, '{}') && p_areas)
  );
$$;
grant execute on function public.puede_area(text[]) to authenticated;

-- Políticas de las tablas de cada área (antes: es_admin())
do $$
declare r record;
begin
  for r in select * from (values
    ('mkt_calendario','mkt_calendario_admin', array['marketing']),
    ('mkt_campanas','mkt_campanas_admin', array['marketing']),
    ('radar_busquedas','radar_busquedas_admin', array['marketing','producto']),
    ('radar_posts','radar_posts_admin', array['marketing','producto']),
    ('proyectos','proyectos_admin', array['plan']),
    ('tareas_admin','ta_all', array['plan']),
    ('tarea_comentarios','tarea_comentarios_admin', array['plan']),
    ('tec_solicitudes','tec_solicitudes_admin', array['tecnologia']),
    ('tec_solicitud_eventos','tec_eventos_admin', array['tecnologia']),
    ('tec_textos','tec_textos_admin', array['tecnologia'])
  ) as t(tabla, pol, areas) loop
    execute format('alter policy %I on public.%I using (puede_area(variadic %L::text[])) with check (puede_area(variadic %L::text[]))',
                   r.pol, r.tabla, r.areas, r.areas);
  end loop;
end $$;

-- Funciones de cada área: el control "solo dirección" pasa a "dirección o quien tenga el área"
do $$
declare r record; def text; nuevo text;
begin
  for r in select p.oid, p.proname, t.areas from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join (values
      ('dash_pulso', array['pulso']), ('dash_comparar', array['pulso']),
      ('dash_marketing', array['marketing']), ('dash_mkt_campanas', array['marketing']),
      ('dash_resenas', array['marketing']), ('radar_redes_clasificar', array['marketing','producto']),
      ('dash_catalogo', array['marketing','producto']),
      ('tec_auto_estado', array['tecnologia'])
    ) as t(nombre, areas) on t.nombre = p.proname
    where n.nspname = 'public' loop
    def := pg_get_functiondef(r.oid);
    nuevo := replace(def, 'es_admin()', format('puede_area(variadic %L::text[])', r.areas));
    if nuevo = def then raise exception 'La función % no usa es_admin()', r.proname; end if;
    execute nuevo;
  end loop;
end $$;

-- (2ª migración) Las personas sin puesto en tienda (rol colaborador) no son plantilla: no leen facturas, proveedores, config ni datos del mes.
create or replace function public.es_plantilla()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.usuarios
                  where auth_id = auth.uid() and activo = true and coalesce(eventual, false) = false
                    and rol in ('admin', 'trabajadora'));
$function$;
