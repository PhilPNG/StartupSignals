# StartupSignals

Map and ranked list of New Jersey startups, scored 0–100 from public signals: funding, grants, hiring, IP and accelerator participation. Built for the 1435 Capital challenge ([ChallengeStatement.md](ChallengeStatement.md)).

## Layout

```
frontend/   React + Vite: Mapbox map, leaderboard, filters, weight sliders, profiles, sector view
backend/    Next.js (API routes only) + data pipeline
  data/sample-companies.json   labeled sample data served until the pipeline produces data/companies.json
  data/raw/                    raw downloads (gitignored)
  src/app/api/                 JSON endpoints
  src/lib/scoring.ts           Startup Score + sector score
  src/pipeline/                ingest → filter → match → geocode → cluster
```

## Getting started

```bash
npm install
cp frontend/.env.example frontend/.env.local   # add a Mapbox public token
cp backend/.env.example backend/.env.local     # add API keys as you get them
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` to the backend)
- Backend: http://localhost:3001

The map shows a placeholder until `VITE_MAPBOX_TOKEN` is set; everything else works on sample data.

## API

| Endpoint | Returns |
| --- | --- |
| `GET /api/health` | `{ ok: true }` |
| `GET /api/companies` | Ranked companies with per-signal scores |
| `GET /api/companies/:id` | One company plus its source signal records |
| `GET /api/sectors` | Sectors ranked by depth, breadth and growth |

All but `/health` accept weight overrides, e.g. `?funding=40&ip=25`. Missing weights use the defaults (30/20/20/15/10/5); weights are normalized to sum to 1.

## Pipeline

```bash
npm run pipeline
```

Runs `backend/src/pipeline/run.ts`. Source fetchers in `src/pipeline/sources/` are stubs with the endpoint and gotchas noted; fill them in one signal at a time. Scoring happens at request time so the weight sliders can re-rank live.

## Types

`frontend/src/types.ts` mirrors `backend/src/lib/types.ts`. Keep them in sync.
