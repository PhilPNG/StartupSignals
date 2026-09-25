// Sector names are mirrored in frontend/src/lib/colors.ts for pin colors.
const SECTOR_KEYWORDS: [string, RegExp][] = [
  ['Biotech', /biotech|genom|therapeut|pharma|drug|antibod/i],
  ['Medtech', /medical device|diagnost|surgical|imaging|health care|healthcare/i],
  ['Climate & Energy', /energy|solar|battery|climate|grid|carbon|hydrogen/i],
  ['Fintech', /financ|payment|bank|insur|lending/i],
  ['AI & Software', /software|machine learning|artificial intelligence|\bai\b|analytics|cloud/i],
  ['Advanced Manufacturing', /manufactur|material|robot|semiconductor|photonic/i],
];

/** Sector from the Form D industry group first, then keywords in SBIR abstracts / descriptions. */
export function assignSector(industryGroup = '', text = ''): string {
  for (const haystack of [industryGroup, text]) {
    const match = SECTOR_KEYWORDS.find(([, pattern]) => pattern.test(haystack));
    if (match) return match[0];
  }
  return 'Other';
}
