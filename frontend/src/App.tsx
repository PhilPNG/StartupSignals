import { useEffect, useMemo, useState } from 'react';
import { fetchCompanies } from './api';
import { CompanyProfile } from './components/CompanyProfile';
import { Filters } from './components/Filters';
import { Leaderboard } from './components/Leaderboard';
import { MapView } from './components/MapView';
import { SectorView } from './components/SectorView';
import { WeightSliders } from './components/WeightSliders';
import { applyFilters, EMPTY_FILTERS, type FilterState } from './lib/filters';
import { PRESETS } from './lib/weights';
import type { ScoredCompany, Weights } from './types';

type View = 'map' | 'sectors';

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

export default function App() {
  const [view, setView] = useState<View>('map');
  const [weights, setWeights] = useState<Weights>(PRESETS.default.weights);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [companies, setCompanies] = useState<ScoredCompany[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCompanies(weights)
      .then((data) => {
        if (!cancelled) {
          setCompanies(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(`Could not load companies — is the backend running? ${e}`);
      });
    return () => {
      cancelled = true;
    };
  }, [weights]);

  const visible = useMemo(() => applyFilters(companies, filters), [companies, filters]);
  const sectors = useMemo(() => uniqueSorted(companies.map((c) => c.sector)), [companies]);
  const counties = useMemo(() => uniqueSorted(companies.map((c) => c.county)), [companies]);
  const hasSample = companies.some((c) => c.isSample);

  return (
    <div className="app">
      <header>
        <h1>NJ Startup Signals</h1>
        <nav>
          <button className={view === 'map' ? 'active' : undefined} onClick={() => setView('map')}>
            Map
          </button>
          <button className={view === 'sectors' ? 'active' : undefined} onClick={() => setView('sectors')}>
            Sectors
          </button>
        </nav>
        {hasSample && <span className="badge">Includes sample data</span>}
      </header>

      {error && <p className="error banner">{error}</p>}

      {view === 'map' ? (
        <main className={selectedId ? 'with-profile' : undefined}>
          <aside className="sidebar">
            <WeightSliders weights={weights} onChange={setWeights} />
            <Filters filters={filters} onChange={setFilters} sectors={sectors} counties={counties} />
            <Leaderboard companies={visible} selectedId={selectedId} onSelect={setSelectedId} />
          </aside>
          <MapView companies={visible} selectedId={selectedId} onSelect={setSelectedId} />
          {selectedId && <CompanyProfile id={selectedId} weights={weights} onClose={() => setSelectedId(null)} />}
        </main>
      ) : (
        <SectorView weights={weights} />
      )}
    </div>
  );
}
