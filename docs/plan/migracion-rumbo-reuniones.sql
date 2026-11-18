-- Plan nuevo (Rumbo): métricas del trimestre, roadmap en tres columnas y reuniones de dirección.
-- Migración «plan_rumbo_y_reuniones». Solo añade: no borra ni cambia nada de lo que había.

-- 1) Proyectos: campos del roadmap en columnas
alter table public.proyectos
  add column if not exists columna text check (columna in ('ahora','siguiente','mas_adelante')),
  add column if not exists metrica text,
  add column if not exists como_mueve text,
  add column if not exists siguiente_paso text,
  add column if not exists siguiente_paso_fecha date,
  add column if not exists permanente boolean not null default false,
  add column if not exists orden_col double precision;

-- Colocación inicial (solo los campos nuevos; sin tocar actualizado_en para no esconder lo que lleva tiempo parado)
alter table public.proyectos disable trigger proyectos_actualizado;
update public.proyectos set columna = case estado when 'activo' then 'ahora' when 'idea' then 'siguiente' when 'pausado' then 'mas_adelante' end
  where columna is null;
update public.proyectos set permanente = true, columna = null where nombre ilike 'acondicionamiento%';
alter table public.proyectos enable trigger proyectos_actualizado;

-- 2) Configuración de las métricas (suelo de margen, horizonte, objetivo)
insert into public.app_config (clave, valor) values
  ('plan_margen_suelo', '37'), ('plan_horizonte', '2027-02-28'), ('plan_objetivo_dia', '')
on conflict (clave) do nothing;

create or replace function public.plan_config_guardar(p_suelo numeric, p_horizonte date, p_objetivo numeric)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.puede_area('plan') then raise exception 'No autorizado'; end if;
  update app_config set valor = coalesce(p_suelo::text, '37') where clave = 'plan_margen_suelo';
  update app_config set valor = coalesce(p_horizonte::text, '') where clave = 'plan_horizonte';
  update app_config set valor = coalesce(p_objetivo::text, '') where clave = 'plan_objetivo_dia';
end $$;

-- 3) Las dos métricas: facturación €/día y margen bruto %
-- Días cerrados = hasta ayer (el día de hoy va a medias y no cuenta en la media).
create or replace function public.plan_metricas()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare
  hoy date := (now() at time zone 'Europe/Madrid')::date;
  ini date := date_trunc('month', hoy)::date;
  ant date := (date_trunc('month', hoy) - interval '1 month')::date;
  r json;
begin
  if not public.puede_area('plan') then raise exception 'No autorizado'; end if;
  select json_build_object(
    'hoy', hoy,
    'config', (select json_object_agg(clave, valor) from app_config where clave in ('plan_margen_suelo','plan_horizonte','plan_objetivo_dia')),
    'mes', (select json_build_object('dias', count(*), 'venta', sum(venta), 'por_dia', round(sum(venta)/nullif(count(*),0), 0),
              'margen_pct', round(100*sum(venta_sin_iva-coste)/nullif(sum(venta_sin_iva),0), 1), 'margen', round(sum(venta_sin_iva-coste),0))
            from epos_resumen_dia where fecha >= ini and fecha < hoy and venta > 0),
    'anterior', (select json_build_object('dias', count(*), 'venta', sum(venta), 'por_dia', round(sum(venta)/nullif(count(*),0), 0),
              'margen_pct', round(100*sum(venta_sin_iva-coste)/nullif(sum(venta_sin_iva),0), 1), 'margen', round(sum(venta_sin_iva-coste),0))
            from epos_resumen_dia where fecha >= ant and fecha < ini and venta > 0),
    'hoy_venta', (select venta from epos_resumen_dia where fecha = hoy),
    'semanas', (select json_agg(s order by s.lunes) from (
        select date_trunc('week', fecha)::date as lunes, count(*) as dias, round(sum(venta)/nullif(count(*),0),0) as por_dia,
               round(100*sum(venta_sin_iva-coste)/nullif(sum(venta_sin_iva),0),1) as margen_pct
        from epos_resumen_dia
        where fecha >= date_trunc('week', hoy)::date - 77 and fecha < hoy and venta > 0
        group by 1) s)
  ) into r;
  return r;
end $$;
grant execute on function public.plan_metricas() to authenticated;
grant execute on function public.plan_config_guardar(numeric, date, numeric) to authenticated;

