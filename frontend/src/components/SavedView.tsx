import { Star } from 'lucide-react';
import { SIGNAL_COLORS, sectorDeep } from '../lib/colors';
import { scoreTier } from '../lib/format';
import { SIGNAL_ICONS, sectorIcon } from '../lib/icons';
import { SIGNAL_LABELS, SIGNAL_TYPES, type DatasetName, type ScoredCompany } from '../types';
import { StarButton } from './StarButton';

interface Props {
  companies: ScoredCompany[];
  favoriteIds: string[];
  dataset: DatasetName;
  loading: boolean;
  onToggleFavorite: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onShowOnMap: (id: string) => void;
}

/** Startups the viewer starred, best score first. */
export function SavedView(props: Props) {
  const { companies, favoriteIds, dataset, loading, onToggleFavorite, onOpenDetail, onShowOnMap } = props;
  const saved = companies.filter((c) => favoriteIds.includes(c.id)).sort((a, b) => b.score - a.score);

  return (
    <section className="saved" aria-labelledby="saved-title">
      <div className="sectors-intro">
        <h2 className="page-title" id="saved-title">
          Saved startups
        </h2>
        <p className="muted">
          Saved in this browser. Showing {dataset === 'sample' ? 'sample' : 'live'} data; switch datasets in the header
          to see startups saved from the other one.
        </p>
      </div>

      {loading ? (
        <p className="muted">Loading saved startups…</p>
      ) : saved.length === 0 ? (
        <div className="card empty-card">
          <span className="empty-icon">
            <Star size={26} aria-hidden="true" />
          </span>
          <p className="empty-title">No saved startups yet</p>
          <p className="muted">Star a startup in the ranked list or its profile to keep it here.</p>
        </div>
      ) : (
        <ul className="saved-grid">
          {saved.map((c) => {
            const Icon = sectorIcon(c.sector);
            return (
              <li className="card saved-card" key={c.id}>
                <div className="saved-head">
                  <span className="sector-chip sector-chip--small" style={{ background: sectorDeep(c.sector) }}>
                    <Icon size={15} aria-hidden="true" />
                    {c.sector}
                  </span>
                  <StarButton active name={c.name} onToggle={() => onToggleFavorite(c.id)} />
                </div>
                <p className="saved-name">{c.name}</p>
                <p className="muted">
                  {c.city}, {c.county} County · Rank #{c.rank}
                </p>
                <div className="saved-score">
                  <span className={`score-pill score-pill--${scoreTier(c.score)}`}>{c.score.toFixed(0)}</span>
                  <span className="signal-icons" aria-label={SIGNAL_TYPES.filter((t) => c.signalScores[t] > 0).map((t) => SIGNAL_LABELS[t]).join(', ')}>
                    {SIGNAL_TYPES.filter((t) => c.signalScores[t] > 0).map((t) => {
                      const SignalIcon = SIGNAL_ICONS[t];
                      return <SignalIcon key={t} size={18} style={{ color: SIGNAL_COLORS[t] }} aria-hidden="true" />;
                    })}
                  </span>
                </div>
                <div className="saved-actions">
                  <button type="button" className="preset preset--primary" onClick={() => onOpenDetail(c.id)}>
                    Open company file
                  </button>
                  <button type="button" className="preset" onClick={() => onShowOnMap(c.id)}>
                    Show on map
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

