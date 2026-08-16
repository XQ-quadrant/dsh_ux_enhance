/**
 * List the local folder structure as JSON.
 *
 * Usage:
 *   node scripts/list-files.mjs [directory] [maxDepth]
 *
 * Examples:
 *   node scripts/list-files.mjs
 *   node scripts/list-files.mjs D:\workspace\DSH\dsh-session-color 4
 *
 * The script prints a JSON tree to stdout. It skips common heavy/hidden
 * directories (node_modules, .git, dist, build) and hidden entries.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";

const target = path.resolve(process.argv[2] || process.cwd());
const maxDepth = Number(process.argv[3] || 5);
const skipDirs = new Set(["node_modules", ".git", "dist", "build", "coverage", ".DS_Store"]);

/**
 * @param {string} dir
 * @param {number} depth
 * @returns {Promise<{ name: string; path: string; type: 'directory'|'file'; children?: object[] }>}
 */
async function walk(dir, depth) {
  const name = path.basename(dir) || dir;
  const node = { name, path: dir, type: "directory", children: [] };
  if (depth >= maxDepth) return node;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { name, path: dir, type: "directory", children: [] };
  }

  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      node.children.push(await walk(full, depth + 1));
    } else {
      node.children.push({ name: entry.name, path: full, type: "file" });
    }
  }
  return node;
}

const tree = await walk(target, 0);
process.stdout.write(JSON.stringify(tree, null, 2) + "\n");

