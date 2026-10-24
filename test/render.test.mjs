import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFacts } from "../skills/dotprofile/scripts/lib/facts.mjs";
import { render } from "../skills/dotprofile/scripts/render.mjs";
import { STYLES } from "../skills/dotprofile/scripts/styles/index.mjs";
import { NOW, snapshot } from "./fixtures.mjs";

const publicRepo = extractFacts(snapshot(), NOW).facts;
const privateRepo = extractFacts(snapshot({ metadata: { name: "secret", visibility: "private" } }), NOW).facts;
const factsFile = { profile: { login: "octocat", name: "The Octocat & co" }, repos: [publicRepo, privateRepo] };
const config = {
  variant: "gruvbox",
  showProjects: true,
  tagline: "Links <checked>",
  bio: "I check links.",
  repos: [{ repo: "octocat/linkcheck", description: "Checks links | fast" }, "octocat/secret"],
};

test("renders the README and both headers", () => {
  const files = render(config, factsFile);
  assert.deepEqual(Object.keys(files), ["README.md", "header-dark.svg", "header-light.svg"]);
  const readme = files["README.md"];
  assert.match(readme, /srcset="header-dark\.svg"/);
  assert.match(readme, /\[\*\*linkcheck\*\*\]\(https:\/\/github\.com\/octocat\/linkcheck\) ★3/);
  assert.match(readme, /Checks links \\\| fast/);
  assert.match(readme, /abc1234 \(linkcheck\) Follow redirects/);
  // A private repository has no link and never shows its commits.
  assert.match(readme, /\*\*secret\*\* <sub>private<\/sub>/);
  assert.equal(readme.match(/Follow redirects/g).length, 1);
});

test("is deterministic", () => {
  assert.deepEqual(render(config, factsFile), render(config, factsFile));
});

test("escapes text in the SVG and uses the variant colors", () => {
  const svg = render(config, factsFile)["header-dark.svg"];
  assert.match(svg, /Links &lt;checked&gt;/);
  assert.match(svg, /The Octocat &amp; co/);
  assert.match(svg, new RegExp(STYLES.terminal.variants.gruvbox.dark.bg));
  assert.doesNotMatch(svg, /<script|<style|repeatCount="indefinite"/);
});

test("works with a profile and repositories that have few facts", () => {
  const bare = extractFacts(snapshot({ metadata: { description: undefined, topics: [] }, tree: { complete: true, entries: [] }, files: new Map(), history: null }), NOW).facts;
  const files = render({ repos: ["octocat/linkcheck"] }, { profile: { login: "octocat" }, repos: [bare] });
  assert.doesNotMatch(files["README.md"], /undefined|null/);
  assert.doesNotMatch(files["header-light.svg"], /undefined|null/);
});

test("rejects unknown repositories, variants and too long taglines", () => {
  assert.throws(() => render({ repos: ["octocat/missing"] }, factsFile), /not in the facts/);
  assert.throws(() => render({ ...config, variant: "neon" }, factsFile), /no variant "neon"/);
  assert.throws(() => render({ ...config, tagline: "x".repeat(80) }, factsFile), /fits 72/);
});

test("renders a profile without repositories", () => {
  const files = render({ repos: [], bio: "Hi." }, { profile: { login: "octocat", location: "Rome" }, repos: [] });
  assert.match(files["README.md"], /### `\$ whoami`\n\nHi\.\n\n📍 Rome/);
  assert.doesNotMatch(files["README.md"], /ls -l|shields\.io|git log/);
  assert.doesNotMatch(files["header-dark.svg"], /0 projects|ls projects/);
  assert.match(files["header-dark.svg"], />Rome</);
});

test("without showProjects the repositories are only summed up, never named", () => {
  const files = render({ ...config, showProjects: undefined }, factsFile);
  for (const content of Object.values(files)) {
    assert.doesNotMatch(content, /linkcheck|secret|Follow redirects/);
  }
  assert.match(files["README.md"], /img\.shields\.io\/badge\/TypeScript-3178c6/);
  assert.doesNotMatch(files["README.md"], /ls -l projects|git log/);
  assert.doesNotMatch(files["header-dark.svg"], /ls projects/);
});

test("sums the stack up in the header and as badges, leaving out tiny languages", () => {
  const tiny = extractFacts(snapshot({ metadata: { name: "tiny" }, tree: { complete: true, entries: [{ path: "main.ts", bytes: 99000 }, { path: "Dockerfile", bytes: 100 }] } }), NOW).facts;
  const files = render({ repos: ["octocat/tiny"] }, { profile: { login: "octocat" }, repos: [tiny] });
  assert.match(files["header-dark.svg"], /<rect x="24" y="\d+" width="[\d.]+" height="10" fill="#3178c6"\/>/);
  assert.match(files["header-dark.svg"], />TypeScript <\/tspan><tspan fill="[^"]+">99\.9%</);
  assert.doesNotMatch(files["header-dark.svg"], /Dockerfile/);
  assert.match(files["README.md"], /!\[TypeScript\]\(https:\/\/img\.shields\.io\/badge\/TypeScript-3178c6\?style=flat-square&logo=typescript/);
  assert.doesNotMatch(files["README.md"], /badge\/Dockerfile/);
});

test('with "stack": "all", active unselected repositories count in the stack but are never named', () => {
  const selected = extractFacts(snapshot(), NOW).facts;
  const angular = (name, extra) =>
    extractFacts(snapshot({ metadata: { name, ...extra }, files: new Map([["package.json", '{"dependencies":{"@angular/core":"^20.0.0"}}']]) }), NOW).facts;
  const active = angular("zz-dashboard");
  const fork = angular("zz-forked", { fork: true });
  const stale = { ...angular("zz-old"), derived: { ...active.derived, daysSinceLastCommit: 900 } };
  // The profile repository and repositories without code never count.
  const profileRepo = angular("octocat");
  const empty = extractFacts(snapshot({ metadata: { name: "zz-notes" }, tree: { complete: true, entries: [] } }), NOW).facts;
  const factsFile = { profile: { login: "octocat" }, repos: [selected, active, fork, stale, profileRepo, empty] };
  const base = { repos: ["octocat/linkcheck"], bio: "I check links." };

  assert.doesNotMatch(render(base, factsFile)["README.md"], /Angular/);
  const files = render({ ...base, stack: "all" }, factsFile);
  assert.match(files["README.md"], /badge\/Angular-dd0031/);
  assert.match(files["header-dark.svg"], /2 projects/);
  for (const content of Object.values(files)) assert.doesNotMatch(content, /zz-/);
  assert.throws(() => render({ ...base, stack: "everything" }, factsFile), /stack must be/);
});

test('"tooling": false hides the tests, CI and container counts', () => {
  const files = render({ ...config, tooling: false }, factsFile);
  assert.doesNotMatch(files["README.md"], /badge\/(tests|CI|container)-/);
  assert.doesNotMatch(files["header-dark.svg"], /tests \d|CI \d/);
  assert.match(render(config, factsFile)["README.md"], /badge\/tests-/);
});
