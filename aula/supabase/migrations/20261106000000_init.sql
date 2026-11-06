-- =============================================================================
-- Aula · Esquema inicial
-- Gestión docente: alumnos, grupos, clases (con series recurrentes), tareas
-- semanales con asignaciones por alumno, seguimiento y registro de actividad.
--
-- Principios:
--   * Cada fila pertenece a un profesor (owner_id = auth.uid()).
--   * RLS en todas las tablas: un profesor solo ve y modifica sus datos.
--   * Claves foráneas compuestas (id, owner_id) para impedir enlazar filas
--     de otro profesor aunque se conozca su UUID.
--   * Las clases recurrentes se materializan: cada sesión es una fila propia,
--     así modificar una sesión nunca altera las demás.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.student_status as enum ('active', 'inactive', 'archived');
create type public.lesson_status as enum ('scheduled', 'completed', 'cancelled');
create type public.task_priority as enum ('low', 'normal', 'high');
create type public.assignment_status as enum ('pending', 'in_progress', 'completed', 'reviewed');
create type public.note_kind as enum ('observation', 'achievement', 'difficulty', 'improvement');
create type public.goal_status as enum ('active', 'achieved', 'dropped');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfil del profesor
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  default_lesson_minutes integer not null default 60 check (default_lesson_minutes between 5 and 600),
  day_start_hour smallint not null default 8 check (day_start_hour between 0 and 23),
  day_end_hour smallint not null default 22 check (day_end_hour between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (day_end_hour > day_start_hour)
);

-- -----------------------------------------------------------------------------
-- Categorías de tareas (editables, se crean las iniciales al registrarse)
-- -----------------------------------------------------------------------------
create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  color text not null default 'slate',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, name)
);

-- -----------------------------------------------------------------------------
-- Alumnos
-- -----------------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 80),
  last_name text not null default '',
  photo text,                       -- miniatura JPEG en data URL (≈10 KB), protegida por RLS
  instrument text not null default '',
  phone text not null default '',
  email text not null default '',
  joined_on date,
  usual_schedule text not null default '',
  lesson_minutes integer not null default 60 check (lesson_minutes between 5 and 600),
  level text not null default '',
  notes text not null default '',
  status public.student_status not null default 'active',
  color text not null default 'indigo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check (photo is null or length(photo) < 200000)
);
create index students_owner_idx on public.students (owner_id, status);

-- -----------------------------------------------------------------------------
-- Grupos y pertenencia
-- -----------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  subject text not null default '',
  usual_weekday smallint check (usual_weekday between 1 and 7),   -- 1 = lunes … 7 = domingo
  usual_time time,
  lesson_minutes integer not null default 60 check (lesson_minutes between 5 and 600),
  location text not null default '',
  notes text not null default '',
  color text not null default 'teal',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index groups_owner_idx on public.groups (owner_id, archived);

create table public.group_members (
  group_id uuid not null,
  student_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, student_id),
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete cascade,
  foreign key (student_id, owner_id) references public.students (id, owner_id) on delete cascade
);
create index group_members_student_idx on public.group_members (student_id);
create index group_members_owner_idx on public.group_members (owner_id);

-- -----------------------------------------------------------------------------
-- Series recurrentes (la plantilla) y clases (cada sesión real)
-- -----------------------------------------------------------------------------
create table public.lesson_series (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid,
  group_id uuid,
  lesson_type text not null default 'Individual',
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  start_date date not null,
  end_date date not null,
  location text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check ((student_id is null) <> (group_id is null)),
  check (end_date >= start_date and end_date <= start_date + 800),
  foreign key (student_id, owner_id) references public.students (id, owner_id) on delete cascade,
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete cascade
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  series_id uuid,
  student_id uuid,
  group_id uuid,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  ends_at timestamptz not null,
  lesson_type text not null default 'Individual',
  status public.lesson_status not null default 'scheduled',
  location text not null default '',
  plan text not null default '',          -- contenido previsto
  notes text not null default '',         -- anotaciones / observaciones de la sesión
  summary text not null default '',       -- resumen de lo trabajado (historial)
  next_goals text not null default '',    -- objetivos para la próxima clase
  is_modified boolean not null default false,  -- sesión de una serie editada individualmente
  original_starts_at timestamptz,         -- hora original si se reprogramó
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check ((student_id is null) <> (group_id is null)),
  foreign key (series_id, owner_id) references public.lesson_series (id, owner_id) on delete set null (series_id),
  foreign key (student_id, owner_id) references public.students (id, owner_id) on delete cascade,
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete cascade
);
create index lessons_owner_time_idx on public.lessons (owner_id, starts_at);
create index lessons_student_idx on public.lessons (student_id, starts_at);
create index lessons_group_idx on public.lessons (group_id, starts_at);
create index lessons_series_idx on public.lessons (series_id, starts_at);

