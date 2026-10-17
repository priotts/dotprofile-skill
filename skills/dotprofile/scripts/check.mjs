#!/usr/bin/env node
/**
 * Checks the texts in dotprofile.json against facts.json and lists what the facts do not
 * support. Exits with 1 when something is found.
 *
 *   node check.mjs [--config dotprofile.json] [--facts facts.json]
 */
import { parseArgs, run } from "./lib/args.mjs";
import { checkConfig } from "./lib/check.mjs";
import { readJson } from "./lib/config.mjs";

run(async (argv) => {
  const { options } = parseArgs(argv);
  const findings = checkConfig(await readJson(options.config ?? "dotprofile.json"), await readJson(options.facts ?? "facts.json"));
  if (findings.length === 0) {
    console.log("ok: every generated text is supported by the facts");
    return;
  }
  for (const { where, text, problems } of findings) {
    console.log(`${where}: "${text}"`);
    for (const problem of problems) console.log(`  - ${problem}`);
  }
  process.exitCode = 1;
});
