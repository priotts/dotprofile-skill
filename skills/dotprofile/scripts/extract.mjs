#!/usr/bin/env node
/**
 * Reads repositories through the GitHub API (GET requests only).
 *
 *   node extract.mjs list [--user <login>]
 *       The repositories the user owns, most recently pushed first, as JSON.
 *   node extract.mjs facts [<owner/repo>...] [--user <login>] [--stack-months <n>] [--out facts.json]
 *       The facts of each repository plus the user's profile, written to facts.json. With no
 *       repository, only the profile. With --stack-months, also the facts of the user's other
 *       repositories pushed in the last <n> months, not forks and not archived, as `stackRepos`:
 *       they only feed the stack summary.
 *
 * Token: GH_TOKEN or GITHUB_TOKEN, else `gh auth token`. Without one only public data is read.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs, run } from "./lib/args.mjs";
import { extractFacts } from "./lib/facts.mjs";
import { activeRepositories, createClient, listRepositories, readProfile, readSnapshot, resolveToken } from "./lib/github.mjs";

run(async (argv) => {
  const { options, positional } = parseArgs(argv);
  const [command, ...repos] = positional;
  const token = resolveToken();
  const client = createClient({ token });
  if (!token) console.error("warning: no GitHub token found, reading public data only (60 requests per hour).");

  if (command === "list") {
    if (!token && !options.user) throw new Error("without a token, pass --user <login>");
    console.log(JSON.stringify(await listRepositories(client, options.user), null, 2));
    return;
  }
  if (command !== "facts") {
    throw new Error("usage: extract.mjs list [--user <login>] | extract.mjs facts <owner/repo>... [--user <login>] [--stack-months <n>] [--out facts.json]");
  }

  const months = options["stack-months"] === undefined ? undefined : Number(options["stack-months"]);
  if (months !== undefined && (!Number.isInteger(months) || months < 1)) throw new Error("--stack-months needs a whole number of months");
  const now = new Date();
  const out = options.out ?? "facts.json";
  // With no repository the README only has the profile: facts with --user and nothing else.
  const login = options.user ?? (token ? undefined : repos[0]?.split("/")[0]);
  if (!token && !login) throw new Error("without a token, pass --user <login>");
  const warnings = {};
  let profile;
  try {
    profile = await readProfile(client, login);
  } catch (error) {
    // A token limited to some repositories may not read profiles: the README just has less.
    const fallback = login ?? repos[0]?.split("/")[0];
    if (!fallback) throw new Error(`could not read the profile (${error.message}): pass --user <login>`);
    profile = { login: fallback };
    warnings.profile = [`could not read the profile (${error.message}): only the login is known.`];
  }
  const result = { extractedAt: now.toISOString(), profile, repos: [], warnings };
  const read = async (fullName, into) => {
    console.error(`reading ${fullName}…`);
    const extraction = extractFacts(await readSnapshot(client, fullName), now);
    into.push(extraction.facts);
    if (extraction.warnings.length > 0) warnings[extraction.facts.fullName] = extraction.warnings;
  };
  for (const fullName of repos) await read(fullName, result.repos);
  if (months !== undefined) {
    result.stack = { months };
    result.stackRepos = [];
    const exclude = [...repos, `${profile.login}/${profile.login}`];
    for (const fullName of activeRepositories(await listRepositories(client, profile.login), months, now, exclude)) {
      await read(fullName, result.stackRepos);
    }
  }
  await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
  const active = result.stackRepos ? ` and ${result.stackRepos.length} more active in the last ${months} months` : "";
  console.error(`wrote ${out}: ${result.repos.length} repositories${active}`);
  for (const [where, list] of Object.entries(warnings)) for (const warning of list) console.error(`warning: ${where}: ${warning}`);
});
