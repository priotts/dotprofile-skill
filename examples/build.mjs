// Renders the example in this folder from example facts (a fictional user): node examples/build.mjs
import { writeFileSync } from "node:fs";
import { extractFacts } from "../skills/dotprofile/scripts/lib/facts.mjs";
import { render } from "../skills/dotprofile/scripts/render.mjs";
import { NOW, snapshot } from "../test/fixtures.mjs";

const here = new URL(".", import.meta.url);
const repos = [
  extractFacts(snapshot(), NOW).facts,
  extractFacts(
    snapshot({
      metadata: { name: "tiny-kv", description: "A key-value store in a single file", topics: ["database"], stars: 0 },
      tree: { complete: true, entries: [{ path: "go.mod", bytes: 90 }, { path: "store.go", bytes: 7000 }, { path: "store_test.go", bytes: 3000 }, { path: "Dockerfile", bytes: 200 }] },
      files: new Map([["go.mod", "module github.com/octocat/tiny-kv\ngo 1.22\nrequire github.com/spf13/cobra v1.8.0\n"]]),
      history: {
        commitCount: 87, firstCommitAt: "2025-11-02T09:00:00Z", lastCommitAt: "2026-10-12T18:00:00Z",
        contributors: [{ bot: false }, { bot: false }],
        lastCommit: { sha: "9f2c1e4", subject: "Compact the log on startup", at: "2026-10-12T18:00:00Z" },
      },
    }),
    NOW,
  ).facts,
];
const facts = { extractedAt: NOW.toISOString(), profile: { login: "octocat", name: "The Octocat", location: "San Francisco" }, repos, warnings: {} };
const config = {
  user: "octocat",
  style: "terminal",
  variant: "solarized",
  language: "en",
  tagline: { text: "I build small tools that do one thing", by: "user" },
  bio: { text: "I like command-line tools and storage engines. Mostly Go and TypeScript.", by: "user" },
  repos: [
    { repo: "octocat/tiny-kv", description: "Key-value store in a single file, with a Cobra CLI. Go, tested." },
    { repo: "octocat/linkcheck", description: "Checks every link of a static site. TypeScript, tested, with CI." },
  ],
};
writeFileSync(new URL("dotprofile.json", here), `${JSON.stringify(config, null, 2)}\n`);
writeFileSync(new URL("facts.example.json", here), `${JSON.stringify(facts, null, 2)}\n`);
for (const [name, content] of Object.entries(render(config, facts))) writeFileSync(new URL(name, here), content);
