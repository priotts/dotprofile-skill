import assert from "node:assert/strict";
import { test } from "node:test";
import { checkConfig, checkText } from "../skills/dotprofile/scripts/lib/check.mjs";
import { extractFacts } from "../skills/dotprofile/scripts/lib/facts.mjs";
import { NOW, snapshot } from "./fixtures.mjs";

const facts = extractFacts(snapshot(), NOW).facts;

test("accepts text supported by the facts", () => {
  assert.deepEqual(checkText("Checks every link of a static site. TypeScript and React, tested, with CI. 42 commits.", [facts]), []);
});

test("flags numbers, technologies and claims the facts do not support", () => {
  const problems = checkText("Used by 500 teams in production, written in Rust with Docker.", [facts]);
  assert.ok(problems.some((p) => p.includes("500")));
  assert.ok(problems.some((p) => p.includes("Rust")));
  assert.ok(problems.some((p) => p.includes("Docker")));
  assert.ok(problems.some((p) => p.includes("in production")));
  assert.ok(problems.some((p) => p.includes("Used by")));
});

test("matches names with their case", () => {
  assert.deepEqual(checkText("Grazie ai test, ogni link viene controllato.", [facts]), []);
});

test("texts written by the user are not checked", () => {
  const config = {
    repos: [{ repo: "octocat/linkcheck", description: { text: "Used by 500 teams", by: "user" } }],
    bio: "I write Haskell.",
  };
  const findings = checkConfig(config, { profile: { login: "octocat" }, repos: [facts] });
  assert.deepEqual(findings.map((finding) => finding.where), ["bio"]);
});

test("with hidden projects, no text may name a repository", () => {
  const factsFile = { profile: { login: "octocat" }, repos: [facts] };
  const config = { repos: ["octocat/linkcheck"], bio: { text: "I made linkcheck.", by: "user" } };
  assert.match(checkConfig(config, factsFile)[0].problems[0], /names linkcheck/);
  assert.deepEqual(checkConfig({ ...config, showProjects: true }, factsFile), []);
});

test("texts may not name a repository that only feeds the stack", () => {
  const other = extractFacts(snapshot({ metadata: { name: "hidden-tool" } }), NOW).facts;
  const config = { showProjects: true, repos: ["octocat/linkcheck"], bio: { text: "I wrote hidden-tool.", by: "user" }, stack: { activeMonths: 6 } };
  const findings = checkConfig(config, { profile: { login: "octocat" }, repos: [facts], stack: { months: 6 }, stackRepos: [other] });
  assert.equal(findings.length, 1);
  assert.match(findings[0].problems[0], /hidden-tool, which only feeds the stack summary/);
});
