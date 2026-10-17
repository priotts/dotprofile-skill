import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient, linkPages, readSnapshot, resolveToken } from "../skills/dotprofile/scripts/lib/github.mjs";

/** A fetch that answers from a table of paths, and records every request. */
function fakeGitHub(routes) {
  const requests = [];
  const fetch = async (url, init) => {
    const path = url.replace("https://api.github.com", "");
    requests.push({ path, method: init.method ?? "GET", headers: init.headers });
    const route = routes[path];
    const status = route?.status ?? (route ? 200 : 404);
    const headers = new Map(Object.entries(route?.headers ?? {}));
    return {
      ok: status < 300,
      status,
      headers: { get: (name) => headers.get(name) ?? null },
      json: async () => route?.body,
      text: async () => route?.body,
    };
  };
  return { fetch, requests };
}

const commit = (sha, message, date, parents = 1) => ({ sha, commit: { message, author: { date } }, parents: Array(parents).fill({}) });
const base = "/repos/octocat/linkcheck";

test("reads a repository with GET requests only", async () => {
  const { fetch, requests } = fakeGitHub({
    [base]: {
      body: {
        owner: { login: "octocat" }, name: "linkcheck", description: "Checks links", topics: ["cli"],
        license: { name: "Other", spdx_id: "NOASSERTION" }, stargazers_count: 2, forks_count: 1,
        visibility: "public", created_at: "2026-01-01T00:00:00Z", pushed_at: "2026-10-01T00:00:00Z", default_branch: "main",
      },
    },
    [`${base}/git/trees/main?recursive=1`]: { body: { truncated: false, tree: [{ type: "blob", path: "package.json", size: 10 }, { type: "tree", path: "src" }] } },
    [`${base}/contents/package.json?ref=main`]: { body: '{"dependencies":{}}' },
    [`${base}/commits?sha=main&per_page=1`]: {
      body: [commit("fffffff0000", "Merge pull request #2", "2026-10-01T00:00:00Z", 2)],
      headers: { link: `<https://api.github.com${base}/commits?sha=main&per_page=1&page=2>; rel="next", <https://api.github.com${base}/commits?sha=main&per_page=1&page=7>; rel="last"` },
    },
    [`${base}/commits?sha=main&per_page=1&page=7`]: { body: [commit("aaaaaaa0000", "Initial commit", "2026-01-01T00:00:00Z")] },
    [`${base}/contributors?per_page=100&page=1`]: { body: [{ type: "User" }, { type: "Bot" }] },
    [`${base}/commits?sha=main&per_page=10`]: {
      body: [commit("fffffff0000", "Merge pull request #2", "2026-10-01T00:00:00Z", 2), commit("bbbbbbb0000", "Follow redirects\n\nBody", "2026-09-30T00:00:00Z")],
    },
  });
  const snapshot = await readSnapshot(createClient({ token: "t", fetch }), "octocat/linkcheck");

  assert.ok(requests.every((request) => request.method === "GET"));
  assert.equal(requests[0].headers.authorization, "Bearer t");
  assert.deepEqual(snapshot.metadata.license, { name: "Other" });
  assert.deepEqual(snapshot.tree.entries, [{ path: "package.json", bytes: 10 }]);
  assert.equal(snapshot.files.get("package.json"), '{"dependencies":{}}');
  assert.equal(snapshot.history.commitCount, 7);
  assert.equal(snapshot.history.firstCommitAt, "2026-01-01T00:00:00Z");
  assert.deepEqual(snapshot.history.lastCommit, { sha: "bbbbbbb", subject: "Follow redirects", at: "2026-09-30T00:00:00Z" });
});

test("parses Link headers", () => {
  const pages = linkPages('<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"');
  assert.deepEqual([...pages], [["next", 2], ["last", 9]]);
  assert.equal(linkPages(null).size, 0);
});

test("takes the token from the environment first", () => {
  assert.equal(resolveToken({ GH_TOKEN: " abc " }), "abc");
  assert.equal(resolveToken({ GITHUB_TOKEN: "def" }), "def");
});
