import type { GestaproOctokit } from "./octokit.js";
import type { Contributor, RepoMeta } from "../types.js";

export async function fetchRepoMeta(octokit: GestaproOctokit, repoFull: string): Promise<RepoMeta> {
  const [owner, name] = repoFull.split("/");

  const repoResp = await octokit.repos.get({ owner, repo: name });
  const r = repoResp.data;

  // Definitive empty-repo check: `size` is asynchronously computed and lags for minutes
  // after a fresh push. Probing /commits is authoritative — empty array or HTTP 409.
  let isEmpty = false;
  try {
    const head = await octokit.repos.listCommits({ owner, repo: name, per_page: 1 });
    isEmpty = head.data.length === 0;
  } catch (e) {
    if ((e as { status?: number }).status === 409) {
      isEmpty = true;
    } else {
      console.warn(`[repo-meta] commit probe failed for ${repoFull}: ${(e as Error).message}`);
    }
  }

  let languages: Record<string, number> = {};
  try {
    languages = (await octokit.repos.listLanguages({ owner, repo: name })).data as Record<string, number>;
  } catch (e) {
    console.warn(`[repo-meta] languages failed for ${repoFull}: ${(e as Error).message}`);
  }

  let openPrs = 0;
  try {
    const prResp = await octokit.search.issuesAndPullRequests({
      q: `repo:${repoFull} is:pr is:open`,
      per_page: 1,
    });
    openPrs = prResp.data.total_count;
  } catch (e) {
    console.warn(`[repo-meta] open PR search failed for ${repoFull}: ${(e as Error).message}`);
  }

  // GH counts PRs in `open_issues_count` — subtract for true issues.
  const openIssues = Math.max(0, (r.open_issues_count ?? 0) - openPrs);

  let contributors: Contributor[] = [];
  if (!isEmpty) {
    try {
      const cResp = await octokit.repos.listContributors({ owner, repo: name, per_page: 10, anon: "false" });
      contributors = cResp.data
        .filter((c) => !!c.login)
        .map((c) => ({
          login: c.login!,
          avatar_url: c.avatar_url ?? "",
          contributions: c.contributions ?? 0,
          html_url: c.html_url ?? `https://github.com/${c.login}`,
        }));
    } catch (e) {
      console.warn(`[repo-meta] contributors failed for ${repoFull}: ${(e as Error).message}`);
    }
  }

  return {
    owner,
    name,
    url: r.html_url,
    default_branch: r.default_branch,
    pushed_at: r.pushed_at ?? null,
    languages,
    open_issues: openIssues,
    open_prs: openPrs,
    contributors,
    size_kb: r.size ?? 0,
    is_empty: isEmpty,
  };
}
