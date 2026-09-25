import { useEffect, useMemo, useState } from 'react';
import { fetchCompanies, fetchHealth } from './api';
import { CompanyDetailView } from './components/CompanyDetailView';
import { CompanyProfile } from './components/CompanyProfile';
import { Filters } from './components/Filters';
import { Leaderboard } from './components/Leaderboard';
import { Logo } from './components/Logo';
import { MapView } from './components/MapView';
import { SavedView } from './components/SavedView';
import { SectorView } from './components/SectorView';
import { WeightSliders } from './components/WeightSliders';
import { useFavorites } from './lib/favorites';
import { applyFilters, EMPTY_FILTERS, type FilterState } from './lib/filters';
import { PRESETS } from './lib/weights';
import type { DatasetName, Health, ScoredCompany, Weights } from './types';

type View = 'map' | 'sectors' | 'saved';

const DATASETS: { id: DatasetName; label: string }[] = [
  { id: 'live', label: 'Live data' },
  { id: 'sample', label: 'Sample data' },
];

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

export default function App() {
  const [view, setView] = useState<View>('map');
  const [dataset, setDataset] = useState<DatasetName>('live');
  const [weights, setWeights] = useState<Weights>(PRESETS.default.weights);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [companies, setCompanies] = useState<ScoredCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const favorites = useFavorites();

  useEffect(() => {
    let cancelled = false;
    fetchCompanies(weights, dataset)
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
  }, [weights, dataset]);

  // Pipeline status for provenance in company files; optional, so failures are ignored.
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Close the innermost layer first: the company file, then the side profile.
      if (detailId) setDetailId(null);
      else setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [detailId]);

  const visible = useMemo(() => applyFilters(companies, filters), [companies, filters]);
  const sectors = useMemo(() => uniqueSorted(companies.map((c) => c.sector)), [companies]);
  const counties = useMemo(() => uniqueSorted(companies.map((c) => c.county)), [companies]);
  const savedCount = companies.filter((c) => favorites.isFavorite(c.id)).length;

  const switchDataset = (next: DatasetName) => {
    if (next === dataset) return;
    setDataset(next);
    setLoading(true);
    setCompanies([]);
    setSelectedId(null);
    setDetailId(null);
    setFilters(EMPTY_FILTERS);
  };

  /** The list sits below the map, so bring the map and profile back into view. */
  const selectFromList = (id: string) => {
    setSelectedId(id);
    if (window.scrollY > 0) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  const views: { id: View; label: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'sectors', label: 'Sectors' },
    { id: 'saved', label: savedCount ? `Saved (${savedCount})` : 'Saved' },
  ];

  return (
    <div className="app">
      {/* Everything but the company file; inert while it is open so focus can't leave the dialog. */}
      <div className="app-content" inert={Boolean(detailId)}>
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span>NJ Startup Signals</span>
        </div>
        <nav className="tabs" aria-label="View">
          {views.map((v) => (
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
        <div className="dataset-switch" role="group" aria-label="Dataset">
          {DATASETS.map((d) => (
            <button
              key={d.id}
              type="button"
              className="dataset-option"
              aria-pressed={dataset === d.id}
              onClick={() => switchDataset(d.id)}
            >
              <span className={d.id === 'live' ? 'status-dot status-dot--live' : 'status-dot'} aria-hidden="true" />
              {d.label}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <p className="banner" role="alert">
          {error}
        </p>
      )}

      {view === 'map' && (
        <main className="map-view">
          <div className={selectedId ? 'stage has-profile' : 'stage'}>
            <div className="column column-left">
              <WeightSliders weights={weights} onChange={setWeights} />
              <Filters filters={filters} onChange={setFilters} sectors={sectors} counties={counties} />
            </div>
            <section className="card map-card" aria-label="Map of startups">
              <MapView companies={visible} selectedId={selectedId} onSelect={setSelectedId} fitKey={dataset} />
            </section>
            {selectedId && (
              <aside className="column column-right">
                <CompanyProfile
                  id={selectedId}
                  weights={weights}
                  dataset={dataset}
                  isFavorite={favorites.isFavorite(selectedId)}
                  onToggleFavorite={() => favorites.toggle(selectedId)}
                  onOpenDetail={() => setDetailId(selectedId)}
                  onClose={() => setSelectedId(null)}
                />
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
            isFavorite={favorites.isFavorite}
            onToggleFavorite={favorites.toggle}
          />
        </main>
      )}

      {view === 'sectors' && (
        <main className="workspace workspace-sectors">
          <div className="column column-left">
            <WeightSliders weights={weights} onChange={setWeights} />
          </div>
          <SectorView key={dataset} weights={weights} dataset={dataset} />
        </main>
      )}

      {view === 'saved' && (
        <main className="workspace workspace-saved">
          <SavedView
            companies={companies}
            favoriteIds={favorites.ids}
            dataset={dataset}
            loading={loading}
            onToggleFavorite={favorites.toggle}
            onOpenDetail={setDetailId}
            onShowOnMap={(id) => {
              setView('map');
              setSelectedId(id);
            }}
          />
        </main>
      )}
      </div>

      {detailId && (
        <CompanyDetailView
          id={detailId}
          weights={weights}
          dataset={dataset}
          companies={companies}
          health={dataset === 'live' ? health : null}
          isFavorite={favorites.isFavorite(detailId)}
          onToggleFavorite={() => favorites.toggle(detailId)}
          onOpen={setDetailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
