# StartupSignals

A map and ranked list of New Jersey startups for the [1435 Capital challenge](ChallengeStatement.md). The Next.js backend ingests public signals into Supabase; the React frontend uses its JSON API. See [BACKEND_DATA_PLAN.md](BACKEND_DATA_PLAN.md) for source priorities and data-quality decisions.

## Local setup

Use Node 22 or newer. The Supabase and Vite packages require it.

```bash
npm install
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
npm run dev
```

Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `backend/.env.local`. Keep the secret server-side and out of Git. The existing Startup Signals Supabase project has the SQL files in `supabase/migrations/` applied. For a new project, apply those migrations in order before running the pipeline. Add `VITE_MAPBOX_TOKEN` to `frontend/.env.local` to show the map. The frontend runs on port 5173 and proxies `/api` to the backend on port 3001.

If the Supabase project is unavailable, set `DEMO_SAMPLE_MODE=true` in the backend environment to serve the labeled local sample file. Real mode returns a 503 when no published companies are available; it does not silently switch to sample data.

## Data ingestion

```bash
npm run pipeline
```

Run from the repo root. The command logs a separate `ingestion_runs` row for each source, upserts source evidence by provider ID, resolves companies, geocodes verified NJ addresses, and atomically publishes companies and signals. A missing or failed source leaves its last successful records in place. `PIPELINE_SOURCES=nih,nsf npm run pipeline` limits a run to named sources; existing successful records from other sources remain in the published set.

| Source | Input | Current behavior |
| --- | --- | --- |
| SEC Form D | Official quarterly `*_d.zip` files in `backend/data/raw/` | Joins the primary issuer, submission, and offering tables; keeps the latest amendment per offering and requires a positive amount sold; the SEC may block automated downloads, so obtain ZIPs from its [dataset page](https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets) |
| SBIR/STTR | Official bulk award CSV/JSON named `sbir-awards.csv` or `.json` in `backend/data/raw/` | Streams recent NJ awards, retains Phase I and II separately, and seeds the company set; [download page](https://www.sbir.gov/data-resources) |
| NIH RePORTER | Public API | Fetches recent NJ R43/R44/U44 small-business awards and can seed companies |
| NSF Awards | Public API | Fetches recent NJ awards and attaches only high-confidence matches to existing companies |
| NJEDA and accelerators | Reviewed CSVs in `backend/data/raw/` | Use the headers in `backend/data/templates/`; every row needs a source URL |
| Greenhouse, Lever, Ashby | Verified board slugs in `backend/data/raw/ats-boards.csv` | Captures a current open-role count and technical-role share; verify the company career-page link first |
| Adzuna, USPTO, recent SEC search | Access and matching need verification | Logged as skipped so unverified results cannot change scores |

The source downloads under `backend/data/raw/` are ignored by Git. Do not commit downloaded files or API secrets. The pipeline stores public evidence and compact, relevant provider fields in Supabase. Ambiguous same-name/different-city matches go to `match_review`; they do not affect scores until reviewed.

Form D amounts are issuer-reported securities sold for an offering. They are useful as filing evidence, but do not establish a verified venture round or a company's lifetime funding.

Geocoding uses Mapbox only when `MAPBOX_TOKEN` and `MAPBOX_PERMANENT_GEOCODING_CONFIRMED=true` are set. The public Census batch geocoder supplies exact NJ matches when Mapbox permanent storage is not configured. Companies without verified coordinates remain in the leaderboard and profiles, without a map pin.

### Summary reports

```bash
npm run enrich -w backend -- --all
```

This writes an AI summary report for each published company to `company_ai_enrichment`. Before the first run, apply `supabase/migrations/20260925181234_company_ai_enrichment.sql` and set `OPENAI_API_KEY` in `backend/.env.local`. The job sends only a company's published signals to OpenAI and supplies the totals, so the model doesn't calculate them. The prompt forbids investment advice. Without `--all`, the job summarizes the next 5 companies that lack a report. `--limit N` sets a different batch size, `--force` regenerates existing reports, and `--dry-run` prints the evidence without calling OpenAI. The company API returns the stored report as `ai` (or `null`), and the profile card shows it as "Summary report". Page requests never call OpenAI.

## API and scoring

| Endpoint | Response |
| --- | --- |
| `GET /api/health` | Real/sample mode, company count, active signal types, latest source run status |
| `GET /api/companies` | Ranked companies with per-signal scores and contributions |
| `GET /api/companies/:id` | One company and its linked source signals |
| `GET /api/sectors` | Sector depth, breadth, growth, and score |

The company and sector endpoints accept weight overrides such as `?funding=40&ip=25`. Missing weights use defaults (30/20/20/15/10/5). Scoring runs against the complete NJ company set on each request, then normalizes weights over signals that have data. A globally unavailable signal is excluded from the effective weights; a company with no event from an available source receives zero for that signal. `/api/health` and the `X-Active-Signals` response header expose current source coverage.

`frontend/src/types.ts` mirrors `backend/src/lib/types.ts`. Keep both in sync when changing the API contract. Coordinates can be null; the frontend map omits those companies from its GeoJSON layer.

## Current source coverage

As of September 25, 2026, the connected Supabase project contains 247 real companies and 632 matched signals: 55 SEC Form D funding filings, 522 SBIR awards, 45 NIH awards, and 10 NSF awards. Census geocoded 183 company addresses and assigned their counties. Hiring, IP, NJEDA, and accelerator data require verified board slugs, provider access, or reviewed input files before they appear in rankings. These counts will change on refresh; use `/api/health` for the current source status.
