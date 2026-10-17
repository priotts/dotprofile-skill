import { readFile } from "node:fs/promises";

/**
 * dotprofile.json holds the CHOICES, not the result: which repositories in which order, the
 * style, and the texts. Regenerating from it gives the same files.
 *
 * A text is either a string (written by Claude from the facts, and checked against them) or
 * `{ "text": "...", "by": "user" }` (written or confirmed by the user: not checked).
 */
export async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`${path} not found`);
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

export const textOf = (value) => (typeof value === "string" ? value : value?.text);
export const isUserWritten = (value) => typeof value === "object" && value?.by === "user";

/** Joins the configuration with the facts. Throws with a clear message on any inconsistency. */
export function resolve(config, factsFile) {
  if (!Array.isArray(config.repos)) throw new Error("dotprofile.json: repos must be a list");
  const byName = new Map(factsFile.repos.map((facts) => [facts.fullName.toLowerCase(), facts]));
  const repos = config.repos.map((entry) => {
    const key = (typeof entry === "string" ? entry : entry.repo)?.toLowerCase();
    const facts = byName.get(key);
    if (!facts) throw new Error(`dotprofile.json lists ${key}, which is not in the facts: extract it first`);
    return { facts, description: textOf(entry.description) ?? facts.description, entry };
  });
  return { profile: factsFile.profile, repos, bio: textOf(config.bio), tagline: textOf(config.tagline) };
}
