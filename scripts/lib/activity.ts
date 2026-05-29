import type { GestaproOctokit } from "./octokit.js";
import type { ActivityWeek } from "../types.js";

interface FetchActivityResult {
  weeks: ActivityWeek[];
  warning?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * /stats/commit_activity returns 202 on first call (GH computes lazily).
 * Retry with backoff: 10s, 20s, 40s, 80s, 160s. Give up after 5 attempts.
 */
export async function fetchCommitActivity(
  octokit: GestaproOctokit,
  repoFull: string,
): Promise<FetchActivityResult> {
  const [owner, name] = repoFull.split("/");
  // Tightened from 5→3 retries: the git-log path in scripts/lib/churn.ts handles
  // every churn-enabled repo. This fallback only fires for churn-disabled non-empty
  // repos (none in the current project set).
  const delays = [10_000, 20_000, 40_000];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const resp = await octokit.repos.getCommitActivityStats({ owner, repo: name });
      // 202 returns empty/no body. octokit may return {status:202, data:undefined or []}.
      if (resp.status === 202 || !resp.data || (Array.isArray(resp.data) && resp.data.length === 0)) {
        console.warn(`[activity] ${repoFull} returned ${resp.status}, retrying in ${delays[attempt] / 1000}s (attempt ${attempt + 1}/${delays.length})`);
        await sleep(delays[attempt]);
        continue;
      }
      const weeks: ActivityWeek[] = (resp.data as Array<{ week: number; total: number; days: number[] }>)
        .map((w) => ({ week: w.week, total: w.total, days: w.days, adds: 0, dels: 0 }));
      return { weeks };
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 202) {
        await sleep(delays[attempt]);
        continue;
      }
      if (status === 409) {
        return { weeks: [], warning: "repo is empty (409)" };
      }
      console.warn(`[activity] ${repoFull} error: ${(e as Error).message}`);
      return { weeks: [], warning: `error: ${(e as Error).message}` };
    }
  }
  return {
    weeks: [],
    warning: `commit_activity still 202 after ${delays.length} retries — stats not yet computed by GitHub; will populate on next run`,
  };
}
