import { MANIFESTS, ManifestError } from "./manifests.mjs";
import { EXCLUDED_DIRECTORIES, EXTENSIONS, FILE_NAMES, FRAMEWORKS } from "./tables.mjs";

/**
 * Turns what was read from GitHub into the facts of one repository. Pure: `now` is the only
 * notion of time.
 *
 * The rule that makes the facts trustworthy: optional fields are ABSENT when the data is
 * unknown. Never null, never estimated, never filled in with a default. Lists are absent
 * rather than empty.
 *
 * `snapshot` is `{ metadata, tree: { entries: [{ path, bytes }], complete }, files: Map,
 * history? }`, as produced by github.mjs.
 */
export function extractFacts(snapshot, now) {
  const { metadata, tree, files } = snapshot;
  const warnings = [];
  const parsed = [];

  for (const manifest of MANIFESTS) {
    const source = files.get(manifest.file);
    if (source === undefined) continue;
    try {
      const facts = manifest.parse(source);
      const frameworks = frameworksIn(manifest.ecosystem, [...facts.dependencies, ...facts.otherDependencies]);
      parsed.push({ file: manifest.file, facts, frameworks });
    } catch (error) {
      if (!(error instanceof ManifestError)) throw error;
      warnings.push(`${error.message}: its facts were left out.`);
    }
  }

  const signals = detectSignals(tree, parsed.some(({ facts }) => facts.workspaces));
  const history = snapshot.history && historyFacts(snapshot.history);
  if (!tree.complete) warnings.push("GitHub truncated the file tree: languages and missing signals are unknown.");

  const facts = {
    name: metadata.name,
    fullName: `${metadata.owner}/${metadata.name}`,
    url: `https://github.com/${metadata.owner}/${metadata.name}`,
    ...optional("description", metadata.description ?? parsed.find(({ facts }) => facts.description)?.facts.description),
    ...optional("homepage", metadata.homepage),
    ...optionalList("topics", metadata.topics),
    ...optional("license", metadata.license),
    stars: metadata.stars,
    forks: metadata.forks,
    visibility: metadata.visibility,
    ...optional("fork", metadata.fork || undefined),
    ...optional("archived", metadata.archived || undefined),
    createdAt: metadata.createdAt,
    ...optional("pushedAt", metadata.pushedAt),
    ...optional("languages", tree.complete ? languageShares(tree.entries) : undefined),
    signals,
    ...optionalList("manifests", parsed.map(({ file }) => file)),
    ...optionalList("dependencies", sortedUnique(parsed.flatMap(({ facts }) => facts.dependencies))),
    ...optionalList("frameworks", sortedUnique(parsed.flatMap(({ frameworks }) => frameworks))),
    ...optionalList("scripts", sortedUnique(parsed.flatMap(({ facts }) => facts.scripts))),
    ...optionalList("runtimes", parsed.flatMap(({ file, facts }) => (facts.runtime ? [{ ...facts.runtime, source: file }] : []))),
    ...optional("history", history),
    derived: derivedFacts(signals, history, now),
  };
  return { facts, warnings };
}

/** `{ key: value }` when the value is known, `{}` otherwise. */
export function optional(key, value) {
  return value === undefined || value === null ? {} : { [key]: value };
}

/** Like `optional`, but an empty list also counts as unknown. */
export function optionalList(key, values) {
  return optional(key, values && values.length > 0 ? values : undefined);
}

const sortedUnique = (values) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
const basename = (path) => path.slice(path.lastIndexOf("/") + 1);
const directories = (path) => path.split("/").slice(0, -1);

// --- Languages -------------------------------------------------------------------------

const MINIFIED = /\.min\.(js|css)$/;

/** Paths that are vendored or generated, and therefore not the author's code. */
export function isExcluded(path) {
  return directories(path).some((dir) => EXCLUDED_DIRECTORIES.has(dir)) || MINIFIED.test(path);
}

export function languageOf(path) {
  const name = basename(path);
  const byName = FILE_NAMES[name] ?? (name.startsWith("Dockerfile.") ? "Dockerfile" : undefined);
  if (byName !== undefined) return byName;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? EXTENSIONS[name.slice(dot + 1).toLowerCase()] : undefined;
}

/**
 * Bytes per language, largest first, computed from the file sizes in the tree after leaving
 * out vendored and generated paths. Absent when no file is in a recognised language.
 */
