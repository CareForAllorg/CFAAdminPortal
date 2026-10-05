// service_logs.primary_impact / secondary_impact are free text written by
// the volunteer portal's forms, and the label drifted over time -- "Roads
// Mapped" and "Roads Mapped (km)" both exist in real data. Comparing them
// by exact string meant the "(km)" rows missed the replace-with-latest
// mapping logic and showed up as a second, duplicate Roads Mapped card.
// Everything that compares a mapping category goes through this first.
export function canonicalImpactCategory(raw: string | null): string | null {
  if (!raw) { return raw; }
  const t = raw.trim().toLowerCase();
  if (/^roads?\s+mapped/.test(t)) { return 'Roads Mapped'; }
  if (/^buildings?\s+mapped/.test(t)) { return 'Buildings Mapped'; }
  return raw.trim();
}
