import type { CSSProperties } from 'react';

interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}

/** Range input whose track fills up to the thumb (via the --fill custom property). */
export function Range({ value, min, max, onChange, label }: Props) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <input
      className="range"
      type="range"
      min={min}
      max={max}
      value={value}
      aria-label={label}
      style={{ '--fill': fill } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