export function languageShares(entries) {
  const totals = new Map();
  for (const entry of entries) {
    const language = isExcluded(entry.path) ? undefined : languageOf(entry.path);
    if (language !== undefined) totals.set(language, (totals.get(language) ?? 0) + entry.bytes);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  if (total === 0) return undefined;
  return [...totals]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([language, bytes]) => ({ language, bytes, percent: Math.round((bytes / total) * 1000) / 10 }));
}

// --- Signals from the file tree --------------------------------------------------------

const TEST_DIRECTORIES = new Set(["test", "tests", "spec", "__tests__"]);
const TEST_FILES = [/\.test\.[^.]+$/, /\.spec\.[^.]+$/, /_test\.go$/, /^test_.*\.py$/];
const CI_FILES = new Set([
  ".gitlab-ci.yml", ".travis.yml", ".drone.yml", ".circleci/config.yml", "azure-pipelines.yml",
  "bitbucket-pipelines.yml", "appveyor.yml", "Jenkinsfile",
]);
const COMPOSE_FILES = new Set(["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"]);
/** Workspace definitions that live in their own file rather than in a manifest field. */
const WORKSPACE_FILES = new Set(["pnpm-workspace.yaml", "go.work"]);

/** One rule per signal, each a predicate on a single path. */
const RULES = {
  tests: (path) =>
    !isExcluded(path) &&
    (directories(path).some((dir) => TEST_DIRECTORIES.has(dir)) || TEST_FILES.some((pattern) => pattern.test(basename(path)))),
  ci: (path) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path) || CI_FILES.has(path),
  container: (path) => {
    const name = basename(path);
    return (
      !isExcluded(path) &&
      (name === "Dockerfile" || name === "Containerfile" || name.startsWith("Dockerfile.") || COMPOSE_FILES.has(name))
    );
  },
  readme: (path) => !path.includes("/") && /^readme(\.[a-z]+)?$/i.test(path),
  docs: (path) => path.startsWith("docs/"),
  monorepo: (path) => path.startsWith("packages/") || WORKSPACE_FILES.has(path),
};

/**
 * Evaluates every rule on the tree. On a truncated tree a signal that was not found is
 * unknown, so it is left out instead of reported as false.
 */
export function detectSignals(tree, declaredWorkspaces) {
  const signals = {};
  for (const [name, rule] of Object.entries(RULES)) {
    const value = tree.entries.some((entry) => rule(entry.path)) || (name === "monorepo" && declaredWorkspaces);
    if (value || tree.complete) signals[name] = value;
  }
  return signals;
}

// --- Frameworks ------------------------------------------------------------------------

/** Go modules carry their major version in the path: `github.com/gofiber/fiber/v2`. */
const lookupKey = (ecosystem, name) => (ecosystem === "go" ? name.replace(/\/v\d+$/, "") : name);

export function frameworksIn(ecosystem, dependencies) {
  const table = FRAMEWORKS[ecosystem];
  return dependencies.flatMap((name) => table[lookupKey(ecosystem, name)] ?? []);
}

// --- History and derived facts ---------------------------------------------------------

const DAY_MS = 86_400_000;

/** A project counts as recently maintained if its last commit is at most this old. */
export const RECENT_DAYS = 180;

const daysBetween = (from, to) => Math.floor((to.getTime() - Date.parse(from)) / DAY_MS);

function historyFacts(raw) {
  return {
    commits: raw.commitCount,
    firstCommitAt: raw.firstCommitAt,
    lastCommitAt: raw.lastCommitAt,
    spanDays: daysBetween(raw.firstCommitAt, new Date(raw.lastCommitAt)),
    contributors: raw.contributors.filter((contributor) => !contributor.bot).length,
    ...optional("lastCommit", raw.lastCommit),
  };
}

/** Computed from the other facts and from the time of extraction, never extracted. */
export function derivedFacts(signals, history, now) {
  const sinceLast = history && daysBetween(history.lastCommitAt, now);
  const contributors = history?.contributors;
  return {
    ...optional("ageDays", history && daysBetween(history.firstCommitAt, now)),
    ...optional("daysSinceLastCommit", sinceLast),
    ...optional("recentlyMaintained", sinceLast === undefined ? undefined : sinceLast <= RECENT_DAYS),
    ...optional("collaboration", !contributors ? undefined : contributors === 1 ? "solo" : "collaborative"),
    /** How many of tests, CI and container are present: 0 to 3. */
    toolingMaturity: [signals.tests, signals.ci, signals.container].filter(Boolean).length,
  };
}
