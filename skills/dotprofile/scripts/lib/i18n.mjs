/**
 * Every fixed text a style prints, per language. Styles never embed their own strings: to
 * add a language, add an entry here with the same keys.
 */
export const LABELS = {
  en: {
    project: "project",
    whatItIs: "what it is",
    stack: "stack",
    lastCommit: "last commit",
    private: "private",
    languages: "languages",
    frameworks: "frameworks",
    tooling: "tooling",
    tests: "tests",
    ci: "CI",
    container: "container",
    outOf: (n, total) => `${n} of ${total}`,
    projects: (n) => (n === 1 ? "1 project" : `${n} projects`),
    credit: (link) => `Generated with ${link} from facts read from my repositories.`,
  },
  it: {
    project: "progetto",
    whatItIs: "cos'è",
    stack: "stack",
    lastCommit: "ultimo commit",
    private: "privato",
    languages: "linguaggi",
    frameworks: "framework",
    tooling: "strumenti",
    tests: "test",
    ci: "CI",
    container: "container",
    outOf: (n, total) => `${n} su ${total}`,
    projects: (n) => (n === 1 ? "1 progetto" : `${n} progetti`),
    credit: (link) => `Generato con ${link} dai fatti letti nei miei repository.`,
  },
};

export function labelsFor(language = "en") {
  const labels = LABELS[language];
  if (!labels) throw new Error(`Unknown language "${language}": available ${Object.keys(LABELS).join(", ")}`);
  return labels;
}
