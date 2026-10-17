import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFacts } from "../skills/dotprofile/scripts/lib/facts.mjs";
import { NOW, snapshot } from "./fixtures.mjs";

test("extracts metadata, languages, signals, manifests and history", () => {
  const { facts, warnings } = extractFacts(snapshot(), NOW);
  assert.deepEqual(warnings, []);
  assert.equal(facts.description, "Checks every link of a static site");
  assert.deepEqual(facts.languages, [{ language: "TypeScript", bytes: 12000, percent: 100 }]);
  assert.deepEqual(facts.signals, { tests: true, ci: true, container: false, readme: true, docs: false, monorepo: false });
  assert.deepEqual(facts.dependencies, ["commander"]);
  assert.deepEqual(facts.frameworks, ["React"]);
  assert.deepEqual(facts.scripts, ["build", "test"]);
  assert.deepEqual(facts.runtimes, [{ runtime: "Node.js", version: ">=22", source: "package.json" }]);
  assert.equal(facts.history.commits, 42);
  assert.equal(facts.history.contributors, 1);
  assert.equal(facts.derived.collaboration, "solo");
  assert.equal(facts.derived.recentlyMaintained, true);
  assert.equal(facts.derived.toolingMaturity, 2);
  assert.equal("fork" in facts, false);
});

test("leaves unknown facts out instead of guessing", () => {
  const { facts, warnings } = extractFacts(
    snapshot({
      metadata: { description: undefined, topics: [], license: undefined },
      tree: { complete: false, entries: [{ path: "main.py", bytes: 10 }] },
      files: new Map(),
      history: null,
    }),
    NOW,
  );
  for (const field of ["description", "topics", "license", "languages", "manifests", "dependencies", "history"]) {
    assert.equal(field in facts, false, `${field} should be absent`);
  }
  // On a truncated tree a signal that was not found is unknown, not false.
  assert.deepEqual(facts.signals, {});
  assert.match(warnings[0], /truncated/);
});

test("a manifest that cannot be parsed becomes a warning", () => {
  const { facts, warnings } = extractFacts(snapshot({ files: new Map([["package.json", "{ not json"]]) }), NOW);
  assert.equal("dependencies" in facts, false);
  assert.match(warnings[0], /package\.json: not valid JSON/);
});
