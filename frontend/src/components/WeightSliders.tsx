import { SIGNAL_ICONS } from '../lib/icons';
import { SIGNAL_DESCRIPTIONS } from '../lib/signals';
import { PRESETS } from '../lib/weights';
import { SIGNAL_LABELS, SIGNAL_TYPES, type Weights } from '../types';
import { Range } from './Range';

interface Props {
  weights: Weights;
  onChange: (weights: Weights) => void;
}

const sameWeights = (a: Weights, b: Weights) => SIGNAL_TYPES.every((t) => a[t] === b[t]);

/** One slider per signal weight; the backend normalizes them to sum to 1 and re-ranks. */
export function WeightSliders({ weights, onChange }: Props) {
  return (
    <section className="card panel" aria-labelledby="weights-title">
      <h2 className="panel-title" id="weights-title">
        Weights
      </h2>
      <div className="presets">
        {Object.values(PRESETS).map((p) => (
          <button
            key={p.label}
            type="button"
            className="preset"
            aria-pressed={sameWeights(weights, p.weights)}
            onClick={() => onChange(p.weights)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {SIGNAL_TYPES.map((t) => {
        const Icon = SIGNAL_ICONS[t];
        return (
          <div className="weight-row" key={t}>
            <Icon className="row-icon" size={20} aria-hidden="true" />
            <span className="tip">
              <span
                className="row-label tip-trigger"
                tabIndex={0}
                aria-describedby={`weight-tip-${t}`}
                onKeyDown={(e) => {
                  // Escape hides the tooltip without also closing the profile.
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.currentTarget.blur();
                  }
                }}
              >
                {SIGNAL_LABELS[t]}
              </span>
              <span className="tip-bubble" role="tooltip" id={`weight-tip-${t}`}>
                {SIGNAL_DESCRIPTIONS[t]}
              </span>
            </span>
            <Range
              label={`${SIGNAL_LABELS[t]} weight`}
              min={0}
              max={50}
              value={weights[t]}
              onChange={(value) => onChange({ ...weights, [t]: value })}
            />
            <span className="row-value">{weights[t]}</span>
          </div>
        );
      })}
    </section>
  );
}
