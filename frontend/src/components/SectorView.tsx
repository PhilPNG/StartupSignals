import { useEffect, useState } from 'react';
import { fetchSectors } from '../api';
import { sectorColor } from '../lib/colors';
import type { Sector, Weights } from '../types';

interface Props {
  weights: Weights;
}

/** Sectors ranked by depth, breadth and year-over-year growth. */
export function SectorView({ weights }: Props) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSectors(weights)
      .then((s) => {
        if (!cancelled) {
          setSectors(s);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [weights]);

  if (error) return <p className="error">{error}</p>;

  return (
    <div className="sectors">
      <table>
        <thead>
          <tr>
            <th>Sector</th>
            <th className="num">Companies</th>
            <th className="num">Depth</th>
            <th className="num">Breadth</th>
            <th className="num">Growth</th>
            <th>Sector score</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => (
            <tr key={s.sector}>
              <td>
                <span className="dot" style={{ background: sectorColor(s.sector) }} />
                {s.sector}
              </td>
              <td className="num">{s.companies}</td>
              <td className="num">{s.depth.toFixed(0)}</td>
              <td className="num">{s.breadth}</td>
              <td className="num">{(s.growth * 100).toFixed(0)}%</td>
              <td>
                <div className="bar">
                  <div style={{ width: `${s.sectorScore}%`, background: sectorColor(s.sector) }} />
                </div>
                {s.sectorScore.toFixed(0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