-- 4) Reuniones de dirección
create table if not exists public.dir_reuniones (
  id bigserial primary key,
  fecha date not null default current_date,
  tipo text not null default 'semanal' check (tipo in ('semanal','mensual','trimestral')),
  estado text not null default 'preparando' check (estado in ('preparando','en_curso','cerrada')),
  notas text,
  empezada_en timestamptz,
  cerrada_en timestamptz,
  metricas jsonb,                -- foto de las métricas al cerrar
  audio_path text,
  audio_nombre text,
  acta_estado text check (acta_estado in ('subido','transcribiendo','redactando','lista','error')),
  acta_operacion text,
  acta_error text,
  transcripcion text,
  acta jsonb,                    -- {resumen, decisiones[], acuerdos[{texto,responsable,fecha}], pendientes[]}
  creado_por uuid default current_usuario_id(),
  creado_en timestamptz not null default now()
);
create table if not exists public.dir_reunion_puntos (
  id bigserial primary key,
  reunion_id bigint not null references public.dir_reuniones(id) on delete cascade,
  tipo text not null check (tipo in ('bloqueo','decision','acuerdo')),
  texto text not null,
  autor text,
  responsable text,
  fecha date,
  proyecto_id bigint references public.proyectos(id) on delete set null,
  tarea_id bigint references public.tareas_admin(id) on delete set null,
  estado text not null default 'abierto' check (estado in ('abierto','resuelto')),
  resolucion text,
  origen text not null default 'manual' check (origen in ('manual','acta','arrastrado')),
  orden double precision,
  creado_en timestamptz not null default now()
);
create index if not exists dir_reunion_puntos_r on public.dir_reunion_puntos(reunion_id);
alter table public.dir_reuniones enable row level security;
alter table public.dir_reunion_puntos enable row level security;
drop policy if exists dir_reuniones_plan on public.dir_reuniones;
create policy dir_reuniones_plan on public.dir_reuniones for all to authenticated using (public.puede_area('plan')) with check (public.puede_area('plan'));
drop policy if exists dir_reunion_puntos_plan on public.dir_reunion_puntos;
create policy dir_reunion_puntos_plan on public.dir_reunion_puntos for all to authenticated using (public.puede_area('plan')) with check (public.puede_area('plan'));
grant select, insert, update, delete on public.dir_reuniones, public.dir_reunion_puntos to authenticated;
grant usage, select on sequence public.dir_reuniones_id_seq, public.dir_reunion_puntos_id_seq to authenticated;

-- Cerrar una reunión: los acuerdos con responsable pasan a tareas del Plan; los bloqueos y decisiones
-- sin resolver pasan a la siguiente reunión, que queda creada (una semana después, o la fecha que se diga).
create or replace function public.dir_reunion_cerrar(p_id bigint, p_metricas jsonb default null, p_siguiente date default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v public.dir_reuniones; a record; v_t bigint; v_area text; n_t int := 0; n_arr int := 0; v_sig bigint;
begin
  if not public.puede_area('plan') then raise exception 'No autorizado'; end if;
  select * into v from dir_reuniones where id = p_id for update;
  if v.id is null then raise exception 'Reunión no encontrada'; end if;
  if v.estado = 'cerrada' then raise exception 'La reunión ya está cerrada'; end if;

  for a in select * from dir_reunion_puntos where reunion_id = p_id and tipo = 'acuerdo' and tarea_id is null and coalesce(responsable,'') <> '' loop
    select area into v_area from proyectos where id = a.proyecto_id;
    insert into tareas_admin (titulo, descripcion, propietarios, estado, prioridad, area, fecha_fin, proyecto_id, checklist)
    values (a.texto, 'Acuerdo de la reunión de dirección del ' || to_char(v.fecha, 'DD/MM/YYYY'), array[a.responsable], 'pendiente', 'media', v_area, a.fecha, a.proyecto_id, '[]'::jsonb)
    returning id into v_t;
    update dir_reunion_puntos set tarea_id = v_t where id = a.id;
    n_t := n_t + 1;
  end loop;

  update dir_reuniones set estado = 'cerrada', cerrada_en = now(), metricas = coalesce(p_metricas, metricas) where id = p_id;

  select id into v_sig from dir_reuniones where estado <> 'cerrada' and id <> p_id order by fecha limit 1;
  if v_sig is null then
    insert into dir_reuniones (fecha, tipo) values (coalesce(p_siguiente, v.fecha + 7), 'semanal') returning id into v_sig;
  end if;
  insert into dir_reunion_puntos (reunion_id, tipo, texto, autor, responsable, fecha, proyecto_id, origen, orden)
    select v_sig, tipo, texto, autor, responsable, fecha, proyecto_id, 'arrastrado', orden
    from dir_reunion_puntos where reunion_id = p_id and tipo in ('bloqueo','decision') and estado = 'abierto';
  get diagnostics n_arr = row_count;
  return json_build_object('tareas', n_t, 'arrastrados', n_arr, 'siguiente', v_sig);
end $$;
grant execute on function public.dir_reunion_cerrar(bigint, jsonb, date) to authenticated;

-- 5) Audios de las reuniones (privado; solo quien tiene el área Plan)
insert into storage.buckets (id, name, public, file_size_limit)
values ('reuniones', 'reuniones', false, 209715200)
on conflict (id) do nothing;
drop policy if exists reuniones_plan_leer on storage.objects;
create policy reuniones_plan_leer on storage.objects for select to authenticated using (bucket_id = 'reuniones' and public.puede_area('plan'));
drop policy if exists reuniones_plan_subir on storage.objects;
create policy reuniones_plan_subir on storage.objects for insert to authenticated with check (bucket_id = 'reuniones' and public.puede_area('plan'));
drop policy if exists reuniones_plan_borrar on storage.objects;
create policy reuniones_plan_borrar on storage.objects for delete to authenticated using (bucket_id = 'reuniones' and public.puede_area('plan'));
