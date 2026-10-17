/**
 * The `terminal` style: a terminal window with commands typed character by character and a
 * tmux-like statusline (no macOS dots), and a README body whose sections are shell commands.
 *
 * Like every style it is a pure function of its input: no network, no filesystem, no clock.
 * Text in the SVG is live monospace text, and no position depends on character widths: typed
 * characters are separate <tspan>s that lay themselves out, and the right side of the
 * statusline is anchored at its end.
 */
import { escapeXml, combinedLanguages, stackOf, lastCommitDate } from "./shared.mjs";

export const style = {
  name: "terminal",
  description: "Terminal window with typed commands and a statusline; sections as shell commands.",
  text: "live",
  /** Real terminal themes, each with its dark and light version. */
  variants: {
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
const WIDTH = 800;
const LINE = 26;
const TOP = 40;
const TYPE_STEP = 0.07;
/** Characters that comfortably fit on one line at this size, whatever the monospace font. */
export const MAX_LINE_CHARS = 72;

/**
 * input: { profile, repos: [{ facts, description? }], tagline?, labels }
 * Returns the SVG for one theme ("dark" or "light") of the variant.
 */
function header(input, variantName, theme) {
  const colors = style.variants[variantName]?.[theme];
  if (!colors) throw new Error(`The terminal style has no variant "${variantName}"`);
  const { profile, repos, tagline, labels } = input;
  const prompt = `${profile.login}@github:~$ `;
  if (tagline && [...tagline].length > MAX_LINE_CHARS) {
    throw new Error(`The tagline has ${[...tagline].length} characters: the terminal header fits ${MAX_LINE_CHARS}`);
  }

  const names = [];
  let used = 0;
  for (const { facts } of repos) {
    if (used + facts.name.length + 2 > MAX_LINE_CHARS) break;
    names.push(facts.name);
    used += facts.name.length + 2;
  }

  let clock = 0.4;
  const lines = [];
  const typed = (command) => {
    const start = clock;
    clock += command.length * TYPE_STEP + 0.3;
    return { kind: "typed", command, start, end: clock };
  };
  const output = (text, color, weight) => ({ kind: "output", text, color, weight, at: clock });

  lines.push(typed("whoami"));
  lines.push(output(profile.name ?? profile.login, colors.strong, "bold"));
  if (tagline) lines.push(output(tagline, colors.fg));
  clock += 0.5;
  if (names.length > 0) {
    lines.push(typed("ls projects/"));
    lines.push(output(names.join("  "), colors.accent));
    clock += 0.5;
  }
  lines.push({ kind: "cursor", at: clock });

  const barY = TOP + lines.length * LINE + 6;
  const height = barY + 30;
  const top = combinedLanguages(repos.map(({ facts }) => facts))[0];
  const status = [labels.projects(repos.length), top && `${top.language} ${top.percent}%`].filter(Boolean).join(" · ");
  const label = [profile.name ?? profile.login, tagline].filter(Boolean).join(", ");

  const rows = lines.map((line, index) => {
    const y = TOP + index * LINE;
    if (line.kind === "output") {
      return `<text x="24" y="${y}" xml:space="preserve" fill="${line.color}"${line.weight ? ` font-weight="${line.weight}"` : ""} opacity="0">${escapeXml(line.text)}${appear(line.at)}</text>`;
    }
    const promptSpan = `<tspan fill="${colors.prompt}">${escapeXml(prompt)}</tspan>`;
    if (line.kind === "cursor") {
      return `<text x="24" y="${y}" opacity="0">${promptSpan}<tspan fill="${colors.fg}">█<animate attributeName="opacity" values="1;0;1" dur="1s" begin="${fmt(line.at)}s" repeatCount="4" fill="freeze"/></tspan>${appear(line.at)}</text>`;
    }
    const chars = [...line.command]
      .map((char, i) => `<tspan opacity="0">${escapeXml(char)}${appear(line.start + i * TYPE_STEP)}</tspan>`)
      .join("");
    return `<text x="24" y="${y}" fill="${colors.fg}" opacity="0">${promptSpan}${chars}${appear(Math.max(0, line.start - 0.3))}</text>`;
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

/** Makes an element visible at `seconds`, once. */
const appear = (seconds) => `<set attributeName="opacity" to="1" begin="${fmt(seconds)}s" fill="freeze"/>`;
const fmt = (seconds) => (Math.round(seconds * 100) / 100).toString();

/** input: { profile, repos: [{ facts, description? }], bio?, labels, credit } → Markdown. */
function body(input) {
  const { profile, repos, bio, labels } = input;
  const out = [];
  const alt = escapeXml(profile.name ?? profile.login);
  out.push(
    "<picture>",
    '  <source media="(prefers-color-scheme: dark)" srcset="header-dark.svg">',
    `  <img alt="${alt}" src="header-light.svg">`,
    "</picture>",
    "",
  );

  const about = [
    bio,
    [profile.location, profile.blog && `[${profile.blog.replace(/^https?:\/\//, "").replace(/\/$/, "")}](${absolute(profile.blog)})`]
      .filter(Boolean)
      .join(" · "),
  ].filter(Boolean);
  if (about.length > 0) out.push("### `$ whoami`", "", about.join("\n\n"), "");

  if (repos.length > 0) {
    out.push("### `$ ls -l projects/`", "");
    out.push(`| ${labels.project} | ${labels.whatItIs} | ${labels.stack} | ${labels.lastCommit} |`, "|---|---|---|---|");
    for (const { facts, description } of repos) {
      const name = facts.visibility === "public" ? `[**${cell(facts.name)}**](${facts.url})` : `**${cell(facts.name)}** <sub>${labels.private}</sub>`;
      const stars = facts.stars > 0 && facts.visibility === "public" ? ` ★${facts.stars}` : "";
      out.push(`| ${name}${stars} | ${cell(description ?? "")} | ${cell(stackOf(facts).join(" · "))} | ${lastCommitDate(facts) ?? ""} |`);
    }
    out.push("");
  }

  const tree = stackTree(repos.map(({ facts }) => facts), labels);
  if (tree) out.push("### `$ tree stack/`", "", "```text", tree, "```", "");

  const log = repos
    .map(({ facts }) => facts)
    .filter((facts) => facts.visibility === "public" && facts.history?.lastCommit)
    .sort((a, b) => b.history.lastCommit.at.localeCompare(a.history.lastCommit.at))
    .slice(0, 5)
    .map((facts) => `${facts.history.lastCommit.sha} (${facts.name}) ${facts.history.lastCommit.subject}`);
  if (log.length > 0) out.push(`### \`$ git log --oneline -n ${log.length}\``, "", "```text", ...log, "```", "");

  if (input.credit) out.push(`<sub>${labels.credit(input.credit)}</sub>`, "");
  return out.join("\n");
}

function stackTree(allFacts, labels) {
  const languages = combinedLanguages(allFacts).slice(0, 6);
  const frameworks = [...new Set(allFacts.flatMap((facts) => facts.frameworks ?? []))].sort((a, b) => a.localeCompare(b));
  const known = (signal) => allFacts.filter((facts) => facts.signals[signal] !== undefined);
  const tooling = ["tests", "ci", "container"].flatMap((signal) => {
    const counted = known(signal);
    const yes = counted.filter((facts) => facts.signals[signal]).length;
    return yes > 0 ? [`${labels[signal]}: ${labels.outOf(yes, counted.length)}`] : [];
  });

  const groups = [
    languages.length > 0 && { name: labels.languages, items: alignPercents(languages) },
    frameworks.length > 0 && { name: labels.frameworks, items: frameworks },
    tooling.length > 0 && { name: labels.tooling, items: tooling },
  ].filter(Boolean);
  if (groups.length === 0) return undefined;

  const lines = ["stack/"];
  groups.forEach((group, g) => {
    const lastGroup = g === groups.length - 1;
    lines.push(`${lastGroup ? "└── " : "├── "}${group.name}/`);
    group.items.forEach((item, i) => {
      lines.push(`${lastGroup ? "    " : "│   "}${i === group.items.length - 1 ? "└── " : "├── "}${item}`);
    });
  });
  return lines.join("\n");
}

function alignPercents(languages) {
  const width = Math.max(...languages.map(({ language }) => language.length));
  return languages.map(({ language, percent }) => `${language.padEnd(width)}  ${percent.toFixed(1).padStart(5)}%`);
}

/** Table cells cannot hold pipes or line breaks. */
const cell = (text) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");
const absolute = (url) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
