# Backend data integration plan

## Goal and current state

Deliver a repeatable pipeline that puts source-backed New Jersey startup records in the existing Supabase project, then serves the current leaderboard, profile, map, and sector API contracts from that data. Keep request-time scoring so weight sliders continue to work. Target a few hundred credible companies for the hackathon, with visible source links and refresh times. Sample companies may support a demo, but must remain labeled and separate from real results.

At planning time, the repo had Next.js API routes and TypeScript pipeline stages, but every source adapter and geocoding adapter was a stub. The implementation now uses the Supabase migrations and ingestion pipeline documented in [README.md](README.md). The planning gates below remain useful for later source expansion and quality review.

## Architecture

```text
Scheduled or manual pipeline command
  -> source adapters (SEC, SBIR, NIH, NSF, curated CSV, ATS)
  -> source_records in Supabase (provenance and source identifiers)
  -> validate NJ/startup eligibility and resolve company identity
  -> companies + signals in Supabase
  -> Next.js /api/companies, /api/companies/:id, /api/sectors
  -> existing frontend
```

Use the existing Next.js backend as the only public data interface. Run provider calls in the pipeline, never from a page request. Keep Supabase elevated credentials and provider keys server-side. Initially compute scores and sectors from the active company/signal snapshot in the backend; storing fixed `scores` and `sectors` rows would conflict with live weight overrides. Add cached score snapshots only if response time requires them.

## Supabase design

Create versioned SQL migrations in `supabase/migrations/` and a local environment example. Link the existing Supabase project during implementation; no project URL, reference, or credentials are present in this repo today.

| Table | Core columns and constraints | Purpose |
| --- | --- | --- |
| `ingestion_runs` | `id`, `source`, start/end timestamps, status, row counts, error summary | Per-source freshness, failures, and reproducibility |
| `source_records` | `source`, `external_id`, `source_url`, `observed_at`, `event_date`, `payload jsonb`, `run_id`; unique `(source, external_id)` | Retain exact source identifiers and evidence for replay and audit |
| `companies` | stable UUID, display and normalized names, city/state/address, county, website/domain, founded year, sector, nullable coordinates, sample flag, verification status | Canonical NJ company identity; indexes on normalized name/city and domain |
| `company_aliases` | company ID, alias, normalized alias, source, review status | Preserve approved matches and prevent repeated manual matching |
| `signals` | company ID, source record ID, type, event date, amount/count, subtype, description, source URL, last observed; unique source-event key | Dedupe traceable scoring events; index company/type/date |
| `match_review` | source record ID, candidate company ID, reason/confidence, status, reviewer/date | Hold ambiguous matches out of published scores |

Keep provider-specific values such as SEC accession/CIK, SBIR award ID, NIH application/project ID, NSF award ID, ATS posting ID, grant phase, and IP filing type in `source_records.payload` and normalized signal fields where scoring needs them. Preserve monetary units, dates, and the distinction between a funding filing and verified cash received. Use `NULL` for unknown founding year, county, and coordinates rather than `0` or invented values. An optional `dataset_versions`/publish pointer can make a complete refresh visible atomically; for the MVP, upsert source by source and keep the last successful records when one adapter fails.

Enable RLS on every table in an exposed schema and review grants separately. Keep raw records and review tables inaccessible to public roles. The Next.js server can use a server-only Supabase secret for ingestion and reads; if public read access is later required, expose only intentionally public fields through explicit grants and RLS policies. Do not put a secret in `NEXT_PUBLIC_*` or `VITE_*`. Current Supabase projects may not expose new tables through the Data API by default, so verify grants and Data API settings when wiring `supabase-js`.

## Delivery sequence

### 1. Establish the database and contract