create or replace function public.lessons_compute_end()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger lessons_compute_end
before insert or update on public.lessons
for each row execute function public.lessons_compute_end();

-- -----------------------------------------------------------------------------
-- Tareas y asignaciones
--   * Una tarea puede ir a un alumno, a varios o a un grupo completo.
--   * Si se asigna a un grupo, tasks.group_id lo registra y se crea una
--     asignación por integrante (cada alumno lleva su propio estado).
--   * copy_key evita duplicar dos veces la misma tarea en la misma semana.
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  category_id uuid,
  priority public.task_priority not null default 'normal',
  week_start date not null check (extract(isodow from week_start) = 1),
  assigned_on date not null default current_date,
  due_on date,
  notes text not null default '',
  group_id uuid,
  lesson_id uuid,
  copied_from uuid,
  copy_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, copy_key),
  foreign key (category_id, owner_id) references public.task_categories (id, owner_id) on delete set null (category_id),
  foreign key (group_id, owner_id) references public.groups (id, owner_id) on delete cascade,
  foreign key (lesson_id, owner_id) references public.lessons (id, owner_id) on delete set null (lesson_id)
);
create index tasks_owner_week_idx on public.tasks (owner_id, week_start);
create index tasks_group_idx on public.tasks (group_id, week_start);

create table public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  student_id uuid not null,
  status public.assignment_status not null default 'pending',
  feedback text not null default '',
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, student_id),
  foreign key (task_id, owner_id) references public.tasks (id, owner_id) on delete cascade,
  foreign key (student_id, owner_id) references public.students (id, owner_id) on delete cascade
);
create index task_assignments_student_idx on public.task_assignments (student_id);
create index task_assignments_owner_idx on public.task_assignments (owner_id, status);

create or replace function public.assignments_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('completed', 'reviewed') and new.completed_at is null then
    new.completed_at := now();
  elsif new.status in ('pending', 'in_progress') then
    new.completed_at := null;
  end if;
  if new.status = 'reviewed' and new.reviewed_at is null then
    new.reviewed_at := now();
  elsif new.status <> 'reviewed' then
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;

create trigger assignments_stamp
before insert or update on public.task_assignments
for each row execute function public.assignments_stamp();

-- -----------------------------------------------------------------------------
-- Seguimiento: anotaciones y objetivos
-- -----------------------------------------------------------------------------
create table public.progress_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null,
  lesson_id uuid,
  kind public.note_kind not null default 'observation',
  category_id uuid,
  body text not null check (length(trim(body)) between 1 and 5000),
  noted_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, owner_id) references public.students (id, owner_id) on delete cascade,
  foreign key (lesson_id, owner_id) references public.lessons (id, owner_id) on delete set null (lesson_id),
  foreign key (category_id, owner_id) references public.task_categories (id, owner_id) on delete set null (category_id)
);
create index progress_notes_student_idx on public.progress_notes (student_id, noted_on desc);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  category_id uuid,
  status public.goal_status not null default 'active',
  target_date date,
  achieved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_id, owner_id) references public.students (id, owner_id) on delete cascade,
  foreign key (category_id, owner_id) references public.task_categories (id, owner_id) on delete set null (category_id)
);
create index goals_student_idx on public.goals (student_id, status);

