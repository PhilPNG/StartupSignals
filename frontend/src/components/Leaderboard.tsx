import { SIGNAL_COLORS, sectorColor } from '../lib/colors';
import { scoreTier } from '../lib/format';
import { SIGNAL_ICONS } from '../lib/icons';
import { SIGNAL_LABELS, SIGNAL_TYPES, type ScoredCompany } from '../types';
import { StarButton } from './StarButton';

function SignalIcons({ company }: { company: ScoredCompany }) {
  const present = SIGNAL_TYPES.filter((t) => company.signalScores[t] > 0);
  return (
    <span className="signal-icons" aria-label={present.map((t) => SIGNAL_LABELS[t]).join(', ')}>
      {present.map((t) => {
        const Icon = SIGNAL_ICONS[t];
        return <Icon key={t} size={18} style={{ color: SIGNAL_COLORS[t] }} aria-hidden="true" />;
      })}
    </span>
  );
}

interface Props {
  companies: ScoredCompany[];
  total: number;
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
}

export function Leaderboard(props: Props) {
  const { companies, total, loading, selectedId, onSelect, onClearFilters, isFavorite, onToggleFavorite } = props;
  return (
    <section className="card table-card" aria-labelledby="ranked-title">
      <div className="table-head">
        <h2 className="panel-title" id="ranked-title">
          Ranked startups
        </h2>
        {!loading && total > 0 && (
          <span className="muted">
            {companies.length === total ? `${total} startups` : `Showing ${companies.length} of ${total}`}
          </span>
        )}
      </div>

      {loading ? (
        <p className="table-note">Loading startups…</p>
      ) : companies.length === 0 ? (
        <div className="table-note">
          <p>No startups match these filters.</p>
          <button type="button" className="text-button" onClick={onClearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <table className="rank-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" className="col-star">
                <span className="sr-only">Saved</span>
              </th>
              <th scope="col">Name</th>
              <th scope="col" className="col-sector">
              Sector
            </th>
              <th scope="col" className="col-city">
                City
              </th>
              <th scope="col" className="col-county">
                County
              </th>
              <th scope="col" className="col-signals">
                Signals
              </th>
              <th scope="col" className="col-score">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr
                key={c.id}
                className={c.id === selectedId ? 'is-selected' : undefined}
                tabIndex={0}
                aria-label={`${c.name}, rank ${c.rank}, score ${c.score.toFixed(0)}`}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(c.id);
                  }
                }}
              >
                <td className="col-rank">{c.rank}</td>
                <td className="col-star">
                  <StarButton active={isFavorite(c.id)} name={c.name} onToggle={() => onToggleFavorite(c.id)} size={18} />
                </td>
                <td className="col-name">
                  <span className="dot name-dot" style={{ background: sectorColor(c.sector) }} />
                  {c.name}
                </td>
                <td className="col-sector">
                  <span className="dot" style={{ background: sectorColor(c.sector) }} />
                  {c.sector}
                </td>
                <td className="col-city">{c.city}</td>
                <td className="col-county">{c.county}</td>
                <td className="col-signals">
                  <SignalIcons company={c} />
                </td>
                <td className="col-score">
                  <span className={`score-pill score-pill--${scoreTier(c.score)}`}>{c.score.toFixed(0)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
