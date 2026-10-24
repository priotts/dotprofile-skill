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

/** GitHub's own language colors (linguist), so the stack bar reads like a repository's. */
const LANGUAGE_COLORS = {
  Astro: "#ff5a03", C: "#555555", "C#": "#178600", "C++": "#f34b7d", CSS: "#663399", Clojure: "#db5855",
  Dart: "#00b4ab", Dockerfile: "#384d54", Elixir: "#6e4a7e", Erlang: "#b83998", "F#": "#b845fc",
  Go: "#00add8", Groovy: "#4298b8", HCL: "#844fba", HTML: "#e34c26", Haskell: "#5e5086", Java: "#b07219",
  JavaScript: "#f1e05a", Julia: "#a270ba", Kotlin: "#a97bff", Less: "#1d365d", Lua: "#000080",
  Makefile: "#427819", Nim: "#ffc200", Nix: "#7e7eff", OCaml: "#ef7a08", PHP: "#4f5d95", Perl: "#0298c3",
  PowerShell: "#012456", Python: "#3572a5", Ruby: "#701516", Rust: "#dea584", SCSS: "#c6538c",
  Sass: "#a53b70", Scala: "#c22d40", Shell: "#89e051", Svelte: "#ff3e00", Swift: "#f05138",
  TypeScript: "#3178c6", Vue: "#41b883", Zig: "#ec915c",
};

/** A language's color, or the theme's accent for one GitHub has none for. */
export const languageColor = (language, colors) => LANGUAGE_COLORS[language] ?? colors.accent;
