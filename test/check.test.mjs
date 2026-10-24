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

test('with "stack": "all", the bio is checked against the selected repositories only', () => {
  const other = extractFacts(snapshot({ metadata: { name: "bot" }, files: new Map([["package.json", '{"dependencies":{"@angular/core":"^20.0.0"}}']]) }), NOW).facts;
  const factsFile = { profile: { login: "octocat" }, repos: [facts, other] };
  const config = { repos: ["octocat/linkcheck"], stack: "all", bio: "I write Angular apps." };
  assert.match(checkConfig(config, factsFile)[0].problems.join(), /Angular/);
  // With hidden projects, no text may name a repository of the stack either.
  const named = checkConfig({ ...config, bio: { text: "I made bot.", by: "user" } }, factsFile);
  assert.match(named[0].problems[0], /names bot/);
});
