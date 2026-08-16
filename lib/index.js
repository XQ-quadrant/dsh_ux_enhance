/**
 * dsh-session-color — host half.
 *
 * Watches the plugin directory and writes lib/workspace-tree.json on every
 * change. The browser half polls that JSON to keep the workspace panel fresh.
 */
import { watch } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = path.join(root, "lib", "workspace-tree.json");
const skipDirs = new Set(["node_modules", ".git", "dist", "build", "coverage", ".DS_Store"]);
const maxDepth = 5;

async function walk(dir, depth) {
  const name = path.basename(dir) || dir;
  const node = { name, path: dir, type: "directory", children: [] };
  if (depth >= maxDepth) return node;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return node;
  }
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (skipDirs.has(entry.name)) continue;
    if (entry.name === "workspace-tree.json") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      node.children.push(await walk(full, depth + 1));
    } else {
      node.children.push({ name: entry.name, path: full, type: "file" });
    }
  }
  return node;
}

let writeTimer = null;
let latestTree = null;

async function writeTree() {
  try {
    const tree = await walk(root, 0);
    latestTree = tree;
    await writeFile(outputFile, JSON.stringify(tree, null, 2) + "\n", "utf8");
  } catch {
    /* ignore transient fs errors */
  }
}

function startLocalTreeServer() {
  const ports = [47991, 47992, 47993, 47994, 47995];
  let started = false;
  for (const port of ports) {
    const server = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname === "/tree") {
        try {
          const requestedPath = url.searchParams.get("path") || root;
          const tree = await walk(requestedPath, 0);
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(tree));
        } catch {
          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: "tree read failed" }));
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.on("error", () => { server.close(); });
    server.listen(port, "127.0.0.1", () => {
      if (started) return;
      started = true;
      console.log(`[dsh-session-color] file tree server listening on http://127.0.0.1:${port}/tree`);
    });
  }
}

function apply() {
  void writeTree();
  startLocalTreeServer();
  try {
    const watcher = watch(root, { recursive: true }, (_event, filename) => {
      if (filename && filename.includes("workspace-tree.json")) return;
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => { void writeTree(); }, 500);
    });
    watcher.unref?.();
  } catch {
    // Recursive watch is not available on this platform; the browser will keep
    // polling the last written tree (or fall back to the embedded tree).
  }
}

export { apply };
