import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe, MapPin, X } from 'lucide-react';
import { fetchCompany } from '../api';
import { SIGNAL_COLORS, sectorColor, sectorDeep } from '../lib/colors';
import { formatDate, formatUsd, scoreTier } from '../lib/format';
import { SIGNAL_ICONS, sectorIcon } from '../lib/icons';
import {
  monthsBetween,
  monthsSince,
  quarterOf,
  recentQuarters,
  SIGNAL_DESCRIPTIONS,
  sourceInfo,
  sumAmounts,
} from '../lib/signals';
import {
  SIGNAL_LABELS,
  SIGNAL_TYPES,
  type CompanyDetail,
  type DatasetName,
  type Health,
  type ScoredCompany,
  type Weights,
} from '../types';
import { StarButton } from './StarButton';

interface Props {
  id: string;
  weights: Weights;
  dataset: DatasetName;
  /** The full scored set, for overall and sector standing and peers. */
  companies: ScoredCompany[];
  health: Health | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}

const QUARTERS_SHOWN = 8;

function ago(months: number): string {
  if (months < 1) return 'this month';
  if (months < 24) return `${months} mo ago`;
  return `${Math.round(months / 12)} yr ago`;
}

/** Full-screen company file: the numbers a VC checks first, the score math, history and provenance. */
export function CompanyDetailView(props: Props) {
  const { id, weights, dataset, companies, health, isFavorite, onToggleFavorite, onOpen, onClose } = props;
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setCompany(null);
    fetchCompany(id, weights, dataset)
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
  }, [id, weights, dataset]);

  // Lock page scroll while open; restore focus to where it was if that element still exists.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add('has-dialog');
    return () => {
      document.body.classList.remove('has-dialog');
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  // Opening a file (or a peer's) re-renders the body, so put focus back on a stable control.
  useEffect(() => {
    closeRef.current?.focus();
  }, [id]);

  const now = useMemo(() => new Date(), []);
  const facts = useMemo(() => {
    if (!company) return null;
    const byDate = [...company.signals].sort((a, b) => b.date.localeCompare(a.date));
    const funding = byDate.filter((s) => s.type === 'funding');
    const grants = byDate.filter((s) => s.type === 'grant');
    const last12 = byDate.filter((s) => monthsSince(s.date, now) <= 12).length;
    const prior12 = byDate.filter((s) => {
      const m = monthsSince(s.date, now);
      return m > 12 && m <= 24;
    }).length;

    const quarters = recentQuarters(now, QUARTERS_SHOWN).map((q) => {
      const events = byDate.filter((s) => quarterOf(s.date) === q);
      return { quarter: q, count: events.length, amount: sumAmounts(events) };
    });

    const peers = companies.filter((c) => c.sector === company.sector).sort((a, b) => b.score - a.score);
    const sources = [...new Set(byDate.map((s) => sourceInfo(s.source).name))].map((name) => {
      const records = byDate.filter((s) => sourceInfo(s.source).name === name);
      const run = health?.sources
        ?.filter((r) => sourceInfo(r.source).name === name)
        .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
      return { info: sourceInfo(records[0].source), records: records.length, latest: records[0].date, run };
    });
    // Mirror the backend: weight is shared only among signal types that have data anywhere in the set.
    const available = new Set(SIGNAL_TYPES.filter((t) => companies.some((c) => c.signalScores[t] > 0)));
    const totalWeight =
      SIGNAL_TYPES.reduce((sum, t) => sum + (available.has(t) ? Math.max(0, weights[t]) : 0), 0) || 1;

    return {
      byDate,
      funding,
      grants,
      totalRaised: sumAmounts(funding),
      nonDilutive: sumAmounts(grants),
      last12,
      prior12,
      quarters,
      maxQuarter: Math.max(1, ...quarters.map((q) => q.count)),
      peers,
      sectorRank: peers.findIndex((c) => c.id === company.id) + 1,
      sources,
      available,
      weightPct: (t: (typeof SIGNAL_TYPES)[number]) =>
        available.has(t) ? Math.round((Math.max(0, weights[t]) / totalWeight) * 100) : 0,
    };
  }, [company, companies, health, now, weights]);

  const SectorIcon = company ? sectorIcon(company.sector) : null;

  return (
    <div
      className="dialog-backdrop"
      // Close only on a click that starts and ends on the backdrop, not after selecting text in the file.
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={company ? `${company.name} company file` : 'Company file'}
      >
        <div className="dialog-bar">
          <span className="eyebrow">Company file</span>
          {company && <StarButton active={isFavorite} name={company.name} onToggle={onToggleFavorite} size={22} />}
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close company file">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}
        {!company && !error && <p className="muted">Loading company file…</p>}

        {company && facts && SectorIcon && (
          <div className="detail" key={company.id}>
            <header className="detail-head">
              <h2 className="detail-name">
                {company.name}
              </h2>
              <div className="profile-meta">
                <span className="sector-chip" style={{ background: sectorDeep(company.sector) }}>
                  <SectorIcon size={18} aria-hidden="true" />
                  {company.sector}
                </span>
                <span className="muted-strong detail-inline">
                  <MapPin size={16} aria-hidden="true" />
                  {company.city}, {company.county} County
                </span>
                {company.foundedYear && (
                  <span className="muted-strong">
                    Founded {company.foundedYear} ({now.getFullYear() - company.foundedYear} yrs)
                  </span>
                )}
                {company.website && (
                  <a className="detail-inline" href={company.website} target="_blank" rel="noreferrer">
                    <Globe size={16} aria-hidden="true" />
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <span className={dataset === 'sample' ? 'sample-tag' : 'live-tag'}>
                  {dataset === 'sample' ? 'Sample record' : 'Live data'}
                </span>
              </div>
              {company.industryGroup && <p className="profile-extra">Industry group: {company.industryGroup}</p>}
            </header>

            <div className="detail-top">
              <section className="detail-card detail-score" aria-label="Startup Score">
                <p className="score">
                  {company.score.toFixed(0)}
                  <span className="score-max"> / 100</span>
                </p>
                <p className="muted-strong">
                  Rank #{company.rank} of {companies.length} in NJ · top{' '}
                  {Math.max(1, Math.ceil((company.rank / Math.max(1, companies.length)) * 100))}%
                </p>
                <p className="muted-strong">
                  #{facts.sectorRank} of {facts.peers.length} in {company.sector}
                </p>
              </section>
              <dl className="stat-grid">
                <div className="detail-card">
                  <dt>Total raised</dt>
                  <dd>{facts.totalRaised ? formatUsd(facts.totalRaised) : '—'}</dd>
                  <span className="muted">
                    {facts.funding.length} {facts.funding.length === 1 ? 'round' : 'rounds'} on file
                  </span>
                </div>
                <div className="detail-card">
                  <dt>Last raise</dt>
                  <dd>{facts.funding[0] ? formatDate(facts.funding[0].date) : '—'}</dd>
                  <span className="muted">
                    {facts.funding[0]
                      ? `${quarterOf(facts.funding[0].date)} · ${ago(monthsBetween(facts.funding[0].date, now))}`
                      : 'No Form D filing found'}
                  </span>
                </div>
                <div className="detail-card">
                  <dt>Non-dilutive funding</dt>
                  <dd>{facts.nonDilutive ? formatUsd(facts.nonDilutive) : '—'}</dd>
                  <span className="muted">
                    {facts.grants.length} {facts.grants.length === 1 ? 'grant' : 'grants'} (SBIR, NIH, NSF, NJEDA)
                  </span>
                </div>
                <div className="detail-card">
                  <dt>Momentum</dt>
                  <dd>
                    {facts.last12} {facts.last12 === 1 ? 'signal' : 'signals'}
                  </dd>
                  <span className="muted">last 12 months, vs {facts.prior12} the year before</span>
                </div>
              </dl>
            </div>

            <section className="detail-section">
              <h3 className="section-title">Score breakdown</h3>
              <p className="muted detail-note">
                Each signal is ranked against every NJ startup in the set (percentile), multiplied by its weight, then
                boosted 10% for each extra signal type. Events count half as much every 12 months.
              </p>
              <table className="detail-table">
                <thead>
                  <tr>
                    <th scope="col">Signal</th>
                    <th scope="col" className="num">
                      Weight
                    </th>
                    <th scope="col" className="num">
                      NJ percentile
                    </th>
                    <th scope="col">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {SIGNAL_TYPES.map((t) => {
                    const Icon = SIGNAL_ICONS[t];
                    const has = company.signalScores[t] > 0;
                    return (
                      <tr key={t}>
                        <th scope="row">
                          <span className="detail-inline" title={SIGNAL_DESCRIPTIONS[t]}>
                            <Icon size={18} style={{ color: SIGNAL_COLORS[t] }} aria-hidden="true" />
                            {SIGNAL_LABELS[t]}
                          </span>
                        </th>
                        <td className="num">{facts.weightPct(t)}%</td>
                        <td className="num">
                          {has ? company.signalScores[t].toFixed(0) : facts.available.has(t) ? 'None found' : 'Not tracked yet'}
                        </td>
                        <td>
                          <span className="points">
                            <span className="meter meter--inline" aria-hidden="true">
                              <span style={{ width: `${company.contributions[t]}%`, background: SIGNAL_COLORS[t] }} />
                            </span>
                            {company.contributions[t].toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="detail-section">
              <h3 className="section-title">Activity by quarter</h3>
              <ol className="quarter-chart" aria-label={`Signals per quarter, last ${QUARTERS_SHOWN} quarters`}>
                {facts.quarters.map((q) => (
                  <li key={q.quarter} title={q.amount ? `${q.count} signals · ${formatUsd(q.amount)}` : `${q.count} signals`}>
                    <span className="quarter-count">{q.count || ''}</span>
                    <span className="quarter-track">
                      <span className="quarter-bar" style={{ height: `${(q.count / facts.maxQuarter) * 100}%` }} />
                    </span>
                    <span className="quarter-label">{q.quarter.replace(' ', '\n')}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="detail-section">
              <h3 className="section-title">Signal history</h3>
              {facts.byDate.length === 0 ? (
                <p className="muted">No signals on file.</p>
              ) : (
                <div className="table-scroll-x">
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Quarter</th>
                        <th scope="col">Signal</th>
                        <th scope="col" className="num">
                          Amount
                        </th>
                        <th scope="col">Detail</th>
                        <th scope="col">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facts.byDate.map((s, i) => (
                        <tr key={i}>
                          <td>{formatDate(s.date)}</td>
                          <td>{quarterOf(s.date)}</td>
                          <td>{SIGNAL_LABELS[s.type]}</td>
                          <td className="num">{s.amount != null ? formatUsd(s.amount) : s.count != null ? `×${s.count}` : '—'}</td>
                          <td className="detail-desc">{s.description ?? '—'}</td>
                          <td>
                            {s.sourceUrl ? (
                              <a className="detail-inline" href={s.sourceUrl} target="_blank" rel="noreferrer">
                                {sourceInfo(s.source).name}
                                <ExternalLink size={14} aria-hidden="true" />
                                <span className="sr-only">(opens in a new tab)</span>
                              </a>
                            ) : (
                              sourceInfo(s.source).name
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="detail-section">
              <h3 className="section-title">How this data is created</h3>
              <ol className="pipeline-steps">
                <li>Pull public records from each source below.</li>
                <li>Keep NJ companies; drop pooled funds, public companies, firms over 10 years old and raises over $100M.</li>
                <li>Match records to one company by normalized name and city.</li>
                <li>Geocode the address and assign a sector from the industry group or grant abstract.</li>
                <li>Score against the full NJ set when you load the page, using the weights you set.</li>
              </ol>
              <div className="source-grid">
                {facts.sources.map(({ info, records, latest, run }) => (
                  <div className="detail-card" key={info.name}>
                    <p className="source-title">{info.name}</p>
                    <p className="muted">{info.method}</p>
                    <dl className="source-facts">
                      <dt>Published</dt>
                      <dd>{info.cadence}</dd>
                      <dt>This company</dt>
                      <dd>
                        {records} {records === 1 ? 'record' : 'records'}, latest {formatDate(latest)} ({quarterOf(latest)})
                      </dd>
                      <dt>Last refresh</dt>
                      <dd>
                        {run && run.status !== 'success'
                          ? `Last run ${run.status} (${formatDate(run.started_at.slice(0, 10))})`
                          : run?.completed_at
                          ? `${formatDate(run.completed_at.slice(0, 10))} · ${run.rows_accepted ?? 0} rows accepted`
                          : dataset === 'sample'
                            ? 'Sample data, not refreshed'
                            : 'Not reported'}
                      </dd>
                    </dl>
                  </div>
                ))}
              </div>
            </section>

            <section className="detail-section">
              <h3 className="section-title">{company.sector} peers</h3>
              <ul className="peer-list">
                {facts.peers.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={p.id === company.id ? 'peer is-current' : 'peer'}
                      onClick={() => p.id !== company.id && onOpen(p.id)}
                      aria-current={p.id === company.id ? 'true' : undefined}
                    >
                      <span className="dot" style={{ background: sectorColor(p.sector) }} />
                      <span className="peer-name">{p.name}</span>
                      <span className="muted">{p.city}</span>
                      <span className={`score-pill score-pill--${scoreTier(p.score)}`}>{p.score.toFixed(0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <p className="muted detail-disclaimer">
              Scores rank public signals only. They are not a valuation or an investment recommendation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
