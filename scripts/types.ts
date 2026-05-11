export type ProjectStatus = "active" | "paused" | "archived" | "planning";

export type HeadlineMetricSource = "manual" | "issues_count" | "commits_count";

export interface ProjectLink {
  label: string;
  url: string;
}

export interface HeadlineMetric {
  label: string;
  source: HeadlineMetricSource;
  value?: number | string;
}

export interface LabelMap {
  todo: string[];
  in_progress: string[];
  done: string[];
}

export interface TodosConfig {
  enabled: boolean;
  label_map: LabelMap;
  ignore_labels: string[];
}

export interface ChurnConfig {
  enabled: boolean;
  since_days: number;
  exclude_paths: string[];
}

export interface ProjectConfig {
  slug: string;
  repo: string;            // "owner/name"
  title: string;
  description: string;
  owner: string;
  status: ProjectStatus;
  tags: string[];
  headline_metric: HeadlineMetric;
  created_at: string;
  links: ProjectLink[];
  todos: TodosConfig;
  churn: ChurnConfig;
}

export interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

export interface RepoMeta {
  owner: string;
  name: string;
  url: string;
  default_branch: string;
  pushed_at: string | null;
  languages: Record<string, number>;
  open_issues: number;
  open_prs: number;
  contributors: Contributor[];
  size_kb: number;
  is_empty: boolean;
}

export interface ActivityWeek {
  week: number;             // unix timestamp (seconds) for Sunday of that week
  total: number;
  days: number[];           // length 7, Sun..Sat
}

export interface CommitRef {
  sha: string;
  short_sha: string;
  author: string;
  author_avatar_url: string | null;
  date: string;
  message: string;
  url: string;
}

export interface IssueRef {
  number: number;
  title: string;
  url: string;
  labels: string[];
  updated_at: string;
  state: "open" | "closed";
}

export interface TodoBuckets {
  todo: IssueRef[];
  in_progress: IssueRef[];
  done: IssueRef[];
}

export interface ChurnNode {
  name: string;             // path segment OR file name OR "<root>"
  path?: string;            // full path for leaves
  churn: number;            // adds + dels
  adds: number;
  dels: number;
  commits: number;
  last_touched?: string;    // ISO date
  children?: ChurnNode[];
}

export interface ChurnSnapshot {
  since: string;
  totals: { files: number; commits: number; adds: number; dels: number };
  tree: ChurnNode;
}

export interface ProjectSnapshot {
  slug: string;
  title: string;
  description: string;
  status: ProjectStatus;
  tags: string[];
  links: ProjectLink[];
  headline_metric: HeadlineMetric;
  status_data: "ok" | "empty" | "error";
  repo: RepoMeta;
  activity: { weeks: ActivityWeek[] };
  commits: CommitRef[];
  todos: TodoBuckets;
  churn: ChurnSnapshot | null;
  _generated_at: string;
  _warnings: string[];
}

export interface IndexSnapshot {
  generated_at: string;
  projects: Array<{
    slug: string;
    title: string;
    status: ProjectStatus;
    tags: string[];
    pushed_at: string | null;
    open_issues: number;
    open_prs: number;
    languages_top: string | null;
    headline_metric: HeadlineMetric;
    sparkline_12w: number[];     // 12 weekly totals (recent first? no — chronological)
    description: string;
  }>;
  totals: {
    repo_count: number;
    commits_52w: number;
    open_todos: number;
    languages: Record<string, number>;
  };
  weekly_stack: Array<{
    week: number;             // unix sec
    per_project: Record<string, number>;
    total: number;
  }>;
  recent_activity: CommitRef_WithSlug[];
}

export interface CommitRef_WithSlug extends CommitRef {
  project_slug: string;
  project_title: string;
}
