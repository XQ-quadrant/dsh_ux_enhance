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
			".wSkVaW_root.dshsc-two-col .dshux-tree{display:block;flex:1 1 auto;min-height:120px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;",
			"background:rgba(0,0,0,.06);font-size:12px;line-height:1.5;overflow:auto;margin:10px 12px 12px;padding:6px 8px}",
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
			".dshux-tree-copied{flex:none;font-size:11px;color:var(--dsw-alias-state-success-primary, #22c55e);margin-left:4px;opacity:.9}",
			".dshux-tree-empty{opacity:.5;padding:2px 4px}",
			/* Full-area variant rendered as a conversation view tab (mobile). */
			".dshux-tree-view{display:flex;flex-direction:column;height:100%;max-height:none;border:none;border-radius:0;margin:0;",
			"background:transparent;overflow:hidden;padding:0}",
			".dshux-tree-view .dshux-tree-title{flex:none;padding:10px 12px 4px}",
			".dshux-tree-scroll{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 8px 12px}"
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
		/**
		 * Flatten the host-half tree (nested, files included) into the render
		 * state: top-level `entries` plus a `childrenByPath` map, with every
		 * directory path pre-marked as loaded so expansion never refetches.
		 */
		function flattenHostTree(rootNode) {
			const entries = [];
			const childrenByPath = {};
			const dirs = [];
			if (rootNode && rootNode.type === "directory") {
				for (const child of rootNode.children || []) {
					entries.push(child);
					if (child.type === "directory") dirs.push(child);
				}
			}
			while (dirs.length > 0) {
				const dir = dirs.pop();
				childrenByPath[dir.path] = (dir.children || []).map((c) => {
					if (c.type === "directory") dirs.push(c);
					return { name: c.name, path: c.path, type: c.type === "directory" ? "directory" : "file" };
				});
			}
			return { entries, childrenByPath };
		}

		function WorkspaceTree(props) {
			const { sessionId, useSessions, listDirectory, openPath, variant } = props;
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
			const [copied, setCopied] = React.useState(null); // path just copied
			const copiedTimer = React.useRef(null);
			const clickTimer = React.useRef(null);

			React.useEffect(() => () => {
				if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
				if (clickTimer.current !== null) clearTimeout(clickTimer.current);
			}, []);

			/** Relative path of an entry against the workspace root (cwd). */
			const relativePathOf = (absPath) => {
				if (!cwd) return absPath;
				if (absPath === cwd) return ".";
				return absPath.slice(cwd.length).replace(/^[\\/]+/, "");
			};

			/** Copy text to the clipboard with a legacy fallback. */
			const copyText = (text) => {
				const fallback = () => {
					try {
						const ta = document.createElement("textarea");
						ta.value = text;
						ta.style.position = "fixed";
						ta.style.opacity = "0";
						document.body.appendChild(ta);
						ta.select();
						document.execCommand("copy");
						document.body.removeChild(ta);
					} catch {
						/* ignore */
					}
				};
				if (navigator.clipboard && window.isSecureContext) {
					navigator.clipboard.writeText(text).catch(fallback);
				} else {
					fallback();
				}
			};

			/** Copy the entry's relative path and flash a confirmation. */
			const copyRelativePath = (absPath) => {
				copyText(relativePathOf(absPath));
				setCopied(absPath);
				if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
				copiedTimer.current = setTimeout(() => setCopied(null), 1200);
			};

			React.useEffect(() => {
				expandedRef.current = {};
				loadedRef.current = new Set();
				setChildren({});
				setExpanded({});
				setLoading({});
				setRoot({ loading: !!cwd, error: null, entries: null });
				if (!cwd) return;
				let alive = true;

				// 1) The host half serves a same-origin tree WITH files. On any
				// failure (route absent, host half not loaded) fall back to the
				// client listDirectory capability (directories only).
				fetch("/ux-enhance/tree?path=" + encodeURIComponent(cwd), { cache: "no-store" })
					.then((res) => (res.ok ? res.json() : Promise.reject(new Error("http " + res.status))))
					.then((tree) => {
						if (!alive) return;
						if (!tree || tree.type !== "directory") throw new Error("bad tree payload");
						const flat = flattenHostTree(tree);
						const loaded = new Set(Object.keys(flat.childrenByPath));
						loadedRef.current = loaded;
						setChildren(flat.childrenByPath);
						setRoot({ loading: false, error: null, entries: flat.entries });
					})
					.catch((err) => {
						console.warn("[ux-enhance:tree] host endpoint failed, falling back to listDirectory:", err && err.message ? err.message : err);
						if (!alive) return;
						listDirectory(cwd)
							.then((listing) => {
								if (alive) setRoot({ loading: false, error: null, entries: listing.entries });
							})
							.catch((err2) => {
								if (alive) setRoot({ loading: false, error: err2 && err2.message ? err2.message : String(err2), entries: null });
							});
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
				const isDir = entry.type !== "file";
				const open = !!expanded[entry.path];
				const kids = isDir ? children[entry.path] : undefined;
				const busy = isDir && !!loading[entry.path];
				const pad = { paddingLeft: (4 + depth * 12) + "px" };
				const childPad = { paddingLeft: (16 + depth * 12) + "px" };
				const rowProps = {
					role: "button",
					tabIndex: 0,
					className: "dshux-tree-row",
					style: pad,
					title: entry.path,
					// Single click (tap on mobile): expand/collapse folders and
					// copy the relative path — both at once. Deferred 250ms so a
					// double-click cancels it. Double click: open in the system
					// (file manager / default app). Right click: copy the path.
					onClick: () => {
						if (clickTimer.current !== null) clearTimeout(clickTimer.current);
						clickTimer.current = setTimeout(() => {
							clickTimer.current = null;
							if (isDir) toggle(entry.path);
							copyRelativePath(entry.path);
						}, 250);
					},
					onDoubleClick: () => {
						if (clickTimer.current !== null) {
							clearTimeout(clickTimer.current);
							clickTimer.current = null;
						}
						void openPath(entry.path);
					},
					onContextMenu: (e) => {
						e.preventDefault();
						copyRelativePath(entry.path);
					},
					onKeyDown: (e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (isDir) toggle(entry.path);
							copyRelativePath(entry.path);
						}
					}
				};
				return React.createElement("div", { key: entry.path },
					React.createElement("div", rowProps,
						isDir
							? React.createElement("span", { className: "dshux-tree-chevron" + (open ? " dshux-tree-chevron-open" : "") }, "▸")
							: React.createElement("span", { className: "dshux-tree-chevron" }, "·"),
						React.createElement("span", {}, isDir ? "📁" : "📄"),
						React.createElement("span", { className: "dshux-tree-name" }, entry.name),
						copied === entry.path ? React.createElement("span", { className: "dshux-tree-copied" }, "✓ 已复制") : null,
						React.createElement("button", {
							type: "button",
							className: "dshux-tree-open",
							title: "在系统文件管理器中打开 / Open in file manager",
							onClick: (e) => { e.stopPropagation(); void openPath(entry.path); }
						}, "打开")
					),
					isDir && open && kids !== undefined ? (kids.length === 0
						? React.createElement("div", { className: "dshux-tree-empty", style: childPad }, "（空）")
						: kids.map((kid) => renderNode(kid, depth + 1)))
						: (isDir && open && busy ? React.createElement("div", { className: "dshux-tree-empty", style: childPad }, "加载中…") : null)
				);
			};

			const treeBody = root.loading ? React.createElement("div", { className: "dshux-tree-empty" }, "加载中…")
				: root.error ? React.createElement("div", { className: "dshux-tree-empty" }, "文件树暂不可用：" + root.error)
				: !root.entries || root.entries.length === 0 ? React.createElement("div", { className: "dshux-tree-empty" }, "（空目录）")
				: root.entries.map((entry) => renderNode(entry, 0));
			const title = React.createElement("div", { className: "dshux-tree-title" }, cwd ? "工作区 / " + cwd : "工作区");

			// View variant (mobile tab): fill the conversation body, title pinned
			// at top, rows in their own scrollport. Panel variant (desktop):
			// the root itself is the scroll container.
			if (variant === "view") {
				return React.createElement("div", { className: "dshux-tree dshux-tree-view" },
					title,
					React.createElement("div", { className: "dshux-tree-scroll" }, treeBody)
				);
			}
			return React.createElement("div", { className: "dshux-tree" }, title, treeBody);
		}

		/** Full-area file tree rendered as a conversation view tab (mobile). */
		function FilesView(props) {
			return React.createElement(WorkspaceTree, Object.assign({}, props, { variant: "view" }));
		}

		function applyWorkspaceTree(ctx) {
			injectCss();
			const injectFace = () => ({
				listDirectory: (path, signal) => ctx.workspaces.listDirectory(path, signal),
				openPath: (path) => ctx.workspaces.openPath(path)
			});
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "ux-enhance-workspace-tree",
				order: 0,
				inject: injectFace
			}, WorkspaceTree));

			// Mobile: expose the file tree as a conversation view tab (like the
			// trajectory view) instead of the hidden dock panel. Registered only
			// while the narrow viewport matches, so desktop keeps the panel.
			const MOBILE_MQ = "(max-width: 767px)";
			const mq = window.matchMedia ? window.matchMedia(MOBILE_MQ) : null;
			ctx.effect(() => {
				let disposeView = null;
				const sync = () => {
					if (mq && mq.matches && disposeView === null) {
						disposeView = ctx.slots.inject("conversation.view", () => ctx.slots.register({
							name: "conversation.view",
							id: "ux-enhance-files",
							order: 60,
							label: "文件",
							inject: injectFace
						}, FilesView));
					} else if ((!mq || !mq.matches) && disposeView !== null) {
						disposeView();
						disposeView = null;
					}
				};
				sync();
				if (mq && mq.addEventListener) mq.addEventListener("change", sync);
				return () => {
					if (mq && mq.removeEventListener) mq.removeEventListener("change", sync);
					if (disposeView !== null) {
						disposeView();
						disposeView = null;
					}
				};
			}, "ux-enhance: mobile files view tab");
		}

		exports.applyWorkspaceTree = applyWorkspaceTree;
		return module.exports;
	}
});
