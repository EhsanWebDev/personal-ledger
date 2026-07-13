create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  work_date date not null,
  clocked_in_at timestamptz not null,
  clocked_out_at timestamptz,
  status text not null default 'clocked_in',
  target_minutes smallint not null default 480,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_sessions_status_check
    check (status in ('clocked_in', 'on_break', 'clocked_out')),
  constraint work_sessions_target_minutes_check
    check (target_minutes between 1 and 1440),
  constraint work_sessions_clock_order_check
    check (clocked_out_at is null or clocked_out_at >= clocked_in_at),
  constraint work_sessions_closed_state_check
    check (
      (status = 'clocked_out' and clocked_out_at is not null)
      or (status <> 'clocked_out' and clocked_out_at is null)
    )
);

create table public.break_periods (
  id uuid primary key default gen_random_uuid(),
  work_session_id uuid not null references public.work_sessions (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint break_periods_time_order_check
    check (ended_at is null or ended_at >= started_at)
);

create unique index work_sessions_one_active_per_user_idx
  on public.work_sessions (user_id)
  where status in ('clocked_in', 'on_break');

create index work_sessions_user_date_idx
  on public.work_sessions (user_id, work_date desc, clocked_in_at desc);

create index work_sessions_status_idx
  on public.work_sessions (status)
  where status <> 'clocked_out';

create unique index break_periods_one_active_per_session_idx
  on public.break_periods (work_session_id)
  where ended_at is null;

create index break_periods_session_started_idx
  on public.break_periods (work_session_id, started_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger work_sessions_set_updated_at
before update on public.work_sessions
for each row execute function public.set_updated_at();

create trigger break_periods_set_updated_at
before update on public.break_periods
for each row execute function public.set_updated_at();

create or replace function public.time_tracker_clock_in(
  p_user_id uuid,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_work_date date;
  v_session_id uuid;
begin
  if p_user_id is null then
    raise exception using errcode = '22004', message = 'A user is required to clock in.';
  end if;

  v_work_date := (v_now at time zone p_timezone)::date;

  if extract(isodow from v_work_date) > 5 then
    raise exception using errcode = 'P0001', message = 'Clock in is unavailable on weekends.';
  end if;

  begin
    insert into public.work_sessions (
      user_id,
      work_date,
      clocked_in_at,
      status,
      target_minutes
    )
    values (p_user_id, v_work_date, v_now, 'clocked_in', 480)
    returning id into v_session_id;
  exception
    when unique_violation then
      raise exception using errcode = 'P0001', message = 'A work session is already active.';
  end;

  return v_session_id;
end;
$$;

create or replace function public.time_tracker_start_break(p_user_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_session public.work_sessions%rowtype;
begin
  select *
  into v_session
  from public.work_sessions
  where user_id = p_user_id
    and status <> 'clocked_out'
  order by clocked_in_at desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Clock in before starting a break.';
  end if;

  if v_session.status = 'on_break' then
    raise exception using errcode = 'P0001', message = 'A break is already active.';
  end if;

  insert into public.break_periods (work_session_id, started_at)
  values (v_session.id, v_now);

  update public.work_sessions
  set status = 'on_break'
  where id = v_session.id;

  return v_session.id;
end;
$$;

create or replace function public.time_tracker_resume(p_user_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_session public.work_sessions%rowtype;
  v_break_id uuid;
begin
  select *
  into v_session
  from public.work_sessions
  where user_id = p_user_id
    and status <> 'clocked_out'
  order by clocked_in_at desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'There is no active session to resume.';
  end if;

  if v_session.status <> 'on_break' then
    raise exception using errcode = 'P0001', message = 'There is no active break to resume from.';
  end if;

  select id
  into v_break_id
  from public.break_periods
  where work_session_id = v_session.id
    and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'The active break could not be found.';
  end if;

  update public.break_periods
  set ended_at = v_now
  where id = v_break_id;

  update public.work_sessions
  set status = 'clocked_in'
  where id = v_session.id;

  return v_session.id;
end;
$$;

create or replace function public.time_tracker_clock_out(p_user_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_session public.work_sessions%rowtype;
begin
  select *
  into v_session
  from public.work_sessions
  where user_id = p_user_id
    and status <> 'clocked_out'
  order by clocked_in_at desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'There is no active session to clock out.';
  end if;

  if v_session.status = 'on_break' then
    update public.break_periods
    set ended_at = v_now
    where work_session_id = v_session.id
      and ended_at is null;
  end if;

  update public.work_sessions
  set status = 'clocked_out', clocked_out_at = v_now
  where id = v_session.id;

  return v_session.id;
end;
$$;

create or replace function public.time_tracker_state(
  p_user_id uuid,
  p_timezone text default 'UTC',
  p_history_limit integer default 30
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
with params as (
  select
    snapshot.server_now,
    (snapshot.server_now at time zone p_timezone)::date as local_date
  from (select clock_timestamp() as server_now) snapshot
),
session_totals as (
  select
    session.*,
    params.server_now,
    coalesce(breaks.break_seconds, 0)::bigint as break_seconds,
    breaks.current_break_started_at,
    case
      when breaks.current_break_started_at is null then 0::bigint
      else greatest(
        0::bigint,
        floor(extract(epoch from (params.server_now - breaks.current_break_started_at)))::bigint
      )
    end as current_break_seconds
  from public.work_sessions session
  cross join params
  left join lateral (
    select
      coalesce(sum(
        greatest(
          0,
          extract(epoch from (
            least(
              coalesce(period.ended_at, params.server_now),
              coalesce(session.clocked_out_at, params.server_now),
              params.server_now
            ) - period.started_at
          ))
        )
      ), 0)::bigint as break_seconds,
      max(period.started_at) filter (where period.ended_at is null) as current_break_started_at
    from public.break_periods period
    where period.work_session_id = session.id
  ) breaks on true
  where session.user_id = p_user_id
),
session_stats as (
  select
    session_totals.*,
    greatest(
      0::bigint,
      floor(extract(epoch from (
        coalesce(clocked_out_at, server_now) - clocked_in_at
      )))::bigint - break_seconds
    ) as worked_seconds
  from session_totals
),
daily as (
  select
    work_date,
    min(clocked_in_at) as clocked_in_at,
    case
      when bool_or(status <> 'clocked_out') then null
      else max(clocked_out_at)
    end as clocked_out_at,
    (array_agg(status order by clocked_in_at desc))[1] as status,
    sum(worked_seconds)::bigint as worked_seconds,
    sum(break_seconds)::bigint as break_seconds,
    (max(target_minutes) * 60)::bigint as target_seconds
  from session_stats
  group by work_date
),
today as (
  select jsonb_build_object(
    'work_date', day.work_date,
    'clocked_in_at', day.clocked_in_at,
    'clocked_out_at', day.clocked_out_at,
    'status', day.status,
    'worked_seconds', day.worked_seconds,
    'break_seconds', day.break_seconds,
    'target_seconds', day.target_seconds,
    'remaining_seconds', greatest(day.target_seconds - day.worked_seconds, 0::bigint),
    'overtime_seconds', greatest(day.worked_seconds - day.target_seconds, 0::bigint),
    'target_met', day.worked_seconds >= day.target_seconds
  ) as value
  from daily day
  cross join params
  where day.work_date = params.local_date
),
active as (
  select jsonb_build_object(
    'id', session.id,
    'work_date', session.work_date,
    'status', session.status,
    'clocked_in_at', session.clocked_in_at,
    'target_seconds', (session.target_minutes * 60)::bigint,
    'worked_seconds', session.worked_seconds,
    'break_seconds', session.break_seconds,
    'current_break_started_at', session.current_break_started_at,
    'current_break_seconds', session.current_break_seconds
  ) as value
  from session_stats session
  where session.status <> 'clocked_out'
  order by session.clocked_in_at desc
  limit 1
),
history as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'work_date', days.work_date,
        'clocked_in_at', days.clocked_in_at,
        'clocked_out_at', days.clocked_out_at,
        'status', days.status,
        'worked_seconds', days.worked_seconds,
        'break_seconds', days.break_seconds,
        'target_seconds', days.target_seconds,
        'remaining_seconds', greatest(days.target_seconds - days.worked_seconds, 0::bigint),
        'overtime_seconds', greatest(days.worked_seconds - days.target_seconds, 0::bigint),
        'target_met', days.worked_seconds >= days.target_seconds
      ) order by days.work_date desc
    ),
    '[]'::jsonb
  ) as value
  from (
    select day.*
    from daily day
    cross join params
    where day.work_date <> params.local_date
    order by day.work_date desc
    limit greatest(1, least(coalesce(p_history_limit, 30), 365))
  ) days
)
select jsonb_build_object(
  'server_now', params.server_now,
  'timezone', p_timezone,
  'local_date', params.local_date,
  'is_weekday', extract(isodow from params.local_date) between 1 and 5,
  'active_session', (select value from active),
  'today', coalesce(
    (select value from today),
    jsonb_build_object(
      'work_date', params.local_date,
      'clocked_in_at', null,
      'clocked_out_at', null,
      'status', 'idle',
      'worked_seconds', 0,
      'break_seconds', 0,
      'target_seconds', 28800,
      'remaining_seconds', 28800,
      'overtime_seconds', 0,
      'target_met', false
    )
  ),
  'history', (select value from history)
)
from params;
$$;

-- RLS is intentionally not enabled yet, per the current single-user brief.
-- These explicit grants keep the RPCs working with Supabase's newer Data API defaults.
revoke all on table public.work_sessions, public.break_periods from anon, authenticated;
grant select, insert, update on table public.work_sessions, public.break_periods to anon, authenticated;

revoke execute on function public.time_tracker_clock_in(uuid, text) from public;
revoke execute on function public.time_tracker_start_break(uuid) from public;
revoke execute on function public.time_tracker_resume(uuid) from public;
revoke execute on function public.time_tracker_clock_out(uuid) from public;
revoke execute on function public.time_tracker_state(uuid, text, integer) from public;

grant execute on function public.time_tracker_clock_in(uuid, text) to anon, authenticated;
grant execute on function public.time_tracker_start_break(uuid) to anon, authenticated;
grant execute on function public.time_tracker_resume(uuid) to anon, authenticated;
grant execute on function public.time_tracker_clock_out(uuid) to anon, authenticated;
grant execute on function public.time_tracker_state(uuid, text, integer) to anon, authenticated;
