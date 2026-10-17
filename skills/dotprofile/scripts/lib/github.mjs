import { execFileSync } from "node:child_process";
import { MANIFESTS } from "./manifests.mjs";
import { optional } from "./facts.mjs";

const API = "https://api.github.com";
const PAGE_SIZE = 100;
/** GitHub answers 409 Conflict for the git endpoints of an empty repository. */
const EMPTY_REPOSITORY = 409;

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "GitHubError";
    this.status = status;
  }
}

/**
 * The token to read GitHub with: GH_TOKEN or GITHUB_TOKEN, else the one of the GitHub CLI.
 * Undefined when there is none: only public data can then be read, at 60 requests per hour.
 */
export function resolveToken(env = process.env) {
  const fromEnv = env.GH_TOKEN?.trim() || env.GITHUB_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/** `rel` → page number, from a `Link` response header. */
export function linkPages(header) {
  const pages = new Map();
  for (const match of (header ?? "").matchAll(/<([^>]+)>;\s*rel="(\w+)"/g)) {
    const page = Number(new URL(match[1]).searchParams.get("page"));
    if (Number.isInteger(page)) pages.set(match[2], page);
  }
  return pages;
}

/** A read-only GitHub REST client: it only ever sends GET requests. */
export function createClient({ token, fetch: fetchImpl = globalThis.fetch } = {}) {
  const request = async (path, accept, allowed = []) => {
    const headers = { accept, "user-agent": "dotprofile-skill", "x-github-api-version": "2022-11-28" };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetchImpl(`${API}${path}`, { headers });
    if (!response.ok && !allowed.includes(response.status)) {
      const limited = response.status === 403 || response.status === 429 ? response.headers.get("x-ratelimit-remaining") === "0" : false;
      throw new GitHubError(
        response.status,
        limited
          ? "GitHub rate limit reached: wait for the reset or sign in (GH_TOKEN, or gh auth login)."
          : `GitHub answered ${response.status} for GET ${path}`,
      );
    }
    return response;
  };
  return {
    authenticated: Boolean(token),
    async getJson(path, allowed) {
      const response = await request(path, "application/vnd.github+json", allowed);
      const body = response.ok ? await response.json() : undefined;
      return { status: response.status, body, link: response.headers.get("link") };
    },
    async getRaw(path) {
      return (await request(path, "application/vnd.github.raw+json")).text();
    },
  };
}

const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined);
const count = (value) => (typeof value === "number" ? value : 0);
const repoPath = (owner, name) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

async function getAll(client, path) {
  const items = [];
  const separator = path.includes("?") ? "&" : "?";
  for (let page = 1; ; page++) {
    const response = await client.getJson(`${path}${separator}per_page=${PAGE_SIZE}&page=${page}`);
    items.push(...(Array.isArray(response.body) ? response.body : []));
    if (!linkPages(response.link).has("next")) return items;
  }
}

/** What the user wrote on their GitHub profile: these are facts written by the user. */
export async function readProfile(client, login) {
  const { body } = await client.getJson(login ? `/users/${encodeURIComponent(login)}` : "/user");
  return {
    login: body.login,
    ...optional("name", text(body.name)),
    ...optional("bio", text(body.bio)),
    ...optional("location", text(body.location)),
    ...optional("company", text(body.company)),
    ...optional("blog", text(body.blog)),
    ...optional("twitter", text(body.twitter_username)),
    publicRepos: count(body.public_repos),
    followers: count(body.followers),
    createdAt: body.created_at,
  };
}

/**
 * The repositories the user owns, most recently pushed first. Signed in as that user, private
 * ones are included; otherwise only public ones.
 */
export async function listRepositories(client, login) {
  const me = client.authenticated ? (await client.getJson("/user")).body.login : undefined;
  const repos =
    me && (!login || me.toLowerCase() === login.toLowerCase())
      ? await getAll(client, "/user/repos?affiliation=owner&sort=pushed")
      : await getAll(client, `/users/${encodeURIComponent(login)}/repos?type=owner&sort=pushed`);
  return repos.map((repo) => ({
    fullName: repo.full_name,
    ...optional("description", text(repo.description)),
    ...optional("language", text(repo.language)),
    stars: count(repo.stargazers_count),
    visibility: visibility(repo),
    ...optional("fork", repo.fork || undefined),
    ...optional("archived", repo.archived || undefined),
    ...optional("pushedAt", text(repo.pushed_at)),
  }));
}

