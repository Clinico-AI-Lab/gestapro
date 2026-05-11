import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { loadProjects } from "./lib/config.js";
import { makeOctokit } from "./lib/octokit.js";
import { fetchRepoMeta } from "./lib/repo-meta.js";
import { fetchRecentCommits } from "./lib/commits.js";
import { fetchCommitActivity } from "./lib/activity.js";
import { fetchTodos } from "./lib/issues.js";
import { fetchChurn } from "./lib/churn.js";
import { aggregate } from "./lib/aggregate.js";
import { writeJSON } from "./lib/write-snapshot.js";
import type { ProjectConfig, ProjectSnapshot } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

function loadDotenvFallback() {
  // Minimal .env loader (avoid extra dep). Reads KEY=VAL lines.
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotenvFallback();

const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;

async function fetchProject(
  octokit: ReturnType<typeof makeOctokit>,
  pat: string,
  config: ProjectConfig,
  workDir: string,
): Promise<ProjectSnapshot> {
  const warnings: string[] = [];
  const repoMeta = await fetchRepoMeta(octokit, config.repo);

  if (repoMeta.is_empty) {
    return {
      slug: config.slug,
      title: config.title,
      description: config.description,
      status: config.status,
      tags: config.tags,
      links: config.links,
      headline_metric: resolveHeadlineMetric(config.headline_metric, 0, 0),
      status_data: "empty",
      repo: repoMeta,
      activity: { weeks: [] },
      commits: [],
      todos: { todo: [], in_progress: [], done: [] },
      churn: null,
      _generated_at: new Date().toISOString(),
      _warnings: ["repo is empty (no commits)"],
    };
  }

  const [activityRes, commits, todos, churn] = await Promise.all([
    fetchCommitActivity(octokit, config.repo),
    fetchRecentCommits(octokit, config.repo, repoMeta.default_branch),
    config.todos.enabled
      ? fetchTodos(octokit, config.repo, config.todos.label_map, config.todos.ignore_labels)
      : Promise.resolve({ todo: [], in_progress: [], done: [] }),
    fetchChurn(config.repo, repoMeta.default_branch, config.churn, pat, workDir),
  ]);

  if (activityRes.warning) warnings.push(`activity: ${activityRes.warning}`);

  const commitsTotal = activityRes.weeks.reduce((a, w) => a + w.total, 0);
  return {
    slug: config.slug,
    title: config.title,
    description: config.description,
    status: config.status,
    tags: config.tags,
    links: config.links,
    headline_metric: resolveHeadlineMetric(config.headline_metric, repoMeta.open_issues, commitsTotal),
    status_data: "ok",
    repo: repoMeta,
    activity: { weeks: activityRes.weeks },
    commits,
    todos,
    churn,
    _generated_at: new Date().toISOString(),
    _warnings: warnings,
  };
}

function resolveHeadlineMetric(
  spec: ProjectConfig["headline_metric"],
  openIssues: number,
  commits52w: number,
) {
  if (spec.source === "issues_count") {
    return { ...spec, value: openIssues };
  }
  if (spec.source === "commits_count") {
    return { ...spec, value: commits52w };
  }
  return spec;
}

async function main() {
  const pat = process.env.PROJECTS_PAT;
  if (!pat) {
    console.error("ERROR: PROJECTS_PAT env var not set. Mint a fine-grained PAT (Contents:Read, Metadata:Read, Issues:Read) and `export PROJECTS_PAT=...` or add to .env");
    process.exit(2);
  }

  const projectsDir = join(ROOT, "projects");
  const allProjects = loadProjects(projectsDir);
  const projects = onlyArg ? allProjects.filter((p) => p.slug === onlyArg) : allProjects;
  if (onlyArg && projects.length === 0) {
    console.error(`ERROR: --only=${onlyArg} matched no project`);
    process.exit(2);
  }

  console.log(`[fetch] loaded ${projects.length} project(s): ${projects.map((p) => p.slug).join(", ")}`);

  const octokit = makeOctokit(pat);
  const workDir = join(ROOT, "_work");

  const results = await Promise.allSettled(
    projects.map((p) => fetchProject(octokit, pat, p, workDir)),
  );

  const snapshots: ProjectSnapshot[] = [];
  for (let i = 0; i < projects.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      snapshots.push(r.value);
      console.log(`[fetch] OK ${projects[i].slug}`);
    } else {
      console.error(`[fetch] FAIL ${projects[i].slug}: ${(r.reason as Error)?.message ?? r.reason}`);
    }
  }

  for (const s of snapshots) {
    const out = join(ROOT, "src/data/projects", `${s.slug}.json`);
    writeJSON(out, s);
    console.log(`[fetch] wrote ${out}`);
  }

  // Only rewrite the index/totals if we did a full run (avoid corrupting index on --only).
  if (!onlyArg) {
    writeJSON(join(ROOT, "src/data/index.json"), aggregate(snapshots));
    writeJSON(join(ROOT, "src/data/generated-at.json"), {
      generated_at: new Date().toISOString(),
      commit_sha: process.env.GITHUB_SHA ?? null,
    });
    console.log(`[fetch] wrote index.json + generated-at.json`);
  }

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0 && failed === projects.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
