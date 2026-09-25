import { useEffect, useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { sectorColor } from '../lib/colors';
import { scoreTier } from '../lib/format';
import type { ScoredCompany } from '../types';

interface Props {
  companies: ScoredCompany[];
  onPick: (id: string) => void;
}

const MAX_RESULTS = 8;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Find a startup by name and jump to it. Combobox pattern: arrows move, Enter picks, Escape closes. */
export function CompanySearch({ companies, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const listId = `${id}-list`;

  const matches = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return companies
      .map((c) => ({ c, at: normalize(c.name).indexOf(q) }))
      .filter((m) => m.at >= 0)
      // Names that start with the query first, then the best-scoring.
      .sort((a, b) => Number(a.at !== 0) - Number(b.at !== 0) || b.c.score - a.c.score)
      .slice(0, MAX_RESULTS)
      .map((m) => m.c);
  }, [companies, query]);

  const searching = open && query.trim() !== '';
  const showList = searching && matches.length > 0;
  const activeOption = showList ? `${listId}-${active}` : undefined;

  // Arrow keys move the highlight; keep it scrolled into view in the list.
  useEffect(() => {
    if (showList) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, showList, listId]);

  const noMatches = searching && matches.length === 0;

  const pick = (company: ScoredCompany) => {
    onPick(company.id);
    setQuery('');
    setOpen(false);
    setActive(0);
  };

  return (
    <div className="search">
      <label className="sr-only" htmlFor={`${id}-input`}>
        Search startups
      </label>
      <Search className="search-icon" size={18} aria-hidden="true" />
      <input
        id={`${id}-input`}
        className="search-input"
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        placeholder={companies.length ? `Search ${companies.length} startups` : 'Search startups'}
        value={query}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && matches.length) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp' && matches.length) {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' && showList && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === 'Escape') {
            // Close the list (or clear the query) without also closing the open profile.
            if (searching || query) {
              e.stopPropagation();
              if (searching) setOpen(false);
              else setQuery('');
            }
          }
        }}
      />
      <ul className="search-list" id={listId} role="listbox" aria-label="Matching startups" hidden={!showList}>
        {matches.map((c, i) => (
          <li
            key={c.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'search-option is-active' : 'search-option'}
            // Keep focus in the input so blur doesn't close the list before the click lands.
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(c)}
          >
            <span className="dot" style={{ background: sectorColor(c.sector) }} aria-hidden="true" />
            <span className="search-text">
              <span className="search-name">{c.name}</span>
              <span className="search-meta">
                {c.sector} · {c.city}
              </span>
            </span>
            <span className={`score-pill score-pill--${scoreTier(c.score)}`}>{c.score.toFixed(0)}</span>
          </li>
        ))}
      </ul>
      <p className="search-empty" aria-hidden="true" hidden={!noMatches}>
        No startups match “{query.trim()}”.
      </p>
      {/* Always in the accessibility tree so screen readers announce changes to it. */}
      <p className="sr-only" role="status">
        {noMatches ? `No startups match ${query.trim()}` : ''}
      </p>
    </div>
  );
}
