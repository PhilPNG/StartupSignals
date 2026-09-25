import { EMPTY_FILTERS, type FilterState } from '../lib/filters';
import { SIGNAL_ICONS } from '../lib/icons';
import { SIGNAL_LABELS, SIGNAL_TYPES, type SignalType } from '../types';
import { Range } from './Range';

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  sectors: string[];
  counties: string[];
}

export function Filters({ filters, onChange, sectors, counties }: Props) {
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const toggleSignal = (t: SignalType) =>
    onChange({
      ...filters,
      hasSignals: filters.hasSignals.includes(t)
        ? filters.hasSignals.filter((s) => s !== t)
        : [...filters.hasSignals, t],
    });

  return (
    <section className="card panel" aria-labelledby="filters-title">
      <div className="panel-head">
        <h2 className="panel-title" id="filters-title">
          Filters
        </h2>
        {isFiltered && (
          <button type="button" className="text-button" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>

      <label className="field-row">
        <span className="row-label">Sector</span>
        <select
          className="select"
          value={filters.sector}
          onChange={(e) => onChange({ ...filters, sector: e.target.value })}
        >
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field-row">
        <span className="row-label">County</span>
        <select
          className="select"
          value={filters.county}
          onChange={(e) => onChange({ ...filters, county: e.target.value })}
        >
          <option value="">All counties</option>
          {counties.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="field-row field-row--range">
        <span className="row-label">Min score</span>
        <Range
          label="Minimum score"
          min={0}
          max={100}
          value={filters.minScore}
          onChange={(minScore) => onChange({ ...filters, minScore })}
        />
        <span className="row-value">{filters.minScore}</span>
      </div>

      <h3 className="subhead">Has signal</h3>
      {SIGNAL_TYPES.map((t) => {
        const Icon = SIGNAL_ICONS[t];
        return (
          <label className="switch-row" key={t}>
            <Icon className="row-icon" size={20} aria-hidden="true" />
            <span className="row-label">{SIGNAL_LABELS[t]}</span>
            <input
              className="switch"
              type="checkbox"
              role="switch"
              checked={filters.hasSignals.includes(t)}
              onChange={() => toggleSignal(t)}
            />
          </label>
        );
      })}
    </section>
  );
}
