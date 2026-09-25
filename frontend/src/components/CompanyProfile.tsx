import { useEffect, useState } from 'react';
import { ExternalLink, MapPin, MousePointerClick, X } from 'lucide-react';
import { fetchCompany } from '../api';
import { SIGNAL_COLORS, sectorDeep } from '../lib/colors';
import { formatDate, formatUsd } from '../lib/format';
import { SIGNAL_ICONS, sectorIcon } from '../lib/icons';
import { SIGNAL_LABELS, SIGNAL_TYPES, type CompanyDetail, type Signal, type Weights } from '../types';

interface Props {
  id: string;
  weights: Weights;
  onClose: () => void;
}

function signalDetail(s: Signal): string {
  return [s.amount != null ? formatUsd(s.amount) : null, s.description].filter(Boolean).join(' · ');
}

/** Shown in the profile column before a startup is picked. */
export function ProfileEmpty() {
  return (
    <section className="card profile profile--empty">
      <span className="empty-icon">
        <MousePointerClick size={26} aria-hidden="true" />
      </span>
      <h2 className="empty-title">Pick a startup</h2>
      <p className="muted">Select a pin on the map or a row in the list to see its score and the signals behind it.</p>
    </section>
  );
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
        if (!cancelled) setError(`Couldn't load this startup. ${e}`);
      });
    return () => {
      cancelled = true;
    };
  }, [id, weights]);

  const SectorIcon = company ? sectorIcon(company.sector) : null;
  const contributing = company ? SIGNAL_TYPES.filter((t) => company.contributions[t] > 0) : [];

  return (
    <section className="card profile" aria-label="Startup profile">
      <button type="button" className="icon-button profile-close" onClick={onClose} aria-label="Close profile">
        <X size={20} aria-hidden="true" />
      </button>

      {error && <p className="error-text">{error}</p>}
      {!company && !error && <p className="muted">Loading…</p>}

      {company && SectorIcon && (
        <div className="profile-body" key={company.id}>
          <h2 className="profile-name">{company.name}</h2>
          <p className="profile-location">
            <MapPin size={20} aria-hidden="true" />
            {company.city}, {company.county} County
          </p>
          <div className="profile-meta">
            <span className="sector-chip" style={{ background: sectorDeep(company.sector) }}>
              <SectorIcon size={18} aria-hidden="true" />
              {company.sector}
            </span>
            {company.foundedYear && <span className="muted-strong">Founded {company.foundedYear}</span>}
            {company.isSample && <span className="sample-tag">Sample record</span>}
          </div>
          {(company.industryGroup || company.website) && (
            <p className="profile-extra">
              {company.industryGroup}
              {company.industryGroup && company.website && ' · '}
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer">
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </p>
          )}

          <div className="score-row">
            <p className="score">
              {company.score.toFixed(0)}
              <span className="score-max"> / 100</span>
            </p>
            <span className="rank-pill">Rank #{company.rank}</span>
          </div>

          <h3 className="section-title">Signal contributions</h3>
          <div
            className="contrib-bar"
            role="img"
            aria-label={contributing.map((t) => `${SIGNAL_LABELS[t]} ${company.contributions[t].toFixed(1)}`).join(', ')}
          >
            {contributing.map((t) => (
              <span
                key={t}
                style={{ width: `${company.contributions[t]}%`, background: SIGNAL_COLORS[t] }}
                title={`${SIGNAL_LABELS[t]}: ${company.contributions[t].toFixed(1)} points`}
              />
            ))}
          </div>
          {contributing.length === 0 ? (
            <p className="muted">No signals yet.</p>
          ) : (
            <ul className="contrib-legend">
              {contributing.map((t) => {
                const Icon = SIGNAL_ICONS[t];
                return (
                  <li key={t}>
                    <Icon size={22} style={{ color: SIGNAL_COLORS[t] }} aria-hidden="true" />
                    <span>
                      <span className="legend-label">{SIGNAL_LABELS[t]}</span>
                      <span className="legend-value">{company.contributions[t].toFixed(1)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="section-title">Signals &amp; sources</h3>
          <ul className="source-list">
            {company.signals.map((s, i) => {
              const Icon = SIGNAL_ICONS[s.type];
              return (
                <li key={i}>
                  <a className="source" href={s.sourceUrl} target="_blank" rel="noreferrer">
                    <Icon className="source-icon" size={28} style={{ color: SIGNAL_COLORS[s.type] }} aria-hidden="true" />
                    <span className="source-text">
                      <span className="source-title">{SIGNAL_LABELS[s.type]}</span>
                      <span className="source-detail">{signalDetail(s)}</span>
                      <span className="source-meta">
                        {s.source} · {formatDate(s.date)}
                      </span>
                    </span>
                    <ExternalLink className="source-link" size={18} aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
