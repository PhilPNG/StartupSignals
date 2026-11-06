import { Star } from 'lucide-react';

interface Props {
  active: boolean;
  name: string;
  onToggle: () => void;
  size?: number;
}

/** Save/unsave toggle. Stops propagation so it works inside clickable rows and cards. */
export function StarButton({ active, name, onToggle, size = 20 }: Props) {
  return (
    <button
      type="button"
      className={active ? 'star-button is-active' : 'star-button'}
      aria-pressed={active}
      aria-label={active ? `Remove ${name} from saved` : `Save ${name}`}
      title={active ? 'Remove from saved' : 'Save'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        // The ranked row selects on Enter/Space; let every other key (Escape) bubble.
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      <Star size={size} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}
