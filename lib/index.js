/**
 * dsh_ux_enhance — host half.
 *
 * Registers one same-origin read-only route on the DSH webserver:
 *   GET /ux-enhance/tree?path=<cwd>
 * → walks that directory (files included, bounded) and returns a nested tree.
 * The browser half fetches it because the client `listDirectory` capability
 * returns directories only. Same-origin means no CORS and no extra port; the
 * route is read-only and only serves paths that exist as directories (with
 * `..` segments rejected).
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/** Services this host half needs; the loader waits for them before apply. */
const inject = ["webServer"];

const MAX_DEPTH = 5;
const MAX_CHILDREN_PER_DIR = 200;
const MAX_TOTAL_NODES = 3000;
const SKIP_DIRS = new Set([
	"node_modules", ".git", ".hg", ".svn", "dist", "build", "out",
	"coverage", ".venv", "venv", "__pycache__", ".next", ".turbo", ".cache"
]);

let nodeBudget = MAX_TOTAL_NODES;

/** Walk one directory recursively (bounded). Never throws on a sub-read failure. */
async function walk(dir, depth) {
	const node = { name: path.basename(dir) || dir, path: dir, type: "directory", children: [] };
	if (depth >= MAX_DEPTH || nodeBudget <= 0) return node;
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
	let count = 0;
	for (const entry of entries) {
		if (count >= MAX_CHILDREN_PER_DIR || nodeBudget <= 0) break;
		if (entry.name.startsWith(".")) continue;
		if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
		const full = path.join(dir, entry.name);
		nodeBudget -= 1;
		if (entry.isDirectory()) {
			node.children.push(await walk(full, depth + 1));
		} else {
			node.children.push({ name: entry.name, path: full, type: "file" });
		}
		count += 1;
	}
	return node;
}

/** Absolute path with no `..` segment — the only paths this route serves. */
function isSafePath(value) {
	if (typeof value !== "string" || value.length === 0) return false;
	if (value.split(/[\\/]/).includes("..")) return false;
	return path.isAbsolute(value);
}

function apply(ctx) {
	const ws = ctx.webServer;
	if (!ws) {
		console.warn("[ux-enhance] webServer unavailable — workspace tree route not registered; browser falls back to listDirectory");
		return;
	}
	ctx.effect(() => {
		const unregister = ws.register({
			kind: "prefix",
			path: "/ux-enhance",
			handler: async (req, res) => {
				try {
					const url = new URL(req.url || "/", "http://x");
					if (url.pathname !== "/ux-enhance/tree") {
						res.writeHead(404);
						res.end();
						return;
					}
					const target = url.searchParams.get("path") || process.cwd();
					if (!isSafePath(target)) {
						res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
						res.end(JSON.stringify({ error: "path rejected" }));
						return;
					}
					const info = await stat(target).catch(() => null);
					if (!info || !info.isDirectory()) {
						res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
						res.end(JSON.stringify({ error: "not a directory" }));
						return;
					}
					nodeBudget = MAX_TOTAL_NODES;
					const tree = await walk(target, 0);
					res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
					res.end(JSON.stringify(tree));
				} catch (error) {
					res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
					res.end(JSON.stringify({ error: error && error.message ? error.message : String(error) }));
				}
			}
		}, "ux-enhance: workspace tree route");
		return () => unregister();
	}, "ux-enhance: host tree server");
}

export { apply, inject };
