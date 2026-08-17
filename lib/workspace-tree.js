/**
 * dsh_ux_enhance — workspace directory tree feature.
 *
 * Registers a lazy submodule under `dsh_ux_enhance/workspace-tree`.
 * Renders into the `conversation.input.dock` slot (above the composer card)
 * and loads directory levels through the official `ctx.workspaces.listDirectory`
 * host capability — no DOM scraping, no localStorage.
 *
 * Note: the wire contract lists directories only (the browse capability skips
 * files), so this is a folder tree; file leaves need an upstream host
 * extension (see docs/upstream-proposals.md).
 */
window.__ModuleLoader__.load({
	id: "dsh_ux_enhance/workspace-tree",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");

		const PLUGIN_ID = "dsh_ux_enhance";
		const CSS_TAG = "dsh_ux_enhance/workspace-tree";

		/** Own class names only (never DSH hashed classes). */
		const TREE_CSS = [
			".dshux-tree{display:none}",
			".wSkVaW_root.dshsc-two-col .dshux-tree{display:block;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;",
			"background:rgba(0,0,0,.06);font-size:12px;line-height:1.5;max-height:38vh;overflow:auto;margin:0 12px 12px;padding:6px 8px}",
			".dshux-tree-title{opacity:.6;padding:2px 4px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dshux-tree-row{display:flex;align-items:center;gap:4px;width:100%;text-align:left;background:none;border:none;color:inherit;",
			"cursor:pointer;user-select:none;padding:2px 4px;border-radius:6px;font-size:12px;line-height:1.5}",
			".dshux-tree-row:hover{background:rgba(255,255,255,.07)}",
			".dshux-tree-chevron{display:inline-block;width:12px;font-size:10px;transition:transform .15s ease;flex:none}",
			".dshux-tree-chevron-open{transform:rotate(90deg)}",
			".dshux-tree-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0}",
			".dshux-tree-open{display:none;margin-left:auto;flex:none;background:none;border:none;color:inherit;cursor:pointer;",
			"font-size:11px;opacity:.7;padding:0 2px;border-radius:4px}",
			".dshux-tree-row:hover .dshux-tree-open{display:inline-flex}",
			".dshux-tree-open:hover{opacity:1;background:rgba(255,255,255,.08)}",
			".dshux-tree-empty{opacity:.5;padding:2px 4px}"
		].join("");

		function injectCss() {
			if (document.querySelector('style[data-plugin-css="' + CSS_TAG + '"]')) return;
			const style = document.createElement("style");
			style.dataset.plugin = PLUGIN_ID;
			style.dataset.pluginCss = CSS_TAG;
			style.textContent = TREE_CSS;
			document.head.appendChild(style);
		}

		/**
		 * Workspace directory tree. Root = the current session's `cwd`
		 * (read off the sessions list via the `useSessions` global hook).
		 * Folder rows are `div[role=button]` (a `<button>` may not contain
		 * another `<button>` — invalid HTML breaks click dispatch); the "打开"
		 * action is a valid sibling button with stopPropagation.
		 */
		function WorkspaceTree(props) {
			const { sessionId, useSessions, listDirectory, openPath } = props;
			const cwd = useSessions((s) => {
				const summary = s.byId[sessionId];
				return summary ? summary.cwd : undefined;
			});
			const [root, setRoot] = React.useState({ loading: false, error: null, entries: null });
			const [children, setChildren] = React.useState({});
			const [expanded, setExpanded] = React.useState({});
			const [loading, setLoading] = React.useState({});
			const expandedRef = React.useRef({});
			const loadedRef = React.useRef(new Set());

			React.useEffect(() => {
				expandedRef.current = {};
				loadedRef.current = new Set();
				setChildren({});
				setExpanded({});
				setLoading({});
				setRoot({ loading: !!cwd, error: null, entries: null });
				if (!cwd) return;
				let alive = true;
				listDirectory(cwd)
					.then((listing) => {
						if (alive) setRoot({ loading: false, error: null, entries: listing.entries });
					})
					.catch((err) => {
						if (alive) setRoot({ loading: false, error: err && err.message ? err.message : String(err), entries: null });
					});
				return () => { alive = false; };
			}, [cwd]);

			const toggle = (path) => {
				const nowOpen = !expandedRef.current[path];
				expandedRef.current[path] = nowOpen;
				setExpanded({ ...expandedRef.current });
				if (nowOpen && !loadedRef.current.has(path)) {
					loadedRef.current.add(path);
					setLoading((l) => ({ ...l, [path]: true }));
					listDirectory(path)
						.then((listing) => setChildren((c) => ({ ...c, [path]: listing.entries })))
						.catch(() => setChildren((c) => ({ ...c, [path]: [] })))
						.finally(() => setLoading((l) => ({ ...l, [path]: false })));
				}
			};

			const renderNode = (entry, depth) => {
				const open = !!expanded[entry.path];
				const kids = children[entry.path];
				const busy = !!loading[entry.path];
				const pad = { paddingLeft: (4 + depth * 12) + "px" };
				const childPad = { paddingLeft: (16 + depth * 12) + "px" };
				return React.createElement("div", { key: entry.path },
					React.createElement("div", {
						role: "button",
						tabIndex: 0,
						className: "dshux-tree-row",
						style: pad,
						title: entry.path,
						onClick: () => toggle(entry.path),
						onKeyDown: (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								toggle(entry.path);
							}
						}
					},
						React.createElement("span", { className: "dshux-tree-chevron" + (open ? " dshux-tree-chevron-open" : "") }, "▸"),
						React.createElement("span", {}, "📁"),
						React.createElement("span", { className: "dshux-tree-name" }, entry.name),
						React.createElement("button", {
							type: "button",
							className: "dshux-tree-open",
							title: "在系统文件管理器中打开 / Open in file manager",
							onClick: (e) => { e.stopPropagation(); void openPath(entry.path); }
						}, "打开")
					),
					open && kids !== undefined ? (kids.length === 0
						? React.createElement("div", { className: "dshux-tree-empty", style: childPad }, "（空）")
						: kids.map((kid) => renderNode(kid, depth + 1)))
						: (open && busy ? React.createElement("div", { className: "dshux-tree-empty", style: childPad }, "加载中…") : null)
				);
			};

			return React.createElement("div", { className: "dshux-tree" },
				React.createElement("div", { className: "dshux-tree-title" }, cwd ? "工作区 / " + cwd : "工作区"),
				root.loading ? React.createElement("div", { className: "dshux-tree-empty" }, "加载中…")
					: root.error ? React.createElement("div", { className: "dshux-tree-empty" }, "文件树暂不可用：" + root.error)
					: !root.entries || root.entries.length === 0 ? React.createElement("div", { className: "dshux-tree-empty" }, "（空目录）")
					: root.entries.map((entry) => renderNode(entry, 0))
			);
		}

		function applyWorkspaceTree(ctx) {
			injectCss();
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "ux-enhance-workspace-tree",
				order: 0,
				inject: () => ({
					listDirectory: (path, signal) => ctx.workspaces.listDirectory(path, signal),
					openPath: (path) => ctx.workspaces.openPath(path)
				})
			}, WorkspaceTree));
		}

		exports.applyWorkspaceTree = applyWorkspaceTree;
		return module.exports;
	}
});
