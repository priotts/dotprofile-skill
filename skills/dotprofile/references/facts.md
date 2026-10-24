# facts.json

`extract.mjs facts` writes one file:

```json
{
  "extractedAt": "2026-10-17T10:00:00.000Z",
  "profile": { "login": "...", "name": "...", "bio": "...", "location": "...", "blog": "..." },
  "repos": [ { "...": "one object per repository, below" } ],
  "warnings": { "owner/repo": ["..."] }
}
```

With `--stack-months <n>` it also has `"stack": { "months": n }` and `stackRepos`: the facts of the
user's other repositories pushed in the last `n` months, not forks and not archived (the selected
ones and `<login>/<login>` excluded). Same fields as `repos`; they only feed the stack summary.

**Optional fields are absent when the data is unknown.** Never `null`, never estimated, never a
default. Lists are absent rather than empty. An absent field means "nobody knows", so no sentence
may be written about it.

## Profile

What the user wrote on their GitHub profile: `login`, and when set `name`, `bio`, `location`,
`company`, `blog`, `twitter`, plus `publicRepos`, `followers`, `createdAt`. These are facts written
by the user. If the token cannot read profiles, only `login` is there and a warning says so.

## Repository

| Field | Source |
|---|---|
| `name`, `fullName`, `url` | Repository metadata. |
| `description` | The GitHub description, else the first manifest that declares one. |
| `homepage`, `topics`, `license` (`name`, `spdx` when recognised) | Repository metadata. |
| `stars`, `forks`, `visibility`, `fork`, `archived`, `createdAt`, `pushedAt` | Repository metadata. `fork`/`archived` only when true. |
| `languages` | `[{ language, bytes, percent }]`, largest first. Computed from the file sizes in the tree, leaving out `node_modules`, `vendor`, `dist`, `build` and minified files. Data and prose formats (JSON, YAML, Markdown) do not count. Absent if the tree was truncated. |
| `signals` | Booleans read from the file tree, see below. A signal is absent when the tree was truncated and the file was not found in the listed part. |
| `manifests` | Manifest files found at the root: `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`, `Gemfile`, `requirements.txt`. |
| `dependencies` | Runtime dependencies declared in the manifests, sorted. Development dependencies are not listed. |
| `frameworks` | Frameworks recognised among all declared dependencies (development ones included), from an explicit table. |
| `scripts` | Script names declared in the manifests (`package.json` scripts, `[project.scripts]`…). |
| `runtimes` | `[{ runtime, version, source }]`: minimum versions exactly as declared (`engines.node`, `requires-python`, `go`, `rust-version`, PHP, Ruby). |
| `history` | `commits` on the default branch, `firstCommitAt`, `lastCommitAt`, `spanDays`, `contributors` (bots excluded), and `lastCommit` (`sha`, `subject`, `at`): the newest commit that is not a merge. |
| `derived` | Computed, not read: `ageDays`, `daysSinceLastCommit`, `recentlyMaintained` (last commit at most 180 days ago), `collaboration` (`solo` or `collaborative`), `toolingMaturity` (how many of tests, CI and container: 0 to 3). |

## Signals

| Signal | True when the tree has |
|---|---|
| `tests` | a `test/`, `tests/`, `spec/` or `__tests__/` folder, or files like `*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py` |
| `ci` | a workflow in `.github/workflows/`, or the configuration of GitLab CI, Travis, CircleCI, Azure Pipelines, Bitbucket, AppVeyor, Drone or Jenkins |
| `container` | a `Dockerfile`, `Containerfile` or Compose file |
| `readme` | a README at the root |
| `docs` | a `docs/` folder |
| `monorepo` | a `packages/` folder, `pnpm-workspace.yaml`, `go.work`, or a workspace declared in a manifest |