- Confirm project reference, region, Data API settings, and how the pipeline will run (developer machine, CI, or hosted job). Add server-only `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to `backend/.env.example`; store real values outside Git.
- Add migrations, constraints/indexes, a server-only database module, and one seed/import path for the existing labeled sample data. Keep sample rows explicitly marked or in a separate demo dataset.
- Replace `loadDataset()` with a database-backed loader, preserving the existing `/api/companies`, `/api/companies/:id`, and `/api/sectors` response shapes and weight query parameters. Update the mirrored frontend/backend types and map rendering to handle nullable coordinates. Decide a bounded cache/refresh interval for the small MVP set. Return an explicit data-unavailable error if the real dataset is empty; use sample mode only when deliberately enabled.
- Add a health/data-status response with last successful refresh by source and record counts. Check read and denied-write behavior with the actual Supabase roles.

### 2. Produce the master company set

- Implement SEC Form D quarterly ZIP ingestion first. Use the current available quarters, including 2026 Q2, join issuer/offering data by filing identifier, filter NJ issuer addresses and pooled funds, retain accession/source URL, and distinguish amended filings so cumulative `total amount sold` is not counted twice. Form D is a signal of a reported securities offering, not proof of a venture round or total lifetime funding.
- Implement SBIR/STTR award and firm bulk import next. Filter NJ *firm* addresses, keep award ID, agency, phase, award date and amount. Use SEC issuers plus SBIR firms to seed canonical companies. Keep grants to universities and other nonstartup entities out of the master company set.
- Once the bulk path is stable, add a recent Form D filing adapter for the gap after the latest quarterly ZIP. Verify the EDGAR search query and retrieval flow against real results before depending on it; dedupe each filing against quarterly records by accession number.
- Normalize names and city, but match by strong identifiers first (CIK, UEI, website/domain, award/firm ID where available). Use exact normalized name plus city as a fallback. Send near matches to `match_review`; do not automatically merge common-name matches. Keep `company_aliases` for approved decisions.
- Apply eligibility at the company level after matching. Track why a company is excluded. Do not exclude an unknown founding year merely because it is missing. Clarify whether the $100M cutoff applies to one offering or aggregate funding before locking that rule.

### 3. Add independent signals

- Add NIH RePORTER and NSF award adapters with paging, date windows, stable award IDs, and source URLs. Filter to NJ recipient organizations, then attach only high-confidence matches to master companies. Reconcile SBIR records that also appear in NIH/NSF by award/project ID before scoring; an award must contribute once.
- Import small, reviewed CSVs for NJEDA support and accelerator participation. Require source URL, date, company identity, and a curator note. Put NJEDA in `support` unless it is a grant that has not already been counted under `grant`.
- Add hiring from known Greenhouse/Lever/Ashby boards for matched companies with verified career-page slugs. Store each open posting's stable ID and first/last seen dates, then derive a current open-role snapshot and technical-role share. Use Adzuna only as a secondary discovery source after checking its employer-match quality and quota; a text search hit is not proof that the company is hiring.
- Treat USPTO patents and trademarks as a separate adapter and scoring decision. Validate the specific patent and trademark datasets, organization/assignee matching, publication dates, access method, and key before implementation. If that cannot be completed for the hackathon, show IP as unavailable or explicitly labeled sample data; never silently award zero IP points to a company because the source failed.

### 4. Geocode, classify, and serve

- Geocode only verified NJ company addresses. Batch only records lacking usable coordinates; store match confidence and source. Confirm Mapbox permanent geocoding entitlement and cost before storing its results. Reject out-of-state/low-confidence geocodes; leave coordinates null and show those companies in the list without a pin.
- Keep sector assignment deterministic from Form D industry groups and SBIR abstracts, with a manual override field for reviewed mistakes. Preserve `Other` when evidence is weak.
- Adapt the current scoring code to subtype-aware rules after real data is inspected: SBIR phase, open-role technical share, recent IP, selective programs. Make source coverage explicit: a company with no event from a functioning source can receive zero for that signal, while a globally unavailable source is disabled and the effective weights are renormalized and disclosed. Record scoring version and source freshness in API metadata or documentation. Keep the frontend's six signal types and response contracts in sync.

### 5. Make refreshes safe and demo-ready

- Give each adapter its own timeout, retry/backoff, page cursor, rate limit, and run log. A failed source must not erase its previously published data. Use idempotent upserts keyed by provider IDs and explicit handling for removed job postings.
- Run a scheduled refresh only after the manual pipeline has succeeded twice. Choose cadence by source: quarterly SEC bulk, daily or weekly grants, a few-hour ATS snapshot if quotas permit, manual CSV on change. Keep public API traffic off providers.
- Audit the top 20 ranked companies against their linked source records, spot-check false NJ matches and entity merges, verify no duplicated grants/filings, and compare rankings under slider presets. Include counts of unmatched/ambiguous records and last-refresh times in the demo checklist.

## Priority and completion gates

| Priority | Deliverable | Done when |
| --- | --- | --- |
| P0 | Supabase schema and backend read path | Migrations reproduce the schema; real rows load through all existing endpoints; public roles cannot write; sample mode is visibly distinct |
| P0 | SEC + SBIR ingestion | Repeat runs are idempotent; source IDs/URLs and run times are stored; several verified NJ startups appear with traceable funding/grant signals |
| P1 | NIH/NSF + curated support/programs | Pagination and dedupe work; linked awards match companies; bad/ambiguous matches stay out of scores |
| P1 | Geocoding + quality review | Mapped pins have verified NJ coordinates; missing coordinates do not remove leaderboard rows; top 20 have reviewed source links |
| P2 | Recent Form D gap | New filings since the last ZIP are captured and accession-deduped against bulk records |
| P2 | Hiring and IP | Add only after adapter access, identity matching, and scoring semantics are checked; otherwise document source coverage clearly |

## Decisions and inputs needed before implementation

1. Supabase project reference/URL and a secure way to configure a server-only secret in the local and deployment environments. Do not paste the secret into a tracked file.
2. Demo date and target refresh frequency. These determine how much time to spend on recent Form D filings versus the quarterly bulk data.
3. Whether the $100M exclusion means a single Form D offering or total known fundraising, and how strictly to enforce the 10-year age rule when founding year is missing.
4. Whether the demo should show a smaller real-only dataset when IP/hiring coverage is incomplete, or a clearly separated sample overlay. The default recommendation is a real-only ranked list with missing-source coverage disclosed.

## Reference checks made September 25, 2026

- [SEC Form D datasets](https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets): 2026 Q2 is listed, so the pitch's “latest is Q1” note is stale.
- [SEC Regulation D statistics](https://www.sec.gov/data-research/statistics-data-visualizations/regulation-d-offerings): amended filings and reported amounts require careful interpretation.
- [SBIR data resources](https://www.sbir.gov/data-resources): downloadable award and company data are available; downloads and API fields differ.
- [NIH RePORTER API](https://api.reporter.nih.gov/): `org_states`, paging, and a maximum `limit` of 500 are documented.
- [NSF Awards API](https://resources.research.gov/common/webapi/awardapisearch-v1.htm): query fields and record access are documented.
- [Mapbox Geocoding v6](https://docs.mapbox.com/api/search/geocoding/): batch requests support 1,000 queries; permanent storage requires an eligible paid account/credit card or enterprise contract.
- [Supabase Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): review explicit grants, policies, and server-only secrets.
