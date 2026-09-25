import { useEffect, useState } from 'react';
import { fetchCompany } from '../api';
import { SIGNAL_COLORS, sectorColor } from '../lib/colors';
import { SIGNAL_LABELS, SIGNAL_TYPES, type CompanyDetail, type Signal, type Weights } from '../types';

interface Props {
  id: string;
  weights: Weights;
  onClose: () => void;
}

function formatSignal(s: Signal): string {
  if (s.amount != null) return `$${s.amount.toLocaleString()}`;
  if (s.count != null) return `×${s.count}`;
  return '';
}

/** Who the company is, its score, and exactly which signals produced it — with source links. */
export function CompanyProfile({ id, weights, onClose }: Props) {
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCompany(id, weights)
      .then((c) => {
        if (!cancelled) {
          setCompany(c);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, weights]);

  return (
    <aside className="profile">
      <button className="close" onClick={onClose} aria-label="Close profile">
        ×
      </button>
      {error && <p className="error">{error}</p>}
      {!company && !error && <p className="muted">Loading…</p>}
      {company && (
        <>
          <h2>
            {company.name}
            {company.isSample && <span className="badge">sample</span>}
          </h2>

          <section>
            <h3>Identity</h3>
            <p>
              {company.address}, {company.city} ({company.county} County)
            </p>
            {company.website && (
              <p>
                <a href={company.website} target="_blank" rel="noreferrer">
                  {company.website}
                </a>
              </p>
            )}
            {company.foundedYear && <p>Founded {company.foundedYear}</p>}
          </section>

          <section>
            <h3>Sector</h3>
            <p>
              <span className="dot" style={{ background: sectorColor(company.sector) }} />
              {company.sector}
              {company.industryGroup && <span className="muted"> · {company.industryGroup}</span>}
            </p>
          </section>

          <section>
            <h3>AI Intelligence</h3>

            {company.ai ? (
              <>
              <p>{company.ai.summary}</p>

                {company.ai.momentumSummary && (
                <>
                <h4>Momentum</h4>
                <p>{company.ai.momentumSummary}</p>
                </>
              )}

            {company.ai.keySignals.length > 0 && (
            <>
              <h4>Key signals</h4>
              <ul>
                {company.ai.keySignals.map((signal, i) => (
                  <li key={i}>{signal}</li>
                ))}
              </ul>
            </>
          )}
        </>
        ) : (
          <p className="muted">AI analysis not yet generated for this company.</p>
          )}
          </section>

          <section>
            <h3>Score</h3>
            <p className="score">
              {company.score.toFixed(0)} <span className="muted">/ 100 · rank #{company.rank}</span>
            </p>
            <div className="stacked-bar">
              {SIGNAL_TYPES.filter((t) => company.contributions[t] > 0).map((t) => (
                <div
                  key={t}
                  style={{ width: `${company.contributions[t]}%`, background: SIGNAL_COLORS[t] }}
                  title={`${SIGNAL_LABELS[t]}: ${company.contributions[t].toFixed(1)} pts`}
                />
              ))}
            </div>
            <ul className="legend">
              {SIGNAL_TYPES.map((t) => (
                <li key={t}>
                  <span className="dot" style={{ background: SIGNAL_COLORS[t] }} />
                  {SIGNAL_LABELS[t]}: {company.contributions[t].toFixed(1)}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Signals &amp; sources</h3>
            <ul className="signals">
              {company.signals.map((s, i) => (
                <li key={i}>
                  <strong>{SIGNAL_LABELS[s.type]}</strong> {formatSignal(s)} — {s.description} ·{' '}
                  <span className="muted">{s.date}</span> ·{' '}
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                    {s.source}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </aside>
  );
}
