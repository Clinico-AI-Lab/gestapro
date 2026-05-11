import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function writeJSON(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, path);
}
