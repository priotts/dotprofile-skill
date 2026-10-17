/** A snapshot as github.mjs would read it, and the facts file built from it. */
export function snapshot(overrides = {}) {
  return {
    metadata: {
      owner: "octocat",
      name: "linkcheck",
      description: "Checks every link of a static site",
      topics: ["links", "cli"],
      license: { name: "MIT License", spdx: "MIT" },
      stars: 3,
      forks: 0,
      visibility: "public",
      fork: false,
      archived: false,
      createdAt: "2026-01-10T10:00:00Z",
      pushedAt: "2026-09-30T10:00:00Z",
      ...overrides.metadata,
    },
    tree: overrides.tree ?? {
      complete: true,
      entries: [
        { path: "package.json", bytes: 400 },
        { path: "src/index.ts", bytes: 9000 },
        { path: "src/cli.ts", bytes: 1000 },
        { path: "test/index.test.ts", bytes: 2000 },
        { path: "dist/index.js", bytes: 50000 },
        { path: "node_modules/x/index.js", bytes: 90000 },
        { path: "README.md", bytes: 3000 },
        { path: ".github/workflows/ci.yml", bytes: 300 },
      ],
    },
    files:
      overrides.files ??
      new Map([
        [
          "package.json",
          JSON.stringify({
            description: "ignored: the GitHub description wins",
            dependencies: { commander: "^12" },
            devDependencies: { vitest: "^3", react: "^19" },
            scripts: { test: "vitest", build: "tsc" },
            engines: { node: ">=22" },
          }),
        ],
      ]),
    history: "history" in overrides ? overrides.history : {
      commitCount: 42,
      firstCommitAt: "2026-01-10T10:00:00Z",
      lastCommitAt: "2026-09-30T10:00:00Z",
      contributors: [{ bot: false }, { bot: true }],
      lastCommit: { sha: "abc1234", subject: "Follow redirects", at: "2026-09-30T10:00:00Z" },
    },
  };
}

export const NOW = new Date("2026-10-17T00:00:00Z");
