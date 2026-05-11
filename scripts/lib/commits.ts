import type { GestaproOctokit } from "./octokit.js";
import type { CommitRef } from "../types.js";

export async function fetchRecentCommits(
  octokit: GestaproOctokit,
  repoFull: string,
  defaultBranch: string,
  limit = 30,
): Promise<CommitRef[]> {
  const [owner, name] = repoFull.split("/");
  try {
    const resp = await octokit.repos.listCommits({
      owner,
      repo: name,
      sha: defaultBranch,
      per_page: limit,
    });
    return resp.data.map((c) => ({
      sha: c.sha,
      short_sha: c.sha.slice(0, 7),
      author: c.commit.author?.name ?? c.author?.login ?? "unknown",
      author_avatar_url: c.author?.avatar_url ?? null,
      date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
      message: (c.commit.message ?? "").split("\n")[0].slice(0, 200),
      url: c.html_url,
    }));
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 409) return [];     // empty repo
    console.warn(`[commits] failed for ${repoFull}: ${(e as Error).message}`);
    return [];
  }
}
