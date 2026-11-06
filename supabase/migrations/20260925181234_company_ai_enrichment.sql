-- LLM summary reports, written offline by `npm run enrich -w backend` and read by
-- the company detail API. Server-only, like the rest of the data spine. `if not
-- exists` in case the table was already created by hand for the first test run.
create table if not exists public.company_ai_enrichment (
  company_id uuid primary key references public.companies(id) on delete cascade,
  summary text not null,
  momentum_summary text not null,
  key_signals jsonb not null default '[]'::jsonb,
  evidence_sources jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

alter table public.company_ai_enrichment enable row level security;

revoke all on public.company_ai_enrichment from anon, authenticated;
grant select, insert, update, delete on public.company_ai_enrichment to service_role;
