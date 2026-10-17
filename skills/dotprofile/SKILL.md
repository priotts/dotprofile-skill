---
name: dotprofile
description: Writes the user's GitHub profile README (the README.md of the <username>/<username> repository) from facts read from their repositories through the GitHub API, with an animated SVG header for light and dark themes. Use when the user wants to create, update or regenerate their GitHub profile README, or asks for a profile page that presents their projects. Not for the README of a single project.
license: MIT
---

# dotprofile

Build a GitHub profile README in which **every statement comes from the user's repositories or
from the user**. Nothing else.

## The rule that is never broken

The README never contains a fact that was not extracted from the repositories or written by the
user. Existing generators fail by producing plausible, false text: install commands for packages
that were never published, "used in production" on a three-day experiment. A wrong README is
worse than none.

- Texts are written **only** from `facts.json`. Rephrase facts; never add any.
- A missing field means the sentence is not written. No estimates, no "probably", no filler.
- Anything the user tells you is a fact too: record it as written by the user (see below).
- When in doubt, leave it out and ask.

## Files

Everything happens in a working folder, normally a clone of the user's `<login>/<login>`
repository (create the folder if it does not exist yet):

| File | What it is | Commit it? |
|---|---|---|
| `facts.json` | What was read from GitHub. May describe private repositories. | **No**: add it to `.gitignore` |
| `dotprofile.json` | The choices: repositories, order, style, texts. Rerunning gives the same output. | Yes |
| `README.md`, `header-dark.svg`, `header-light.svg` | The result. | Yes, all three together |

The scripts are in `scripts/` next to this file (`${CLAUDE_SKILL_DIR}/scripts`). They need
Node.js 18 or newer and nothing else. They only ever send GET requests to GitHub.

## Workflow

### 0. Check the setup

- `node --version` must be 18 or newer.
- A GitHub token: `GH_TOKEN` or `GITHUB_TOKEN`, else the GitHub CLI's (`gh auth login`). Without
  one only public repositories can be read, at 60 requests per hour: say so and continue only if
  the user is fine with that. A fine-grained token needs `Metadata: read` and `Contents: read`.
- If `dotprofile.json` already exists, this is a **regeneration**: run step 3 for the
  repositories it lists, then steps 6 and 7. Change texts only if the user asks or `check.mjs`
  finds a problem.

### 1. Choose the repositories

```sh
node ${CLAUDE_SKILL_DIR}/scripts/extract.mjs list [--user <login>]
```

Show the list compactly and propose a selection of 3 to 8 repositories: recently pushed, with a
description, not forks, not archived. The user decides.

Showing no repository at all is a valid choice: the README then has the header and the "whoami"
section only, built from the profile and from what the user writes. Use `"repos": []` and skip
step 3's repository list (run `extract.mjs facts` with `--user <login>` and no repository, to
read the profile).

**Private repositories**: the README is public. If the user picks a private repository, tell them
its name and description will become public (it is shown without a link, and its commit messages
are never shown). Include it only if they confirm.

### 2. Ask what only the user knows

Before writing, ask in one short message (all optional):

- the language of the README (`en` or `it`, the labels exist for these);
- the style variant: `solarized` or `gruvbox` (both have a dark and a light version);
- anything they want said about themselves: role, focus, what they are looking for.

What they write goes into the configuration as `{ "text": "...", "by": "user" }`.

### 3. Extract the facts

```sh
node ${CLAUDE_SKILL_DIR}/scripts/extract.mjs facts <owner/repo>... [--user <login>] --out facts.json
```

Read the warnings it prints and mention the ones that matter (a truncated tree means unknown
languages, a manifest that could not be parsed means missing dependencies). See
[references/facts.md](references/facts.md) for every field and how it is computed.

### 4. Write the texts

Write, in the chosen language, following [references/writing.md](references/writing.md):

- `description` for each repository: one line, at most about 100 characters;
- `bio`: two or three sentences, from the user's own words plus the facts across repositories;
- `tagline`: optional, at most 72 characters, shown in the header under the name.

Each text uses only the facts of its scope: a description uses its repository's facts, the bio
and the tagline use the profile and all selected repositories. If a repository has too few facts
for a meaningful line, leave its description out (the GitHub description is used if there is
one) and say so.

### 5. Review with the user

Show every text and ask for corrections. A text the user wrote or changed becomes
`{ "text": "...", "by": "user" }`; the others stay plain strings, which the checker verifies.

### 6. Write the configuration and check it

Write `dotprofile.json` (format in [references/config.md](references/config.md)), then:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/check.mjs
```

It flags numbers, technologies and claims that appear nowhere in the facts. For each finding,
rewrite the text without the unsupported part, or ask the user whether it is true. If they
confirm, mark the text as theirs. Do not go on while the check fails on a plain string.

### 7. Render

```sh
node ${CLAUDE_SKILL_DIR}/scripts/render.mjs
```

It writes `README.md`, `header-dark.svg` and `header-light.svg`. Show the README and summarise
what is in it. Then tell the user two things they would not guess:

1. The README appears on the profile only in a **public** repository named **exactly** like
   their username (`<login>/<login>`).
2. The two SVG files must be committed together with `README.md`, or the header is a broken image.

Add `facts.json` to `.gitignore`. Do not commit or push unless the user asks.

## Do not

- Do not write install commands, versions, URLs, numbers or technologies that are not in the facts.
- Do not describe quality ("robust", "fast", "production-ready") or adoption ("popular", "used by").
- Do not edit `README.md` by hand after rendering: change `dotprofile.json` and render again, or
  the next regeneration loses the change.
- Do not show anything from a private repository beyond what the user approved.
