import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjects } from "./lib/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

try {
  const projects = loadProjects(join(ROOT, "projects"));
  console.log(`OK — ${projects.length} project YAML(s) valid: ${projects.map((p) => p.slug).join(", ")}`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
