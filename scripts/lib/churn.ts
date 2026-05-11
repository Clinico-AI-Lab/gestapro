import { mkdirSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import picomatch from "picomatch";
import type { ChurnConfig, ChurnNode, ChurnSnapshot } from "../types.js";

const execFileP = promisify(execFile);

interface FileChurn {
  path: string;
  adds: number;
  dels: number;
  commits: number;
  last_touched: string;
}

export async function fetchChurn(
  repoFull: string,
  defaultBranch: string,
  config: ChurnConfig,
  pat: string,
  workDir: string,
): Promise<ChurnSnapshot | null> {
  if (!config.enabled) return null;

  const [owner, name] = repoFull.split("/");
  const slug = `${owner}-${name}`.replace(/[^a-z0-9-]/gi, "-");
  const cloneDir = join(workDir, slug);

  // Clean prior run
  rmSync(cloneDir, { recursive: true, force: true });
  mkdirSync(dirname(cloneDir), { recursive: true });

  const cloneUrl = `https://x-access-token:${pat}@github.com/${repoFull}.git`;

  try {
    await execFileP("git", [
      "clone",
      "--filter=blob:none",
      "--no-checkout",
      "--single-branch",
      "--branch",
      defaultBranch,
      cloneUrl,
      cloneDir,
    ], { timeout: 120_000 });
  } catch (e) {
    console.warn(`[churn] clone failed for ${repoFull}: ${(e as Error).message}`);
    return null;
  }

  let stdout = "";
  try {
    const since = new Date(Date.now() - config.since_days * 24 * 60 * 60 * 1000).toISOString();
    const result = await execFileP(
      "git",
      [
        "-C",
        cloneDir,
        "log",
        `--since=${since}`,
        "--no-merges",
        "--pretty=format:COMMIT|%H|%ct|%an",
        "--numstat",
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 },
    );
    stdout = result.stdout;
  } catch (e) {
    console.warn(`[churn] git log failed for ${repoFull}: ${(e as Error).message}`);
    rmSync(cloneDir, { recursive: true, force: true });
    return null;
  }

  const isExcluded = picomatch(config.exclude_paths, { dot: true });

  const fileMap = new Map<string, FileChurn>();
  let totalCommits = 0;
  let currentCommitTs = 0;

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("COMMIT|")) {
      const parts = line.split("|");
      currentCommitTs = Number(parts[2]) || 0;
      totalCommits++;
      continue;
    }
    // numstat: adds<TAB>dels<TAB>path  (path may contain " => " for renames)
    const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    const adds = m[1] === "-" ? 0 : Number(m[1]);
    const dels = m[2] === "-" ? 0 : Number(m[2]);
    let path = m[3];
    // handle renames: "old => new" OR "{prefix/{old => new}/suffix}"
    if (path.includes(" => ")) {
      const renameMatch = path.match(/\{(.+?) => (.+?)\}/);
      if (renameMatch) {
        path = path.replace(/\{.+? => (.+?)\}/, "$1");
      } else {
        path = path.split(" => ")[1];
      }
    }
    if (isExcluded(path)) continue;

    const existing = fileMap.get(path);
    const isoDate = currentCommitTs ? new Date(currentCommitTs * 1000).toISOString() : "";
    if (existing) {
      existing.adds += adds;
      existing.dels += dels;
      existing.commits += 1;
      if (isoDate > existing.last_touched) existing.last_touched = isoDate;
    } else {
      fileMap.set(path, { path, adds, dels, commits: 1, last_touched: isoDate });
    }
  }

  rmSync(cloneDir, { recursive: true, force: true });

  // Cap to top 500 by churn
  const allFiles = Array.from(fileMap.values()).map((f) => ({
    ...f,
    churn: f.adds + f.dels,
  }));
  allFiles.sort((a, b) => b.churn - a.churn);
  const top = allFiles.slice(0, 500);

  const totals = top.reduce(
    (acc, f) => {
      acc.adds += f.adds;
      acc.dels += f.dels;
      return acc;
    },
    { files: top.length, commits: totalCommits, adds: 0, dels: 0 },
  );

  return {
    since: new Date(Date.now() - config.since_days * 24 * 60 * 60 * 1000).toISOString(),
    totals,
    tree: buildTree(top),
  };
}

function buildTree(files: Array<FileChurn & { churn: number }>): ChurnNode {
  const root: ChurnNode = { name: "<root>", churn: 0, adds: 0, dels: 0, commits: 0, children: [] };

  for (const f of files) {
    const parts = f.path.split("/");
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      const isLeaf = i === parts.length - 1;
      cursor.children ??= [];
      let child = cursor.children.find((c) => c.name === seg);
      if (!child) {
        child = isLeaf
          ? {
              name: seg,
              path: f.path,
              churn: f.churn,
              adds: f.adds,
              dels: f.dels,
              commits: f.commits,
              last_touched: f.last_touched,
            }
          : { name: seg, churn: 0, adds: 0, dels: 0, commits: 0, children: [] };
        cursor.children.push(child);
      } else if (isLeaf) {
        child.churn += f.churn;
        child.adds += f.adds;
        child.dels += f.dels;
        child.commits += f.commits;
        if (f.last_touched > (child.last_touched ?? "")) child.last_touched = f.last_touched;
      }
      cursor = child;
    }
  }

  // Roll-up dir churn from leaves
  const rollup = (node: ChurnNode): { churn: number; adds: number; dels: number; commits: number } => {
    if (!node.children || node.children.length === 0) {
      return { churn: node.churn, adds: node.adds, dels: node.dels, commits: node.commits };
    }
    let c = 0, a = 0, d = 0, k = 0;
    for (const child of node.children) {
      const r = rollup(child);
      c += r.churn; a += r.adds; d += r.dels; k += r.commits;
    }
    node.churn = c; node.adds = a; node.dels = d; node.commits = k;
    return { churn: c, adds: a, dels: d, commits: k };
  };
  rollup(root);

  return root;
}
