-- Stage each source refresh before making any of its rows visible.
create table public.source_record_staging (
  run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  source text not null,
  external_id text not null,
  source_url text,
  event_date date,
  payload jsonb not null,
  primary key (run_id, source, external_id)
);
alter table public.source_record_staging enable row level security;
revoke all on public.source_record_staging from anon, authenticated;
grant select, insert, update, delete on public.source_record_staging to service_role;

create function public.commit_source_run(p_run_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_source text;
  staged_count integer;
begin
  select source into run_source from public.ingestion_runs
    where id = p_run_id and status = 'running' for update;
  if run_source is null then
    raise exception 'Source run does not exist or is not running';
  end if;
  select count(*) into staged_count from public.source_record_staging where run_id = p_run_id;
  if staged_count = 0 then
    raise exception 'Refusing to commit an empty source run';
  end if;
  if exists (select 1 from public.source_record_staging where run_id = p_run_id and source <> run_source) then
    raise exception 'Source mismatch in staging';
  end if;

  insert into public.source_records (source, external_id, source_url, event_date, observed_at, run_id, payload)
  select source, external_id, source_url, event_date, now(), run_id, payload
  from public.source_record_staging where run_id = p_run_id
  on conflict (source, external_id) do update set
    source_url = excluded.source_url, event_date = excluded.event_date,
    observed_at = excluded.observed_at, run_id = excluded.run_id,
    payload = excluded.payload;

  update public.ingestion_runs set status = 'success', completed_at = now(),
    rows_accepted = staged_count where id = p_run_id;
  delete from public.source_record_staging where run_id = p_run_id;
end;
$$;
revoke all on function public.commit_source_run(uuid) from public, anon, authenticated;
grant execute on function public.commit_source_run(uuid) to service_role;
