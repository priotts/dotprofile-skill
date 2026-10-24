# dotprofile.json

The configuration holds the **choices, not the result**. Rendering it again with the same
`facts.json` always gives the same files.

```json
{
  "user": "octocat",
  "style": "terminal",
  "variant": "github",
  "language": "en",
  "showProjects": true,
  "tagline": { "text": "Backend developer, mostly Go", "by": "user" },
  "bio": "I write command-line tools and small web services, mostly in Go and TypeScript.",
  "repos": [
    { "repo": "octocat/linkcheck", "description": "Checks every link of a static site before it is published. Go, with CI." },
    { "repo": "octocat/notes", "description": { "text": "My notes on distributed systems", "by": "user" } },
    "octocat/dotfiles"
  ],
  "stack": { "activeMonths": 12, "minRepos": 1, "counts": true },
  "credit": true
}
```

| Field | Meaning |
|---|---|
| `user` | GitHub login. |
| `style` | `terminal` (the only style for now). |
| `variant` | `github` (default), `solarized` or `gruvbox`. Each has a dark and a light version. |
| `language` | Language of the fixed labels: `en` or `it`. Write the texts in the same language. |
| `showProjects` | `true`: a table of the projects and their latest commits, and their names in the header. `false` (default): the repositories are only a source for the bio and the stack summary, and no project is named. |
| `tagline` | Optional. One line under the name in the header, at most 72 characters. |
| `bio` | Optional. The "whoami" section. |
| `repos` | In display order. An entry is `"owner/name"` or `{ "repo", "description" }`. Without a description, the GitHub description is used, if any. |
| `stack` | Optional: what the stack summary (languages, frameworks, badges) is computed from. `activeMonths`: also count the user's other repositories pushed in the last that many months, not forks and not archived. They are never named and never feed the texts; extract them with `--stack-months` and the same number. `minRepos` (default `1`): show a framework only when at least that many repositories use it. `counts: false` removes the tests, CI and container counts. |
| `credit` | `false` removes the small "Generated with dotprofile" line, which links to this skill's repository. Default `true`. It is independent of `showProjects`: ask the user, never remove it on your own. |

## Texts

A text is either:

- a **string**: written by Claude from the facts. `check.mjs` verifies it.
- `{ "text": "...", "by": "user" }`: written or confirmed by the user. Not verified, because the
  user is a source of facts.

Mark a text as the user's only when the user wrote it, changed it, or explicitly confirmed a
statement the checker flagged.
