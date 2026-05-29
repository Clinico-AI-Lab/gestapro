import type {
  CommitRef_WithSlug,
  IndexSnapshot,
  ProjectSnapshot,
} from "../types.js";

export function aggregate(snapshots: ProjectSnapshot[]): IndexSnapshot {
  const now = new Date().toISOString();

  const totalsLanguages: Record<string, number> = {};
  let totalCommits52w = 0;
  let totalAdds52w = 0;
  let totalDels52w = 0;
  let openTodos = 0;
  const recent: CommitRef_WithSlug[] = [];

  for (const s of snapshots) {
    for (const [lang, bytes] of Object.entries(s.repo.languages ?? {})) {
      totalsLanguages[lang] = (totalsLanguages[lang] ?? 0) + bytes;
    }
    totalCommits52w += s.activity.weeks.reduce((a, w) => a + w.total, 0);
    totalAdds52w += s.activity.weeks.reduce((a, w) => a + (w.adds ?? 0), 0);
    totalDels52w += s.activity.weeks.reduce((a, w) => a + (w.dels ?? 0), 0);
    openTodos += s.todos.todo.length + s.todos.in_progress.length;
    for (const c of s.commits.slice(0, 10)) {
      recent.push({ ...c, project_slug: s.slug, project_title: s.title });
    }
  }
  recent.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  // Lab-wide code-flow: sum adds/dels per week across projects, last 52 weeks.
  const flowSet = new Map<number, { adds: number; dels: number }>();
  for (const s of snapshots) {
    for (const w of s.activity.weeks) {
      const row = flowSet.get(w.week) ?? { adds: 0, dels: 0 };
      row.adds += w.adds ?? 0;
      row.dels += w.dels ?? 0;
      flowSet.set(w.week, row);
    }
  }
  const codeFlow = Array.from(flowSet.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-52)
    .map(([week, v]) => ({ week, adds: v.adds, dels: v.dels }));

  // Cross-project weekly stack: last 12 weeks aligned by week.week timestamp.
  // Collect every unique week ts from any project, sort desc, take last 12.
  const weekSet = new Map<number, Record<string, number>>();
  for (const s of snapshots) {
    for (const w of s.activity.weeks) {
      const row = weekSet.get(w.week) ?? {};
      row[s.slug] = (row[s.slug] ?? 0) + w.total;
      weekSet.set(w.week, row);
    }
  }
  const weeklyAll = Array.from(weekSet.entries()).sort((a, b) => a[0] - b[0]);
  const weeklyLast12 = weeklyAll.slice(-12);
  const weeklyStack = weeklyLast12.map(([week, per_project]) => ({
    week,
    per_project,
    total: Object.values(per_project).reduce((a, b) => a + b, 0),
  }));

  return {
    generated_at: now,
    projects: snapshots.map((s) => {
      const languagesTop = topLanguage(s.repo.languages);
      const last12 = s.activity.weeks.slice(-12).map((w) => w.total);
      // pad to 12
      while (last12.length < 12) last12.unshift(0);
      return {
        slug: s.slug,
        title: s.title,
        status: s.status,
        tags: s.tags,
        pushed_at: s.repo.pushed_at,
        open_issues: s.repo.open_issues,
        open_prs: s.repo.open_prs,
        languages_top: languagesTop,
        headline_metric: s.headline_metric,
        sparkline_12w: last12,
        description: s.description,
      };
    }),
    totals: {
      repo_count: snapshots.length,
      commits_52w: totalCommits52w,
      open_todos: openTodos,
      languages: totalsLanguages,
      adds_52w: totalAdds52w,
      dels_52w: totalDels52w,
    },
    weekly_stack: weeklyStack,
    code_flow: codeFlow,
    recent_activity: recent.slice(0, 20),
  };
}

function topLanguage(langs: Record<string, number>): string | null {
  let best: string | null = null;
  let bestBytes = 0;
  for (const [k, v] of Object.entries(langs)) {
    if (v > bestBytes) { best = k; bestBytes = v; }
  }
  return best;
}
