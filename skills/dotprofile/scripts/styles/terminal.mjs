/**
 * The `terminal` style: a terminal window with commands typed character by character and a
 * tmux-like statusline (no macOS dots), and a README body whose sections are shell commands.
 *
 * Like every style it is a pure function of its input: no network, no filesystem, no clock.
 * Text in the SVG is live monospace text, and no position depends on character widths: typed
 * characters are separate <tspan>s that lay themselves out, and the right side of the
 * statusline is anchored at its end.
 */
import { escapeXml, combinedLanguages, languageColor, stackOf, lastCommitDate } from "./shared.mjs";
import { countBadge, techBadge } from "./badges.mjs";

export const style = {
  name: "terminal",
  description: "Terminal window with typed commands and a statusline; sections as shell commands.",
  text: "live",
  /** Real terminal themes, each with its dark and light version. */
  variants: {
    github: {
      dark: { bg: "#151b23", fg: "#d1d7e0", dim: "#9198a1", accent: "#4493f8", prompt: "#3fb950", strong: "#d29922", bar: "#212830", border: "#3d444d" },
      light: { bg: "#f6f8fa", fg: "#1f2328", dim: "#59636e", accent: "#0969da", prompt: "#1a7f37", strong: "#9a6700", bar: "#eaeef2", border: "#d1d9e0" },
    },
    solarized: {
      dark: { bg: "#002b36", fg: "#93a1a1", dim: "#586e75", accent: "#268bd2", prompt: "#859900", strong: "#b58900", bar: "#073642", border: "#0b4552" },
      light: { bg: "#fdf6e3", fg: "#586e75", dim: "#93a1a1", accent: "#268bd2", prompt: "#859900", strong: "#b58900", bar: "#eee8d5", border: "#e4dcc4" },
    },
    gruvbox: {
      dark: { bg: "#282828", fg: "#ebdbb2", dim: "#928374", accent: "#83a598", prompt: "#b8bb26", strong: "#fabd2f", bar: "#3c3836", border: "#504945" },
      light: { bg: "#fbf1c7", fg: "#3c3836", dim: "#928374", accent: "#076678", prompt: "#79740e", strong: "#b57614", bar: "#ebdbb2", border: "#d5c4a1" },
    },
  },
  header,
  body,
};

const FONT = `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`;
const WIDTH = 880;
const LINE = 26;
const GAP = 8;
const TOP = 40;
const TYPE_STEP = 0.07;
const BAR_LINE = 22;
const BAR_HEIGHT = 10;
const BAR_GAP = 2;
/** With `languageBars: "rows"`: where each bar starts (past the longest language name) and its length. */
const ROW_BAR_X = 200;
const ROW_BAR_WIDTH = 360;
/** Languages below this share are noise in a summary (a Dockerfile, one CSS file). */
const MIN_PERCENT = 1;
/** Characters that comfortably fit on one line at this size, whatever the monospace font. */
export const MAX_LINE_CHARS = 72;

/**
 * input: { profile, repos: [{ facts, description? }], stack?: [facts], tagline?, labels, showProjects, languageBars? }
 * `repos` are the selected repositories; `stack` (default: their facts) is what the stack,
 * the badges and the statusline sum up.
 * Returns the SVG for one theme ("dark" or "light") of the variant. Project names appear only
 * with `showProjects`: otherwise the repositories are a source of facts, never named.
 */
