import assert from "node:assert/strict";
import { test } from "node:test";
import { parseToml } from "../skills/dotprofile/scripts/lib/toml.mjs";

test("reads tables, arrays, inline tables and multiline strings", () => {
  const parsed = parseToml(`
# comment
[project]
name = "demo" # trailing comment
description = """
Two
lines"""
dependencies = [
  "django[argon2]>=4",
  'flask',
]

[tool.poetry.dependencies]
python = { version = "^3.11" }

[[bin]]
name = "a"
[[bin]]
name = "b"

[dependencies]
serde.workspace = true
count = 1_000
`);
  assert.equal(parsed.project.description, "Two\nlines");
  assert.deepEqual(parsed.project.dependencies, ["django[argon2]>=4", "flask"]);
  assert.equal(parsed.tool.poetry.dependencies.python.version, "^3.11");
  assert.deepEqual(parsed.bin.map((bin) => bin.name), ["a", "b"]);
  assert.deepEqual(parsed.dependencies, { serde: { workspace: true }, count: 1000 });
});

test("throws on invalid input", () => {
  assert.throws(() => parseToml('name = "unterminated'), SyntaxError);
  assert.throws(() => parseToml("[table"), SyntaxError);
});
