-- Áreas del panel en modo «solo ver»: se ve todo pero no se cambia nada (de momento, Producto).
alter table public.usuarios add column if not exists areas_lectura text[];
alter table public.usuarios drop constraint if exists usuarios_areas_lectura_check;
alter table public.usuarios add constraint usuarios_areas_lectura_check
  check (areas_lectura is null or areas_lectura <@ array['pulso','personas','finanzas','producto','plan','marketing','tecnologia']);
comment on column public.usuarios.areas_lectura is 'Áreas del panel que solo puede ver (sin cambiar nada)';

-- ¿Puede ver estas áreas? (quien puede usarlas también puede verlas)
create or replace function public.puede_ver(variadic p_areas text[])
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.usuarios
    where auth_id = auth.uid() and activo = true
      and (rol = 'admin' or coalesce(areas_direccion, '{}') && p_areas or coalesce(areas_lectura, '{}') && p_areas)
  );
$$;
grant execute on function public.puede_ver(text[]) to authenticated;

-- Lectura de las tablas de Producto (las escrituras siguen siendo solo de dirección)
do $$
declare t text;
begin
  foreach t in array array['epos_products','epos_categories','epos_suppliers','epos_tax_groups','epos_daily_product_sales',
    'lab_pruebas','lab_prueba_productos','producto_cambios','producto_ficha','precio_cambios_tienda',
    'radar_busquedas','radar_cuentas','radar_ejecuciones','radar_oportunidades','radar_posts','recepciones',
    'pedidos','pedido_lineas','proveedor_pedido','pedido_decisiones'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_ver_producto', t);
      execute format('create policy %I on public.%I for select to authenticated using (puede_ver(''producto''))', t || '_ver_producto', t);
    end if;
  end loop;
end $$;

-- Funciones de lectura de Producto: «solo dirección» pasa a «quien puede ver Producto»
do $$
declare r record; def text; nuevo text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('dash_producto','dash_familias_periodo','dash_producto_cambios','dash_producto_ficha',
      'iva_grupos','lab_avisos_decision','lab_lista','lab_metricas','lab_producto_buscar','lab_pvp_sugerido','lab_umbrales',
      'pedido_avisos','pedido_detalle','pedido_lentos','pedidos_historial','proveedor_marcado_lista','revisar_iva_categoria',
      'revisar_secciones','consumo_buscar','consumo_resumen') loop
    def := pg_get_functiondef(r.oid);
    nuevo := replace(def, 'es_admin()', 'puede_ver(''producto'')');
    if nuevo <> def then execute nuevo; end if;
  end loop;
  -- catálogo: Marketing (como antes) o quien pueda ver Producto
  select p.oid into r from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'dash_catalogo';
  def := pg_get_functiondef(r.oid);
  nuevo := regexp_replace(def, 'puede_area\((variadic|VARIADIC) ''\{marketing,producto\}''::text\[\]\)', 'puede_ver(variadic ''{marketing,producto}''::text[])');
  if nuevo = def then raise exception 'dash_catalogo no cambiado'; end if;
  execute nuevo;
end $$;
