import type { GestaproOctokit } from "./octokit.js";
import type { IssueRef, LabelMap, TodoBuckets } from "../types.js";

function lc(s: string): string {
  return s.toLowerCase().trim();
}

function matchBucket(labels: string[], map: LabelMap): keyof TodoBuckets | null {
  const lcLabels = new Set(labels.map(lc));
  for (const target of ["todo", "in_progress", "done"] as const) {
    for (const candidate of map[target]) {
      if (lcLabels.has(lc(candidate))) return target;
    }
  }
  return null;
}

export async function fetchTodos(
  octokit: GestaproOctokit,
  repoFull: string,
  labelMap: LabelMap,
  ignoreLabels: string[],
): Promise<TodoBuckets> {
  const [owner, name] = repoFull.split("/");
  const buckets: TodoBuckets = { todo: [], in_progress: [], done: [] };
  const ignore = new Set(ignoreLabels.map(lc));

  try {
    const allLabels = Array.from(new Set([...labelMap.todo, ...labelMap.in_progress, ...labelMap.done]));

    // Open issues with relevant labels OR all open if no labels configured (fetcher decides)
    const openIter = octokit.paginate.iterator(octokit.issues.listForRepo, {
      owner,
      repo: name,
      state: "open",
      per_page: 100,
      labels: allLabels.length > 0 ? allLabels.join(",") : undefined,
    });

    for await (const page of openIter) {
      for (const it of page.data) {
        if (it.pull_request) continue;
        const labels = (it.labels ?? [])
          .map((l) => (typeof l === "string" ? l : l.name ?? ""))
          .filter(Boolean);
        if (labels.some((l) => ignore.has(lc(l)))) continue;
        const bucket = matchBucket(labels, labelMap);
        if (!bucket) continue;
        const ref: IssueRef = {
          number: it.number,
          title: it.title,
          url: it.html_url,
          labels,
          updated_at: it.updated_at,
          state: "open",
        };
        buckets[bucket].push(ref);
      }
    }

    // Closed "done" issues (last 90d only — keep dashboard light)
    if (labelMap.done.length > 0) {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const closedIter = octokit.paginate.iterator(octokit.issues.listForRepo, {
        owner,
        repo: name,
        state: "closed",
        per_page: 100,
        labels: labelMap.done.join(","),
        since,
      });
      for await (const page of closedIter) {
        for (const it of page.data) {
          if (it.pull_request) continue;
          const labels = (it.labels ?? [])
            .map((l) => (typeof l === "string" ? l : l.name ?? ""))
            .filter(Boolean);
          if (labels.some((l) => ignore.has(lc(l)))) continue;
          buckets.done.push({
            number: it.number,
            title: it.title,
            url: it.html_url,
            labels,
            updated_at: it.updated_at,
            state: "closed",
          });
        }
      }
    }
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status !== 404 && status !== 409) {
      console.warn(`[issues] ${repoFull} failed: ${(e as Error).message}`);
    }
  }

  return buckets;
}
