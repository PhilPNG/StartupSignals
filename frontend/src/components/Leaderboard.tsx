import { sectorColor } from '../lib/colors';
import { scoreTier } from '../lib/format';
import type { ScoredCompany } from '../types';

interface Props {
  companies: ScoredCompany[];
  total: number;
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClearFilters: () => void;
}

export function Leaderboard({ companies, total, loading, selectedId, onSelect, onClearFilters }: Props) {
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
        <div className="table-scroll">
          <table className="rank-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Sector</th>
                <th scope="col" className="col-city">
                  City
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
                  <td className="col-name">{c.name}</td>
                  <td>
                    <span className="dot" style={{ background: sectorColor(c.sector) }} />
                    {c.sector}
                  </td>
                  <td className="col-city">{c.city}</td>
                  <td className="col-score">
                    <span className={`score-pill score-pill--${scoreTier(c.score)}`}>{c.score.toFixed(0)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
