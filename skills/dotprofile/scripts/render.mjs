#!/usr/bin/env node
/**
 * Writes README.md, header-dark.svg and header-light.svg from dotprofile.json and facts.json.
 * Deterministic: the same two files always give the same output.
 *
 *   node render.mjs [--config dotprofile.json] [--facts facts.json] [--out .]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs, run } from "./lib/args.mjs";
import { readJson, resolve } from "./lib/config.mjs";
import { labelsFor } from "./lib/i18n.mjs";
import { STYLES } from "./styles/index.mjs";

export const CREDIT_LINK = "[dotprofile](https://github.com/priotts/dotprofile-skill)";

export function render(config, factsFile) {
  const style = STYLES[config.style ?? "terminal"];
  if (!style) throw new Error(`Unknown style "${config.style}": available ${Object.keys(STYLES).join(", ")}`);
  const variant = config.variant ?? Object.keys(style.variants)[0];
  if (!style.variants[variant]) throw new Error(`The ${style.name} style has no variant "${variant}": available ${Object.keys(style.variants).join(", ")}`);
  const input = {
    ...resolve(config, factsFile),
    labels: labelsFor(config.language),
    showProjects: config.showProjects === true,
    tooling: config.tooling !== false,
    credit: config.credit === false ? undefined : CREDIT_LINK,
  };
  return {
    "README.md": style.body(input),
    "header-dark.svg": style.header(input, variant, "dark"),
    "header-light.svg": style.header(input, variant, "light"),
  };
}

// Run only as a script, not when imported. pathToFileURL handles Windows paths (C:\...).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(async (argv) => {
    const { options } = parseArgs(argv);
    const config = await readJson(options.config ?? "dotprofile.json");
    const factsFile = await readJson(options.facts ?? "facts.json");
    const out = options.out ?? ".";
    await mkdir(out, { recursive: true });
    for (const [name, content] of Object.entries(render(config, factsFile))) {
      await writeFile(join(out, name), content);
      console.error(`wrote ${join(out, name)}`);
    }
  });
}
