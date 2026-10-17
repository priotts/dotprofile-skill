# Writing the texts

The value of a profile README is in telling the reader **what problem each project solves**,
not which category it belongs to. "Counter app" says nothing; "counter rewritten without global
variables, passing the buttons as arguments" tells the reader the author knows what they are
doing. Find that sentence in the facts.

## Where to look in the facts

In order of usefulness:

1. `description`: the author's own words, on GitHub or in a manifest. Start from here; you may
   tighten or translate it, not extend it.
2. `topics`: tags the author chose.
3. `frameworks`, `languages`, `runtimes`: what it is built with.
4. `scripts`, `signals`: how it is run and maintained (a `test` script, CI, a container).
5. `history` and `derived`: how long it has lived and whether it is still active.

`dependencies` are evidence, not content: name a dependency only when it is what the project is
about (a plugin for X names X).

## Rules

- One fact, one source. Every noun, number and technology in a text must be findable in the facts
  of its scope or in what the user wrote.
- A missing field is not written around: if there is no description and no topics, there is no
  "what it does" to write. Say so to the user instead of guessing from the repository name.
- Numbers only as they are in the facts: "12 commits", not "dozens of commits".
- No judgements of quality or adoption. Signals can be stated as facts: "tested, with CI" is
  fine when `signals.tests` and `signals.ci` are true.
- No time words that will go stale: "recently", "currently", "new". Dates are in the table.
- The user's words win. Keep their phrasing; only fix typos if they agree.

## Examples

Facts: `description: "Convert web pages to Markdown"`, `languages: TypeScript 97%`,
`signals.tests: true`, `topics: ["markdown", "scraper", "cli"]`, `runtimes: Node.js >=22`.

- Good: "Command-line tool that turns web pages into clean Markdown. TypeScript, tested."
- Bad: "A blazing-fast, production-ready scraper used by many developers." (quality, adoption)
- Bad: "Install with `npm i page2md`." (no fact says it is published)
- Bad: "Supports PDFs and JavaScript-heavy sites." (not in these facts, even if true)

Facts: no description, no topics, `languages: Python 100%`, 3 commits over 1 day.

- Good: leave the description out, and tell the user: "I have nothing to say about what X does:
  tell me in a few words, or I leave it without a description."
- Bad: "An experimental Python utility." ("utility" is a guess from nothing)

## Bio

Built from what the user said about themselves, then the facts across repositories: main
languages, frameworks, kinds of projects (from descriptions and topics). Two or three sentences,
first person, in the chosen language. Without anything from the user, keep it to what the
repositories show: "I write mostly TypeScript: command-line tools and small web servers."
