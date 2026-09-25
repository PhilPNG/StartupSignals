# NJ Startup Signals

NJ Startup Signals is a hackathon project for exploring New Jersey startups through public evidence of momentum. It brings funding activity, research awards, patent records, and other available ecosystem signals into an interactive map, ranked list, and sector view. The project was built for the [1435 Capital challenge](ChallengeStatement.md).

Run the project at: https://startup-signals.vercel.app

## What the app does

- Explore startups on a map and in a ranked list, with filters for sector, county, score, and signal type.
- Change the relative weights of signals and see how company and sector rankings respond.
- Open a company file to review its activity, score breakdown, source links, and available AI-generated summary.
- Save companies in the browser and switch between live and labeled sample data.

## Stack and data

The frontend is built with React, Vite, and Mapbox. A Next.js backend serves the API and reads published company and signal records from Supabase. A separate pipeline imports and links source records; AI summaries are generated separately and stored for the app to display.

| Data source                         | Signal represented                               |
| ----------------------------------- | ------------------------------------------------ |
| SEC Form D                          | Reported securities offerings                    |
| SBIR/STTR, NIH RePORTER, NSF Awards | Research and small-business grants               |
| USPTO Patent File Wrapper           | Published patent applications and issued patents |

Source coverage varies by company.

## Run locally

```bash
npm install
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local
npm run dev
```

For live data, set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `backend/.env.local` and apply the SQL migrations in `supabase/migrations/` to the project. Set `VITE_MAPBOX_TOKEN` in `frontend/.env.local` to display the map. Keep server-side keys out of Git. The in-app Sample data option can be used without a live database.

## Data jobs

Run `npm run pipeline` from the repository root to refresh configured sources. Bulk Form D and SBIR downloads go in `backend/data/raw/`; CSV formats for other sources are in `backend/data/templates/`, and optional API keys are listed in `backend/.env.example`. The pipeline records refresh status in Supabase; sources without the needed input are skipped.

With `OPENAI_API_KEY` configured, `npm run enrich -w backend -- --all` generates summary reports for published companies. The app reads stored reports through the API.

## API

| Endpoint                 | Returns                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `GET /api/health`        | Data availability and source refresh status                |
| `GET /api/companies`     | Ranked companies and signal scores                         |
| `GET /api/companies/:id` | One company, its source records, and its available summary |
| `GET /api/sectors`       | Sector rankings and activity measures                      |

Company and sector requests accept signal weight query parameters, such as `?funding=40&ip=25`. Run `npm run build` to build both workspaces.
