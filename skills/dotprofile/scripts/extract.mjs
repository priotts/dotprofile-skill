#!/usr/bin/env node
/**
 * Reads repositories through the GitHub API (GET requests only).
 *
 *   node extract.mjs list [--user <login>]
 *       The repositories the user owns, most recently pushed first, as JSON.
 *   node extract.mjs facts [<owner/repo>...] [--all] [--user <login>] [--out facts.json]
 *       The facts of each repository plus the user's profile, written to facts.json. With no
 *       repository, only the profile. With --all, also every other repository the user owns
 *       that is not a fork, not archived and was pushed to in the last year: the source of
 *       `"stack": "all"`.
 *
 * Token: GH_TOKEN or GITHUB_TOKEN, else `gh auth token`. Without one only public data is read.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs, run } from "./lib/args.mjs";
import { extractFacts } from "./lib/facts.mjs";
import { ACTIVE_DAYS } from "./lib/config.mjs";
import { createClient, listRepositories, readProfile, readSnapshot, resolveToken } from "./lib/github.mjs";

run(async (argv) => {
  const { options, positional } = parseArgs(argv, ["all"]);
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
    throw new Error("usage: extract.mjs list [--user <login>] | extract.mjs facts <owner/repo>... [--all] [--user <login>] [--out facts.json]");
  }

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
  if (options.all) {
    const since = now.getTime() - ACTIVE_DAYS * 86_400_000;
    const listed = new Set(repos.map((fullName) => fullName.toLowerCase()));
    for (const repo of await listRepositories(client, profile.login)) {
      const recent = repo.pushedAt !== undefined && Date.parse(repo.pushedAt) >= since;
      if (!repo.fork && !repo.archived && recent && !listed.has(repo.fullName.toLowerCase())) repos.push(repo.fullName);
    }
  }
  const result = { extractedAt: now.toISOString(), profile, repos: [], warnings };
  for (const fullName of repos) {
    console.error(`reading ${fullName}…`);
    const extraction = extractFacts(await readSnapshot(client, fullName), now);
    result.repos.push(extraction.facts);
    if (extraction.warnings.length > 0) warnings[extraction.facts.fullName] = extraction.warnings;
  }
  await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
  console.error(`wrote ${out}: ${result.repos.length} repositories`);
  for (const [where, list] of Object.entries(warnings)) for (const warning of list) console.error(`warning: ${where}: ${warning}`);
});
