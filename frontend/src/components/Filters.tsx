import type { FilterState } from '../lib/filters';
import { SIGNAL_LABELS, SIGNAL_TYPES, type SignalType } from '../types';

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  sectors: string[];
  counties: string[];
}

export function Filters({ filters, onChange, sectors, counties }: Props) {
  const toggleSignal = (t: SignalType) =>
    onChange({
      ...filters,
      hasSignals: filters.hasSignals.includes(t)
        ? filters.hasSignals.filter((s) => s !== t)
        : [...filters.hasSignals, t],
    });

  return (
    <section className="panel">
      <h3>Filters</h3>
      <label>
        Sector
        <select value={filters.sector} onChange={(e) => onChange({ ...filters, sector: e.target.value })}>
          <option value="">All</option>
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        County
        <select value={filters.county} onChange={(e) => onChange({ ...filters, county: e.target.value })}>
          <option value="">All</option>
          {counties.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        Min score: {filters.minScore}
        <input
          type="range"
          min={0}
          max={100}
          value={filters.minScore}
          onChange={(e) => onChange({ ...filters, minScore: Number(e.target.value) })}
        />
      </label>
      <fieldset>
        <legend>Has signal</legend>
        {SIGNAL_TYPES.map((t) => (
          <label key={t} className="checkbox">
            <input type="checkbox" checked={filters.hasSignals.includes(t)} onChange={() => toggleSignal(t)} />
            {SIGNAL_LABELS[t]}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
