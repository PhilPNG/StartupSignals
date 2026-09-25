import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'startup-signals:favorites';

/** Stored ids, or null when storage is empty or unavailable (e.g. private mode). */
function readStored(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return null;
  }
}

/** Saved startup ids, kept in this browser. Sample ids ("sample-…") never collide with live ids. */
export function useFavorites() {
  const [ids, setIds] = useState<string[]>(() => readStored() ?? []);
  const idsRef = useRef(ids);

  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  // Pick up changes made in other tabs.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(readStored() ?? []);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    // Start from storage so another tab's saves aren't overwritten; fall back to this tab's copy.
    const current = readStored() ?? idsRef.current;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: favorites last for this visit only.
    }
    idsRef.current = next;
    setIds(next);
  }, []);

  return { ids, isFavorite: (id: string) => ids.includes(id), toggle };
}
