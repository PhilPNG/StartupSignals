import { PRESETS } from '../lib/weights';
import { SIGNAL_LABELS, SIGNAL_TYPES, type Weights } from '../types';

interface Props {
  weights: Weights;
  onChange: (weights: Weights) => void;
}

/** One slider per signal weight; the backend normalizes them to sum to 1 and re-ranks. */
export function WeightSliders({ weights, onChange }: Props) {
  return (
    <section className="panel">
      <h3>Weights</h3>
      <div className="presets">
        {Object.values(PRESETS).map((p) => (
          <button key={p.label} onClick={() => onChange(p.weights)}>
            {p.label}
          </button>
        ))}
      </div>
      {SIGNAL_TYPES.map((t) => (
        <label key={t}>
          {SIGNAL_LABELS[t]}: {weights[t]}
          <input
            type="range"
            min={0}
            max={50}
            value={weights[t]}
            onChange={(e) => onChange({ ...weights, [t]: Number(e.target.value) })}
          />
        </label>
      ))}
    </section>
  );
}
