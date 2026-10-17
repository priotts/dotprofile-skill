import assert from "node:assert/strict";
import { test } from "node:test";
import { MANIFESTS } from "../skills/dotprofile/scripts/lib/manifests.mjs";

const parse = (file, source) => MANIFESTS.find((manifest) => manifest.file === file).parse(source);

test("pyproject.toml: PEP 621 and Poetry", () => {
  const facts = parse(
    "pyproject.toml",
    `[project]
description = "A tool"
requires-python = ">=3.11"
dependencies = ["Django[argon2]>=5", "requests"]
[project.optional-dependencies]
dev = ["pytest"]
[tool.poetry.dependencies]
python = "^3.11"
Flask_Login = "*"
`,
  );
  assert.equal(facts.description, "A tool");
  assert.deepEqual(facts.dependencies, ["django", "requests", "flask-login"]);
  assert.deepEqual(facts.otherDependencies, ["pytest"]);
  assert.deepEqual(facts.runtime, { runtime: "Python", version: ">=3.11" });
});

test("go.mod: direct requirements only", () => {
  const facts = parse(
    "go.mod",
    `module example.com/x
go 1.22
require (
  github.com/gin-gonic/gin v1.10.0
  golang.org/x/net v0.1.0 // indirect
)
require github.com/spf13/cobra v1.8.0
`,
  );
  assert.deepEqual(facts.dependencies, ["github.com/gin-gonic/gin", "github.com/spf13/cobra"]);
  assert.deepEqual(facts.runtime, { runtime: "Go", version: "1.22" });
});

test("Cargo.toml, Gemfile, composer.json and requirements.txt", () => {
  assert.deepEqual(parse("Cargo.toml", `[package]\nrust-version = "1.75"\n[dependencies]\naxum = "0.7"\n`).dependencies, ["axum"]);
  const gems = parse("Gemfile", `ruby "3.3.0"\ngem "rails"\ngroup :test do\n  gem "rspec"\nend\n`);
  assert.deepEqual([gems.dependencies, gems.otherDependencies, gems.runtime.version], [["rails"], ["rspec"], "3.3.0"]);
  assert.deepEqual(parse("composer.json", JSON.stringify({ require: { php: ">=8.2", "ext-json": "*", "laravel/framework": "^11" } })).dependencies, ["laravel/framework"]);
  assert.deepEqual(parse("requirements.txt", "# c\nflask==3.0\n-r other.txt\nhttps://x/y.whl\n").dependencies, ["flask"]);
});
