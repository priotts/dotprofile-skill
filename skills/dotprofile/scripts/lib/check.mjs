import { EXTENSIONS, FILE_NAMES, FRAMEWORKS } from "./tables.mjs";
import { isUserWritten, textOf } from "./config.mjs";

/**
 * Looks for statements in the generated texts that the facts do not support. It is a safety
 * net, not a proof: it catches numbers, technologies and claims that appear nowhere in the
 * facts. Texts marked as written by the user are not checked.
 */

/** Technology names that are also ordinary words, in English or Italian: not checked. */
const COMMON_WORDS = new Set(["chi", "clap", "warp", "iced", "Lit", "Click", "Slim", "Echo", "Less", "Solid"]);

/** Technologies a text may name. Languages and frameworks come from the extraction tables. */
const TECHNOLOGIES = [
  ...new Set([
    ...Object.values(EXTENSIONS),
    ...Object.values(FILE_NAMES),
    ...Object.values(FRAMEWORKS).flatMap((table) => Object.values(table)),
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Firebase", "Supabase", "Vercel", "Netlify",
    "PostgreSQL", "Postgres", "MySQL", "SQLite", "MongoDB", "Redis", "GraphQL", "gRPC", "WebSocket",
    "Node.js", "Deno", "Bun", "Jest", "Vitest", "Mocha", "pytest", "Playwright", "Cypress", "Vite", "webpack", "Storybook", "Prisma", "WebAssembly", "OpenAI", "LLM", "AI", "GitHub Actions", "Terraform",
  ]),
].filter((name) => name.length > 1 && !COMMON_WORDS.has(name));

/** Statements that need evidence the facts never contain. English and Italian. */
const UNSUPPORTED_CLAIMS = [
  /\bin production\b/i, /\bin produzione\b/i, /\bproduction[- ]ready\b/i,
  /\b(thousands|millions|hundreds) of\b/i, /\b(migliaia|milioni|centinaia) di\b/i,
  /\bused by\b/i, /\busato da\b/i, /\butilizzato da\b/i, /\busers\b/i, /\butenti\b/i,
  /\bdownloads?\b/i, /\bpopular\b/i, /\bpopolare\b/i, /\benterprise\b/i,
  /\bblazing\b/i, /\bscalable\b/i, /\bscalabile\b/i, /\bbattle[- ]tested\b/i,
  /\b(npm|pip|cargo|gem|go) (install|get|add)\b/i, /\bpublished on\b/i, /\bpubblicat[oa] su\b/i,
];

/** Statements that a signal must back. */
const SIGNAL_CLAIMS = [
  { pattern: /\b(tested|test suite|tests|testat[oa]|test)\b/i, holds: (facts) => facts.signals?.tests === true, what: "tests" },
  { pattern: /\b(CI|continuous integration|integrazione continua|GitHub Actions)\b/, holds: (facts) => facts.signals?.ci === true, what: "CI" },
  { pattern: /\b(docker|container(ized|izzat[oa])?)\b/i, holds: (facts) => facts.signals?.container === true, what: "a container setup" },
  { pattern: /\b(actively maintained|maintained|mantenut[oa]|attivo)\b/i, holds: (facts) => facts.derived?.recentlyMaintained === true, what: "recent maintenance" },
  { pattern: /\bopen[- ]source\b/i, holds: (facts) => facts.visibility === "public" && facts.license !== undefined, what: "a public repository with a license" },
];

/** Every number in the facts, as text, plus the year, month and day parts of dates. */
function numbersIn(value, found = new Set()) {
  if (typeof value === "number") {
    found.add(String(value));
    if (!Number.isInteger(value)) found.add(String(Math.round(value)));
  } else if (typeof value === "string") {
    for (const match of value.matchAll(/\d+(?:\.\d+)?/g)) found.add(String(Number(match[0])));
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) numbersIn(item, found);
  }
  return found;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Names are matched with their case: they are proper nouns, and "AI" is not "ai". */
const mentions = (text, term) => new RegExp(`(^|[^\\w.])${escape(term)}(?![\\w])`).test(text);

/** Problems in one text, checked against `scope`: a list of facts objects. */
export function checkText(text, scope) {
  const problems = [];
  const haystack = JSON.stringify(scope).toLowerCase();
  const numbers = numbersIn(scope);

  for (const match of text.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const number = String(Number(match[0].replace(",", ".")));
    if (!numbers.has(number)) problems.push(`the number ${match[0]} is not in the facts`);
  }
  for (const term of TECHNOLOGIES) {
    if (mentions(text, term) && !haystack.includes(term.toLowerCase())) {
      const signalBacked = SIGNAL_CLAIMS.some(({ pattern, holds }) => pattern.test(term) && scope.some(holds));
      if (!signalBacked) problems.push(`${term} does not appear in the facts`);
    }
  }
  for (const pattern of UNSUPPORTED_CLAIMS) {
    const match = pattern.exec(text);
    if (match) problems.push(`"${match[0]}" is a claim the facts cannot support`);
  }
  for (const { pattern, holds, what } of SIGNAL_CLAIMS) {
    const match = pattern.exec(text);
    if (match && !scope.some(holds)) problems.push(`"${match[0]}" needs ${what}, which the facts do not show`);
  }
  return [...new Set(problems)];
}

/** Checks every generated text of the configuration. Returns `[{ where, text, problems }]`. */
export function checkConfig(config, factsFile) {
  const byName = new Map(factsFile.repos.map((facts) => [facts.fullName.toLowerCase(), facts]));
  const selected = config.repos.map((entry) => byName.get((typeof entry === "string" ? entry : entry.repo).toLowerCase())).filter(Boolean);
  const findings = [];
  const check = (where, value, scope) => {
    const text = textOf(value);
    if (!text || isUserWritten(value)) return;
    const problems = checkText(text, scope);
    if (problems.length > 0) findings.push({ where, text, problems });
  };
  check("tagline", config.tagline, [factsFile.profile, ...selected]);
  check("bio", config.bio, [factsFile.profile, ...selected]);
  for (const entry of config.repos) {
    if (typeof entry === "string") continue;
    const facts = byName.get(entry.repo.toLowerCase());
    if (facts) check(`description of ${entry.repo}`, entry.description, [facts]);
  }
  return findings;
}
