/** Helpers shared by styles. Pure functions of the facts. */

export function escapeXml(text) {
  return String(text).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);
}

/** Bytes per language summed over several repositories, largest first, with percentages. */
export function combinedLanguages(allFacts) {
  const totals = new Map();
  for (const facts of allFacts) {
    for (const { language, bytes } of facts.languages ?? []) totals.set(language, (totals.get(language) ?? 0) + bytes);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([language, bytes]) => ({ language, bytes, percent: Math.round((bytes / total) * 1000) / 10 }));
}

/** What a project is built with: its main language and up to two frameworks, else two languages. */
export function stackOf(facts) {
  const languages = (facts.languages ?? []).map(({ language }) => language);
  if (facts.frameworks) return [...languages.slice(0, 1), ...facts.frameworks.slice(0, 2)];
  return languages.slice(0, 2);
}

/** `YYYY-MM-DD` of the last commit on the default branch, when the history is known. */
export function lastCommitDate(facts) {
  return facts.history?.lastCommitAt.slice(0, 10);
}