-- -----------------------------------------------------------------------------
-- Registro de actividad (alimentado por triggers, solo lectura para el usuario)
-- -----------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  entity text not null,
  entity_id uuid,
  action text not null check (action in ('created', 'updated', 'deleted')),
  label text not null default '',
  created_at timestamptz not null default now()
);
create index activity_log_owner_idx on public.activity_log (owner_id, created_at desc);

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
  act text;
  lbl text;
  ent text := tg_table_name;
  owner uuid;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
    act := 'deleted';
    -- los borrados en cascada (p. ej. borrar un alumno borra sus clases) no se registran
    if (rec->>'student_id' is not null and not exists (select 1 from public.students s where s.id = (rec->>'student_id')::uuid))
       or (rec->>'group_id' is not null and not exists (select 1 from public.groups g where g.id = (rec->>'group_id')::uuid)) then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    rec := to_jsonb(new);
    act := 'created';
  else
    rec := to_jsonb(new);
    act := 'updated';
    -- evita ruido: ignora actualizaciones que no cambian nada visible
    if to_jsonb(new) - 'updated_at' = to_jsonb(old) - 'updated_at' then
      return new;
    end if;
  end if;

  lbl := coalesce(
    nullif(trim(concat_ws(' ', rec->>'first_name', rec->>'last_name')), ''),
    rec->>'name',
    rec->>'title',
    case when ent = 'lessons' then to_char((rec->>'starts_at')::timestamptz at time zone 'Europe/Madrid', 'DD/MM HH24:MI') end,
    ''
  );

  -- en la creación de series se insertan muchas clases: registra solo la serie
  if ent = 'lessons' and act = 'created' and rec->>'series_id' is not null then
    return null;
  end if;
  if ent = 'lessons' and act = 'updated' and (to_jsonb(old)->>'status') is distinct from (rec->>'status') then
    lbl := lbl || ' · ' || case rec->>'status'
      when 'completed' then 'realizada'
      when 'cancelled' then 'cancelada'
      else 'programada' end;
  end if;

  owner := (rec->>'owner_id')::uuid;
  -- si se está eliminando la cuenta no hay nada que registrar
  if not exists (select 1 from auth.users u where u.id = owner) then
    return null;
  end if;

  insert into public.activity_log (owner_id, entity, entity_id, action, label)
  values (owner, ent, (rec->>'id')::uuid, act, left(lbl, 200));

  -- mantiene el registro acotado (últimas 500 entradas por profesor)
  delete from public.activity_log
  where owner_id = owner
    and id < (
      select id from public.activity_log
      where owner_id = owner
      order by id desc offset 500 limit 1
    );
  return null;
end;
$$;

create trigger students_activity after insert or update or delete on public.students
for each row execute function public.log_activity();
create trigger groups_activity after insert or update or delete on public.groups
for each row execute function public.log_activity();
create trigger lessons_activity after insert or update or delete on public.lessons
for each row execute function public.log_activity();
create trigger series_activity after insert or delete on public.lesson_series
for each row execute function public.log_activity();
create trigger tasks_activity after insert or update or delete on public.tasks
for each row execute function public.log_activity();
create trigger goals_activity after insert or update or delete on public.goals
for each row execute function public.log_activity();

-- updated_at
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger students_updated before update on public.students for each row execute function public.set_updated_at();
create trigger groups_updated before update on public.groups for each row execute function public.set_updated_at();
create trigger series_updated before update on public.lesson_series for each row execute function public.set_updated_at();
create trigger lessons_updated before update on public.lessons for each row execute function public.set_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create trigger assignments_updated before update on public.task_assignments for each row execute function public.set_updated_at();
create trigger notes_updated before update on public.progress_notes for each row execute function public.set_updated_at();
create trigger goals_updated before update on public.goals for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Alta de profesor: perfil + categorías iniciales
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;

  insert into public.task_categories (owner_id, name, color, sort_order)
  values
    (new.id, 'Técnica', 'indigo', 1),
    (new.id, 'Estudios', 'sky', 2),
    (new.id, 'Repertorio', 'violet', 3),
    (new.id, 'Lectura', 'amber', 4),
    (new.id, 'Teoría musical', 'teal', 5),
    (new.id, 'Ejercicios', 'rose', 6),
    (new.id, 'Otros', 'slate', 7)
  on conflict (owner_id, name) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Operaciones atómicas (RPC). Se ejecutan con los permisos del usuario
-- (security invoker), por lo que la RLS sigue aplicándose.
-- -----------------------------------------------------------------------------