function header(input, variantName, theme) {
  const colors = style.variants[variantName]?.[theme];
  if (!colors) throw new Error(`The terminal style has no variant "${variantName}"`);
  const { profile, repos, tagline, labels } = input;
  const prompt = `${profile.login}@github:~$ `;
  if (tagline && [...tagline].length > MAX_LINE_CHARS) {
    throw new Error(`The tagline has ${[...tagline].length} characters: the terminal header fits ${MAX_LINE_CHARS}`);
  }
  const allFacts = input.stack ?? repos.map(({ facts }) => facts);
  const name = profile.name ?? profile.login;

  let clock = 0.4;
  let y = TOP;
  const lines = [];
  const typed = (command) => {
    const start = clock;
    clock += command.length * TYPE_STEP + 0.3;
    lines.push({ kind: "typed", command, start, y });
    y += LINE;
  };
  const output = (spans) => {
    lines.push({ kind: "output", spans, at: clock, y });
    y += LINE;
  };
  const pause = () => {
    clock += 0.5;
    y += GAP;
  };

  typed("whoami");
  const nameSpan = { text: name, color: colors.strong, weight: "bold" };
  if (tagline && [...`${name} · ${tagline}`].length <= MAX_LINE_CHARS) {
    output([nameSpan, { text: ` · ${tagline}`, color: colors.fg }]);
  } else {
    output([nameSpan]);
    if (tagline) output([{ text: tagline, color: colors.fg }]);
  }
  pause();

  const names = fitting(input.showProjects ? repos.map(({ facts }) => facts.name) : [], "  ");
  if (names.length > 0) {
    typed("ls projects/");
    output([{ text: names.join("  "), color: colors.accent }]);
    pause();
  }

  const languages = summaryLanguages(allFacts).slice(0, 5);
  const frameworks = fitting(frameworksOf(allFacts), " · ");
  if (languages.length > 0 || frameworks.length > 0) {
    typed("cat stack.txt");
    if (input.languageBars === "rows") {
      // One bar per language. The bars start at a fixed column wide enough for any language name.
      for (const { language, percent } of languages.slice(0, 3)) {
        lines.push({ kind: "row", language, percent, at: clock, y });
        y += LINE;
      }
    } else if (languages.length > 0) {
      // One bar split by language, as on GitHub. Drawn as shapes, so no glyph decides its look.
      lines.push({ kind: "bar", languages, at: clock, y });
      y += BAR_LINE;
      const legend = languages.map(({ language, percent }) => `● ${language} ${percent.toFixed(1)}%`);
      output(
        languages.slice(0, fitting(legend, "   ").length).flatMap(({ language, percent }, i) => [
          { text: `${i > 0 ? "   " : ""}● `, color: languageColor(language, colors) },
          { text: `${language} `, color: colors.fg },
          { text: `${percent.toFixed(1)}%`, color: colors.dim },
        ]),
      );
    }
    if (frameworks.length > 0) output([{ text: frameworks.join(" · "), color: colors.dim }]);
    pause();
  }
  lines.push({ kind: "cursor", at: clock, y });

  const barY = y + 18;
  const height = barY + 30;
  const status = [
    allFacts.length > 0 && labels.projects(allFacts.length),
    ...(input.tooling === false ? [] : tooling(allFacts))
      .filter(({ signal }) => signal !== "container")
      .map(({ signal, yes, known }) => `${labels[signal]} ${yes}/${known}`),
    profile.location,
  ]
    .filter(Boolean)
    .join(" · ");
  const label = [name, tagline].filter(Boolean).join(", ");

  const rows = lines.map((line) => {
    if (line.kind === "row") {
      const track = `x="${ROW_BAR_X}" y="${line.y - 11}" height="${BAR_HEIGHT}" rx="${BAR_HEIGHT / 2}"`;
      const filled = Math.max(BAR_HEIGHT, (ROW_BAR_WIDTH * line.percent) / 100);
      return [
        `<g opacity="0">`,
        `<text x="24" y="${line.y}" fill="${colors.fg}">${escapeXml(line.language)}</text>`,
        `<rect ${track} width="${ROW_BAR_WIDTH}" fill="${colors.bar}"/>`,
        `<rect ${track} width="${fmt(filled)}" fill="${colors.accent}"/>`,
        `<text x="${ROW_BAR_X + ROW_BAR_WIDTH + 70}" y="${line.y}" text-anchor="end" fill="${colors.fg}">${line.percent.toFixed(1)}%</text>`,
        `${appear(line.at)}</g>`,
      ].join("");
    }
    if (line.kind === "bar") {
      const width = WIDTH - 48;
      let x = 24;
      const segments = line.languages.map(({ language, percent }, i) => {
        const w = (width * percent) / 100;
        const gap = i < line.languages.length - 1 ? BAR_GAP : 0;
        const rect = `<rect x="${fmt(x)}" y="${line.y - 12}" width="${fmt(Math.max(w - gap, 1))}" height="${BAR_HEIGHT}" fill="${languageColor(language, colors)}"/>`;
        x += w;
        return rect;
      });
      const shape = `x="24" y="${line.y - 12}" width="${width}" height="${BAR_HEIGHT}" rx="${BAR_HEIGHT / 2}"`;
      return `<g opacity="0"><clipPath id="stack-bar"><rect ${shape}/></clipPath><rect ${shape} fill="${colors.bar}"/><g clip-path="url(#stack-bar)">${segments.join("")}</g>${appear(line.at)}</g>`;
    }
    if (line.kind === "output") {
      const spans = line.spans
        .filter(({ text }) => text !== "")
        .map(({ text, color, weight }) => `<tspan fill="${color}"${weight ? ` font-weight="${weight}"` : ""}>${escapeXml(text)}</tspan>`)
        .join("");
      return `<text x="24" y="${line.y}" xml:space="preserve" opacity="0">${spans}${appear(line.at)}</text>`;
    }
    const promptSpan = `<tspan fill="${colors.prompt}">${escapeXml(prompt)}</tspan>`;
    if (line.kind === "cursor") {
      return `<text x="24" y="${line.y}" opacity="0">${promptSpan}<tspan fill="${colors.fg}">█<animate attributeName="opacity" values="1;0;1" dur="1s" begin="${fmt(line.at)}s" repeatCount="4" fill="freeze"/></tspan>${appear(line.at)}</text>`;
    }
    const chars = [...line.command]
      .map((char, i) => `<tspan opacity="0">${escapeXml(char)}${appear(line.start + i * TYPE_STEP)}</tspan>`)
      .join("");
    return `<text x="24" y="${line.y}" fill="${colors.fg}" opacity="0">${promptSpan}${chars}${appear(Math.max(0, line.start - 0.3))}</text>`;
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="${escapeXml(label)}">`,
    `<title>${escapeXml(label)}</title>`,
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="10" fill="${colors.bg}" stroke="${colors.border}"/>`,
    `<g font-family='${FONT}' font-size="15">`,
    ...rows.map((row) => `  ${row}`),
    `  <path d="M0.5 ${barY} H${WIDTH - 0.5} V${height - 10.5} a10 10 0 0 1 -10 10 H10.5 a10 10 0 0 1 -10 -10 Z" fill="${colors.bar}"/>`,
    `  <text x="16" y="${barY + 20}" font-size="13"><tspan fill="${colors.prompt}" font-weight="bold">[${escapeXml(profile.login)}]</tspan><tspan fill="${colors.dim}"> 0:profile*</tspan></text>`,
    `  <text x="${WIDTH - 16}" y="${barY + 20}" font-size="13" text-anchor="end" fill="${colors.dim}">${escapeXml(status)}</text>`,
    `</g>`,
    `</svg>`,
    "",
  ].join("\n");
}

/** The first items that fit on one header line, joined by `separator`. */
function fitting(items, separator) {
  const out = [];
  let used = 0;
  for (const item of items) {
    const extra = item.length + (out.length > 0 ? separator.length : 0);
    if (used + extra > MAX_LINE_CHARS) break;
    out.push(item);
    used += extra;
  }
  return out;
}

/** Makes an element visible at `seconds`, once. */
const appear = (seconds) => `<set attributeName="opacity" to="1" begin="${fmt(seconds)}s" fill="freeze"/>`;
const fmt = (seconds) => (Math.round(seconds * 100) / 100).toString();

/**
 * input: { profile, repos: [{ facts, description? }], stack?, bio?, labels, credit, showProjects } →
 * Markdown. The project table and the git log name the projects, so they need `showProjects`;
 * the badges only sum the repositories up.
 */
function body(input) {
  const { profile, repos, bio, labels } = input;
  const allFacts = input.stack ?? repos.map(({ facts }) => facts);
  const out = [];
  const alt = escapeXml(profile.name ?? profile.login);
  out.push(
    "<picture>",
    '  <source media="(prefers-color-scheme: dark)" srcset="header-dark.svg">',
    `  <img alt="${alt}" src="header-light.svg">`,
    "</picture>",
    "",
  );

  const links = [
    profile.location && `📍 ${profile.location}`,
    profile.blog && `[${profile.blog.replace(/^https?:\/\//, "").replace(/\/$/, "")}](${absolute(profile.blog)})`,
    profile.twitter && `[𝕏 @${profile.twitter}](https://x.com/${profile.twitter})`,
  ].filter(Boolean);

  const technologies = [
    ...summaryLanguages(allFacts).map(({ language }) => language),
    ...frameworksOf(allFacts),
    ...(allFacts.some((facts) => facts.signals.container) ? ["Docker"] : []),
  ];
  const counts = (input.tooling === false ? [] : tooling(allFacts)).map(({ signal, yes, known }) => countBadge(labels[signal], labels.inRepos(yes, known), yes / known));
  const badges = [technologies.map(techBadge).join(" "), counts.join(" ")].filter(Boolean).join("<br>\n");

  const about = [bio, links.join(" · "), badges].filter(Boolean);
  if (about.length > 0) out.push("### `$ whoami`", "", about.join("\n\n"), "");

  if (input.showProjects && repos.length > 0) {
    out.push("### `$ ls -l projects/`", "");
    out.push(`| ${labels.project} | ${labels.whatItIs} | ${labels.stack} | ${labels.lastCommit} |`, "|---|---|---|---|");
    for (const { facts, description } of repos) {
      const name = facts.visibility === "public" ? `[**${cell(facts.name)}**](${facts.url})` : `**${cell(facts.name)}** <sub>${labels.private}</sub>`;
      const stars = facts.stars > 0 && facts.visibility === "public" ? ` ★${facts.stars}` : "";
      out.push(`| ${name}${stars} | ${cell(description ?? "")} | ${cell(stackOf(facts).join(" · "))} | ${lastCommitDate(facts) ?? ""} |`);
    }
    out.push("");
  }

  const log = (input.showProjects ? repos : [])
    .map(({ facts }) => facts)
    .filter((facts) => facts.visibility === "public" && facts.history?.lastCommit)
    .sort((a, b) => b.history.lastCommit.at.localeCompare(a.history.lastCommit.at))
    .slice(0, 5)
    .map((facts) => `${facts.history.lastCommit.sha} (${facts.name}) ${facts.history.lastCommit.subject}`);
  if (log.length > 0) out.push(`### \`$ git log --oneline -n ${log.length}\``, "", "```text", ...log, "```", "");

  if (input.credit) out.push(`<sub>${labels.credit(input.credit)}</sub>`, "");
  return out.join("\n");
}

/** Combined languages worth showing: at least MIN_PERCENT of the code. */
const summaryLanguages = (allFacts) => combinedLanguages(allFacts).filter(({ percent }) => percent >= MIN_PERCENT);

/** Frameworks of all the repositories, the most used first. */
function frameworksOf(allFacts) {
  const counts = new Map();
  for (const name of allFacts.flatMap((facts) => facts.frameworks ?? [])) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([name]) => name);
}

/** For each signal some repository has: how many have it, out of those where it is known. */
function tooling(allFacts) {
  return ["tests", "ci", "container"].flatMap((signal) => {
    const known = allFacts.filter((facts) => facts.signals[signal] !== undefined);
    const yes = known.filter((facts) => facts.signals[signal]).length;
    return yes > 0 ? [{ signal, yes, known: known.length }] : [];
  });
}

/** Table cells cannot hold pipes or line breaks. */
const cell = (text) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
const absolute = (url) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
