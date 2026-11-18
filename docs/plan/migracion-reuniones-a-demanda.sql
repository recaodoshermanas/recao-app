-- Reuniones a demanda (18/11/2026, decisión de Adrián): el sistema no sabe cuándo es la reunión.
-- Se abre una cuando se quiera; al cerrar ya no se crea la siguiente sola.
-- Los bloqueos sin resolver de reuniones cerradas pasan a la próxima que se abra.

drop function if exists public.dir_reunion_cerrar(bigint, jsonb, date);
create or replace function public.dir_reunion_cerrar(p_id bigint, p_metricas jsonb default null)
returns json language plpgsql security definer set search_path to 'public' as $$
declare
  v public.dir_reuniones; a record; v_t bigint; v_area text; n_t int := 0;
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
  return json_build_object('tareas', n_t);
end $$;
grant execute on function public.dir_reunion_cerrar(bigint, jsonb) to authenticated;

create or replace function public.dir_reunion_nueva()
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint; v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if not public.puede_area('plan') then raise exception 'No autorizado'; end if;
  select id into v_id from dir_reuniones where estado <> 'cerrada' order by creado_en desc limit 1;
  if v_id is not null then return v_id; end if;
  insert into dir_reuniones (fecha, tipo, estado, empezada_en) values (v_hoy, 'semanal', 'en_curso', now()) returning id into v_id;
  -- bloqueos sin resolver de reuniones anteriores
  insert into dir_reunion_puntos (reunion_id, tipo, texto, autor, responsable, fecha, proyecto_id, origen, orden)
    select v_id, p.tipo, p.texto, p.autor, p.responsable, p.fecha, p.proyecto_id, 'arrastrado', p.orden
    from dir_reunion_puntos p join dir_reuniones r on r.id = p.reunion_id
    where r.estado = 'cerrada' and p.tipo in ('bloqueo','decision') and p.estado = 'abierto';
  update dir_reunion_puntos p set estado = 'resuelto', resolucion = 'Pasa a la reunión del ' || to_char(v_hoy, 'DD/MM/YYYY')
    from dir_reuniones r where r.id = p.reunion_id and r.estado = 'cerrada' and p.tipo in ('bloqueo','decision') and p.estado = 'abierto';
  return v_id;
end $$;
grant execute on function public.dir_reunion_nueva() to authenticated;