function visibility(repo) {
  if (["public", "private", "internal"].includes(repo.visibility)) return repo.visibility;
  return repo.private ? "private" : "public";
}

/** Everything extraction needs from one repository, in about ten requests. */
export async function readSnapshot(client, fullName) {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) throw new GitHubError(400, `Not an owner/name repository: ${fullName}`);
  const base = repoPath(owner, name);
  const repo = (await client.getJson(base)).body;
  const license = repo.license ?? {};
  const metadata = {
    owner: repo.owner.login,
    name: repo.name,
    ...optional("description", text(repo.description)),
    ...optional("homepage", text(repo.homepage)),
    topics: Array.isArray(repo.topics) ? repo.topics.filter((topic) => typeof topic === "string") : [],
    // GitHub reports NOASSERTION when it found a license file but did not recognise it.
    ...optional(
      "license",
      text(license.name) && { name: text(license.name), ...optional("spdx", license.spdx_id === "NOASSERTION" ? undefined : text(license.spdx_id)) },
    ),
    stars: count(repo.stargazers_count),
    forks: count(repo.forks_count),
    visibility: visibility(repo),
    fork: repo.fork === true,
    archived: repo.archived === true,
    createdAt: repo.created_at,
    ...optional("pushedAt", text(repo.pushed_at)),
  };
  const ref = repo.default_branch;

  const treeResponse = await client.getJson(`${base}/git/trees/${encodeURIComponent(ref)}?recursive=1`, [EMPTY_REPOSITORY, 404]);
  const tree = treeResponse.status === 200
    ? {
        entries: (treeResponse.body.tree ?? []).flatMap((entry) =>
          entry.type === "blob" && typeof entry.path === "string" && typeof entry.size === "number" ? [{ path: entry.path, bytes: entry.size }] : [],
        ),
        complete: treeResponse.body.truncated !== true,
      }
    : { entries: [], complete: true };

  const present = new Set(tree.entries.map((entry) => entry.path));
  const files = new Map();
  for (const { file } of MANIFESTS) {
    if (present.has(file)) files.set(file, await client.getRaw(`${base}/contents/${encodeURIComponent(file)}?ref=${encodeURIComponent(ref)}`));
  }

  return { metadata, tree, files, history: await readHistory(client, base, ref) };
}

async function readHistory(client, base, ref) {
  const commitsPath = `${base}/commits?sha=${encodeURIComponent(ref)}&per_page=1`;
  const newest = await client.getJson(commitsPath, [EMPTY_REPOSITORY, 404]);
  const latest = Array.isArray(newest.body) ? newest.body[0] : undefined;
  const lastCommitAt = text(latest?.commit?.author?.date);
  if (lastCommitAt === undefined) return undefined;

  // With one commit per page, the number of the last page is the number of commits.
  const commitCount = linkPages(newest.link).get("last") ?? 1;
  const first = commitCount === 1 ? latest : (await client.getJson(`${commitsPath}&page=${commitCount}`)).body?.[0];
  const firstCommitAt = text(first?.commit?.author?.date);
  if (firstCommitAt === undefined) throw new GitHubError(502, "GitHub returned a commit without an author date.");

  const contributors = await getAll(client, `${base}/contributors`);
  // The last commit shown is the newest that is not a merge: a merge says little about the work.
  const recent = (await client.getJson(`${base}/commits?sha=${encodeURIComponent(ref)}&per_page=10`)).body ?? [];
  const lastWork = recent.find((commit) => (commit.parents?.length ?? 0) <= 1);
  const subject = text(lastWork?.commit?.message?.split("\n")[0]);
  return {
    commitCount,
    firstCommitAt,
    lastCommitAt,
    contributors: contributors.map((contributor) => ({ bot: contributor.type === "Bot" })),
    ...optional("lastCommit", subject && { sha: lastWork.sha.slice(0, 7), subject, at: lastWork.commit.author.date }),
  };
}