-- Asigna una tarea a un grupo: guarda el origen y crea una asignación por integrante.
create or replace function public.assign_task_to_group(p_task_id uuid, p_group_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  update public.tasks set group_id = p_group_id where id = p_task_id;
  if not found then
    raise exception 'Tarea no encontrada';
  end if;
  insert into public.task_assignments (task_id, student_id, owner_id)
  select p_task_id, gm.student_id, gm.owner_id
  from public.group_members gm
  join public.students s on s.id = gm.student_id
  where gm.group_id = p_group_id and s.status <> 'archived'
  on conflict (task_id, student_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Copia tareas a otra semana. Si p_student_id se indica, solo se copia la
-- asignación de ese alumno (la copia queda como tarea individual).
-- Devuelve el número de tareas creadas; las ya copiadas se omiten.
create or replace function public.duplicate_tasks(p_task_ids uuid[], p_target_week date, p_student_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t record;
  new_id uuid;
  created integer := 0;
  key text;
  shift integer;
begin
  if extract(isodow from p_target_week) <> 1 then
    raise exception 'La semana de destino debe empezar en lunes';
  end if;

  for t in select * from public.tasks where id = any(p_task_ids) loop
    if t.week_start = p_target_week then
      continue;
    end if;
    key := t.id::text || ':' || p_target_week::text || ':' || coalesce(p_student_id::text, 'all');
    shift := p_target_week - t.week_start;

    insert into public.tasks (owner_id, title, description, category_id, priority, week_start,
                              assigned_on, due_on, notes, group_id, copied_from, copy_key)
    values (t.owner_id, t.title, t.description, t.category_id, t.priority, p_target_week,
            greatest(t.assigned_on + shift, p_target_week), case when t.due_on is null then null else t.due_on + shift end,
            t.notes, case when p_student_id is null then t.group_id else null end, t.id, key)
    on conflict (owner_id, copy_key) do nothing
    returning id into new_id;

    if new_id is null then
      continue;
    end if;
    created := created + 1;

    if t.group_id is not null and p_student_id is null then
      -- tarea de grupo: se asigna a los integrantes actuales
      insert into public.task_assignments (owner_id, task_id, student_id)
      select gm.owner_id, new_id, gm.student_id
      from public.group_members gm
      join public.students s on s.id = gm.student_id
      where gm.group_id = t.group_id and s.status <> 'archived'
      on conflict do nothing;
    else
      insert into public.task_assignments (owner_id, task_id, student_id)
      select a.owner_id, new_id, a.student_id
      from public.task_assignments a
      where a.task_id = t.id and (p_student_id is null or a.student_id = p_student_id)
      on conflict do nothing;
    end if;
    new_id := null;
  end loop;
  return created;
end;
$$;

-- Duplica un alumno (ficha y pertenencia a grupos, sin historial).
create or replace function public.duplicate_student(p_student_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.students (owner_id, first_name, last_name, photo, instrument, phone, email, joined_on,
                               usual_schedule, lesson_minutes, level, notes, status, color)
  select owner_id, first_name, trim(last_name || ' (copia)'), photo, instrument, phone, email, current_date,
         usual_schedule, lesson_minutes, level, notes, 'active', color
  from public.students where id = p_student_id
  returning id into new_id;
  if new_id is null then
    raise exception 'Alumno no encontrado';
  end if;
  insert into public.group_members (group_id, student_id, owner_id)
  select group_id, new_id, owner_id from public.group_members where student_id = p_student_id;
  return new_id;
end;
$$;

-- Clases que se solapan con un intervalo (para avisar de conflictos).
create or replace function public.find_conflicts(p_starts timestamptz, p_ends timestamptz, p_exclude uuid[] default '{}')
returns setof public.lessons
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.lessons
  where status <> 'cancelled'
    and starts_at < p_ends
    and ends_at > p_starts
    and not (id = any(coalesce(p_exclude, '{}')))
  order by starts_at;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.task_categories enable row level security;
alter table public.students enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.lesson_series enable row level security;
alter table public.lessons enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.progress_notes enable row level security;
alter table public.goals enable row level security;
alter table public.activity_log enable row level security;

create policy "Perfil propio: leer" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Perfil propio: modificar" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare
  t text;
begin
  foreach t in array array['task_categories', 'students', 'groups', 'group_members', 'lesson_series',
                           'lessons', 'tasks', 'task_assignments', 'progress_notes', 'goals'] loop
    execute format('create policy "Datos propios: leer" on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format('create policy "Datos propios: crear" on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', t);
    execute format('create policy "Datos propios: modificar" on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('create policy "Datos propios: borrar" on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t);
  end loop;
end;
$$;

create policy "Actividad propia: leer" on public.activity_log for select to authenticated using ((select auth.uid()) = owner_id);

-- -----------------------------------------------------------------------------
-- Permisos: solo usuarios autenticados acceden a los datos
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.task_categories, public.students, public.groups, public.group_members, public.lesson_series,
  public.lessons, public.tasks, public.task_assignments, public.progress_notes, public.goals
  to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.activity_log to authenticated;
grant execute on function
  public.assign_task_to_group(uuid, uuid),
  public.duplicate_tasks(uuid[], date, uuid),
  public.duplicate_student(uuid),
  public.find_conflicts(timestamptz, timestamptz, uuid[])
  to authenticated;
