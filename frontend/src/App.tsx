import { useEffect, useMemo, useState } from 'react';
import { ChartColumn } from 'lucide-react';
import { fetchCompanies } from './api';
import { CompanyProfile } from './components/CompanyProfile';
import { Filters } from './components/Filters';
import { Leaderboard } from './components/Leaderboard';
import { Logo } from './components/Logo';
import { MapView } from './components/MapView';
import { SectorView } from './components/SectorView';
import { WeightSliders } from './components/WeightSliders';
import { applyFilters, EMPTY_FILTERS, type FilterState } from './lib/filters';
import { PRESETS } from './lib/weights';
import type { ScoredCompany, Weights } from './types';

type View = 'map' | 'sectors';

const VIEWS: { id: View; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'sectors', label: 'Sectors' },
];

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

export default function App() {
  const [view, setView] = useState<View>('map');
  const [weights, setWeights] = useState<Weights>(PRESETS.default.weights);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [companies, setCompanies] = useState<ScoredCompany[]>([]);
  const [loading, setLoading] = useState(true);
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
        if (!cancelled) setError(`Couldn't load startups. Check that the API is running, then reload. (${e})`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weights]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visible = useMemo(() => applyFilters(companies, filters), [companies, filters]);
  const sectors = useMemo(() => uniqueSorted(companies.map((c) => c.sector)), [companies]);
  const counties = useMemo(() => uniqueSorted(companies.map((c) => c.county)), [companies]);
  const hasSample = companies.some((c) => c.isSample);

  /** The list sits below the map, so bring the map and profile back into view. */
  const selectFromList = (id: string) => {
    setSelectedId(id);
    if (window.scrollY > 0) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span>NJ Startup Signals</span>
        </div>
        <nav className="tabs" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className="tab"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
        {hasSample && (
          <span className="sample-chip">
            <ChartColumn size={16} aria-hidden="true" />
            Includes sample data
          </span>
        )}
      </header>

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}

      {view === 'map' ? (
        <main className="map-view">
          <div className={selectedId ? 'stage has-profile' : 'stage'}>
            <div className="column column-left">
              <WeightSliders weights={weights} onChange={setWeights} />
              <Filters filters={filters} onChange={setFilters} sectors={sectors} counties={counties} />
            </div>
            <section className="card map-card" aria-label="Map of startups">
              <MapView companies={visible} selectedId={selectedId} onSelect={setSelectedId} />
            </section>
            {selectedId && (
              <aside className="column column-right">
                <CompanyProfile id={selectedId} weights={weights} onClose={() => setSelectedId(null)} />
              </aside>
            )}
          </div>
          <Leaderboard
            companies={visible}
            total={companies.length}
            loading={loading}
            selectedId={selectedId}
            onSelect={selectFromList}
            onClearFilters={() => setFilters(EMPTY_FILTERS)}
          />
        </main>
      ) : (
        <main className="workspace workspace-sectors">
          <div className="column column-left">
            <WeightSliders weights={weights} onChange={setWeights} />
          </div>
          <SectorView weights={weights} />
        </main>
      )}
    </div>
  );
}
