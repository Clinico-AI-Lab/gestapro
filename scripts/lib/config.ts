import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import type { ProjectConfig } from "../types.js";

const linkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

const headlineSchema = z.object({
  label: z.string().min(1),
  source: z.enum(["manual", "issues_count", "commits_count"]),
  value: z.union([z.number(), z.string()]).optional(),
});

const labelMapSchema = z.object({
  todo: z.array(z.string()).default([]),
  in_progress: z.array(z.string()).default([]),
  done: z.array(z.string()).default([]),
});

const todosSchema = z.object({
  enabled: z.boolean().default(false),
  label_map: labelMapSchema.default({ todo: [], in_progress: [], done: [] }),
  ignore_labels: z.array(z.string()).default([]),
});

const churnSchema = z.object({
  enabled: z.boolean().default(false),
  since_days: z.number().int().positive().default(365),
  exclude_paths: z.array(z.string()).default([]),
});

const projectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "slug must be kebab-case"),
  repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repo must be owner/name"),
  title: z.string().min(1),
  description: z.string().min(1),
  owner: z.string().min(1),
  status: z.enum(["active", "paused", "archived", "planning"]),
  tags: z.array(z.string()).default([]),
  headline_metric: headlineSchema,
  created_at: z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
    z.string(),
  ),
  links: z.array(linkSchema).default([]),
  todos: todosSchema,
  churn: churnSchema,
});

export type ProjectSchemaInput = z.input<typeof projectSchema>;

export function loadProjects(projectsDir: string): ProjectConfig[] {
  const files = readdirSync(projectsDir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();

  const projects: ProjectConfig[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const fullPath = join(projectsDir, file);
    try {
      const raw = yaml.load(readFileSync(fullPath, "utf8"));
      const parsed = projectSchema.parse(raw);
      // file name must match slug
      const baseSlug = file.replace(/\.ya?ml$/, "");
      if (parsed.slug !== baseSlug) {
        errors.push(`${file}: slug "${parsed.slug}" does not match filename "${baseSlug}"`);
        continue;
      }
      projects.push(parsed as ProjectConfig);
    } catch (err) {
      if (err instanceof z.ZodError) {
        errors.push(`${file}: ${err.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      } else {
        errors.push(`${file}: ${(err as Error).message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Project YAML validation failed:\n  - ${errors.join("\n  - ")}`);
  }

  const slugs = new Set<string>();
  for (const p of projects) {
    if (slugs.has(p.slug)) throw new Error(`Duplicate slug: ${p.slug}`);
    slugs.add(p.slug);
  }

  return projects;
}
