import { useEffect, useState } from 'react';
import { fetchSectors } from '../api';
import { sectorColor } from '../lib/colors';
import { sectorIcon } from '../lib/icons';
import type { DatasetName, Sector, Weights } from '../types';

interface Props {
  weights: Weights;
  dataset: DatasetName;
}

function formatGrowth(growth: number): string {
  const pct = Math.round(growth * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

/** Sectors ranked by depth, breadth and year-over-year growth. */
export function SectorView({ weights, dataset }: Props) {
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSectors(weights, dataset)
      .then((s) => {
        if (!cancelled) {
          setSectors(s);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(`Couldn't load sectors. ${e}`);
      });
    return () => {
      cancelled = true;
    };
  }, [weights, dataset]);

  return (
    <section className="sectors" aria-labelledby="sectors-title">
      <div className="sectors-intro">
        <h2 className="page-title" id="sectors-title">
          Sectors
        </h2>
        <p className="muted">
          Depth adds up the scores of each sector's top five startups. Breadth counts startups with two or more
          signal types. Growth compares signal activity in the last 12 months with the 12 before.
        </p>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!sectors && !error && <p className="muted">Loading sectors…</p>}

      <ol className="sector-grid">
        {sectors?.map((s, i) => {
          const Icon = sectorIcon(s.sector);
          const color = sectorColor(s.sector);
          return (
            <li className="card sector-card" key={s.sector}>
              <div className="sector-head">
                <span className="sector-icon" style={{ color, background: `${color}1f` }}>
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span>
                  <span className="sector-name">{s.sector}</span>
                  <span className="muted">
                    {s.companies} {s.companies === 1 ? 'startup' : 'startups'}
                  </span>
                </span>
                <span className="rank-pill rank-pill--small">#{i + 1}</span>
              </div>
              <p className="sector-score">
                {s.sectorScore.toFixed(0)}
                <span className="score-max"> / 100</span>
              </p>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${s.sectorScore}%`, background: color }} />
              </div>
              <dl className="sector-stats">
                <div>
                  <dt>Depth</dt>
                  <dd>{s.depth.toFixed(0)}</dd>
                </div>
                <div>
                  <dt>Breadth</dt>
                  <dd>{s.breadth}</dd>
                </div>
                <div>
                  <dt>Growth</dt>
                  <dd className={s.growth < 0 ? 'is-negative' : s.growth > 0 ? 'is-positive' : undefined}>
                    {formatGrowth(s.growth)}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
