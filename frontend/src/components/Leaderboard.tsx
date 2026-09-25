import { sectorColor } from '../lib/colors';
import type { ScoredCompany } from '../types';

interface Props {
  companies: ScoredCompany[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Leaderboard({ companies, selectedId, onSelect }: Props) {
  if (companies.length === 0) return <p className="muted">No companies match these filters.</p>;

  return (
    <table className="leaderboard">
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Sector</th>
          <th>City</th>
          <th className="num">Score</th>
        </tr>
      </thead>
      <tbody>
        {companies.map((c) => (
          <tr
            key={c.id}
            className={c.id === selectedId ? 'selected' : undefined}
            onClick={() => onSelect(c.id)}
          >
            <td>{c.rank}</td>
            <td>
              {c.name}
              {c.isSample && <span className="badge">sample</span>}
            </td>
            <td>
              <span className="dot" style={{ background: sectorColor(c.sector) }} />
              {c.sector}
            </td>
            <td>{c.city}</td>
            <td className="num">{c.score.toFixed(0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
