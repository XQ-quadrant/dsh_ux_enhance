/**
 * dsh_ux_enhance — session color feature (sidebar).
 *
 * Registers a lazy submodule under `dsh_ux_enhance/session-color`.
 *
 * Rebuilt from the 0.1.0 sidebar implementation (row-menu injection + row
 * painting) while keeping the refactor's wins:
 *   - colors live in a ROOT-scoped framework store (defineStore + persist)
 *     as a sessionId → colorKey map, with one-time migration of the legacy
 *     0.1.0 `dsh.sessionColor.v1` localStorage map;
 *   - row painting reads the store + `ctx.sessions.list` (no hand-rolled
 *     localStorage reads), repainting reactively on either change;
 *   - module ids/bundle follow the dsh_ux_enhance layout.
 *
 * The sidebar still exposes no per-row slot upstream (see
 * docs/upstream-proposals.md PR 1), so the per-row UI is a contained DOM
 * seam: "设置颜色" is injected into the native row menu and rows are painted
 * by resolving the row text against `displayTitle` (longest match).
 */
window.__ModuleLoader__.load({
	id: "dsh_ux_enhance/session-color",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const { createRoot } = require("react-dom/client");
		const { defineStore } = require("@deepseek-ai/dsh-client-runtime/client");

		const PLUGIN_ID = "dsh_ux_enhance";
		const STORE_PERSIST_KEY = "dsh-ux-enhance/session-color/v1";
		const LEGACY_KEY = "dsh.sessionColor.v1";

		// Preset palette. `solid` paints the swatch and the selected accent bar;
		// `tint` is the translucent row background (readable in light + dark).
		const PALETTE = [
			{ key: "red",    solid: "#ef4444", tint: "rgba(239, 68, 68, 0.16)" },
			{ key: "orange", solid: "#f97316", tint: "rgba(249, 115, 22, 0.16)" },
			{ key: "amber",  solid: "#f59e0b", tint: "rgba(245, 158, 11, 0.16)" },
			{ key: "green",  solid: "#22c55e", tint: "rgba(34, 197, 94, 0.16)" },
			{ key: "teal",   solid: "#14b8a6", tint: "rgba(20, 184, 166, 0.16)" },
			{ key: "blue",   solid: "#3b82f6", tint: "rgba(59, 130, 246, 0.18)" },
			{ key: "indigo", solid: "#6366f1", tint: "rgba(99, 102, 241, 0.18)" },
			{ key: "purple", solid: "#a855f7", tint: "rgba(168, 85, 247, 0.18)" },
			{ key: "pink",   solid: "#ec4899", tint: "rgba(236, 72, 153, 0.16)" },
			{ key: "slate",  solid: "#64748b", tint: "rgba(100, 116, 139, 0.22)" }
		];

		const I18N = {
			zh: { title: "颜色", setColor: "设置颜色", clearColor: "清除颜色" },
			en: { title: "Color", setColor: "Set color", clearColor: "Clear color" }
		};

		function paletteEntry(key) {
			for (const p of PALETTE) if (p.key === key) return p;
			return undefined;
		}

		/**
		 * Root-scoped colors store: sessionId → colorKey. On first run (no new
		 * persisted value yet) it migrates the legacy 0.1.0 localStorage map
		 * and drops the old key.
		 */
		function createColorStore() {
			return defineStore({
				init: () => {
					let legacy = {};
					try {
						const raw = localStorage.getItem(LEGACY_KEY);
						if (raw) legacy = JSON.parse(raw);
					} catch {
						/* ignore */
					}
					if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
						try {
							localStorage.removeItem(LEGACY_KEY);
						} catch {
							/* ignore */
						}
						return { colors: legacy };
					}
					return { colors: {} };
				},
				persist: STORE_PERSIST_KEY,
				actions: {
					setColor(draft, sessionId, key) { draft.colors[sessionId] = key; },
					clearColor(draft, sessionId) { delete draft.colors[sessionId]; }
				}
			});
		}

		/** One-off stylesheet for the popover, swatches, and the menu dot. */
		function injectCss() {
			if (document.querySelector('style[data-plugin-css="' + PLUGIN_ID + '-session-color"]')) return;
			const css = [
				".dshsc-pop{position:fixed;z-index:2147483000;min-width:176px;padding:10px;border-radius:12px;",
				"background:#1b1b24;border:1px solid rgba(255,255,255,.12);color:#e7e7ee;",
				"box-shadow:0 12px 32px rgba(0,0,0,.5);font-family:inherit;font-size:12px;line-height:1.4}",
				".dshsc-pop-title{margin:0 2px 2px;opacity:.62}",
				".dshsc-grid{display:grid;grid-template-columns:repeat(5,24px);gap:8px;justify-content:space-between;margin:8px 0 10px}",
				".dshsc-swatch{width:24px;height:24px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;",
				"transition:transform .1s ease}",
				".dshsc-swatch:hover{transform:scale(1.18)}",
				".dshsc-swatch-current{border-color:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.35)}",
				".dshsc-clear{width:100%;padding:6px 8px;border:1px solid rgba(255,255,255,.14);background:transparent;",
				"color:inherit;border-radius:8px;cursor:pointer;font-size:12px}",
				".dshsc-clear:hover{background:rgba(255,255,255,.08)}",
				".dshsc-dot{display:inline-block;width:12px;height:12px;border-radius:50%;",
				"background:conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ec4899,#ef4444)}"
			].join("");
			const style = document.createElement("style");
			style.dataset.plugin = PLUGIN_ID;
			style.dataset.pluginCss = PLUGIN_ID + "-session-color";
			style.textContent = css;
			document.head.appendChild(style);
		}

		/** Viewport-clamped popover position anchored to the clicked menu entry. */
		function computePos(rect) {
			const margin = 12;
			const approxW = 200;
			const approxH = 150;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			let left = rect ? rect.right + 6 : margin;
			let top = rect ? rect.top : margin;
			if (left + approxW > vw - margin) left = Math.max(margin, (rect ? rect.left : margin) - approxW - 6);
			if (top + approxH > vh - margin) top = Math.max(margin, vh - approxH - margin);
			return { left: Math.round(left), top: Math.round(top) };
		}

		/** React palette popover; mounted into a self-managed body root. */
		function PalettePopover(props) {
			const { labels, current, anchorRect, containerEl, onPick, onClear, onClose } = props;
			const pos = React.useMemo(() => computePos(anchorRect), [anchorRect]);
			React.useEffect(() => {
				const onPointerDown = (e) => {
					if (e.target instanceof Node && containerEl.contains(e.target)) return;
					onClose();
				};
				const onKeyDown = (e) => {
					if (e.key === "Escape") onClose();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [containerEl, onClose]);

			return React.createElement("div", {
				className: "dshsc-pop",
				style: { left: pos.left + "px", top: pos.top + "px" }
			},
				React.createElement("div", { className: "dshsc-pop-title" }, labels.title),
				React.createElement("div", { className: "dshsc-grid" },
					PALETTE.map((p) => React.createElement("button", {
						key: p.key,
						type: "button",
						title: p.key,
						className: "dshsc-swatch" + (p.key === current ? " dshsc-swatch-current" : ""),
						style: { backgroundColor: p.solid },
						onClick: () => onPick(p.key)
					}))
				),
				React.createElement("button", { type: "button", className: "dshsc-clear", onClick: onClear }, labels.clearColor)
			);
		}

		/**
		 * Map a session row element back to a session id by matching its text
		 * against the longest contained `displayTitle`. Longest-match keeps
		 * prefix titles ("hello" vs "hello world") on the right row.
		 */
		function resolveSessionId(sessions, row) {
			const text = row.textContent || "";
			const snap = sessions.list.getSnapshot();
			let best = null;
			for (const id of snap.ids) {
				const summary = snap.byId[id];
				if (!summary || !summary.displayTitle) continue;
				const title = summary.displayTitle;
				if (text.indexOf(title) !== -1 && (best === null || title.length > best.title.length)) {
					best = { id, title };
				}
			}
			return best === null ? null : best.id;
		}

		function applySessionColor(ctx) {
			injectCss();
			const sessions = ctx.sessions;
			const store = createColorStore().create();

			let pending = null; // { sessionId, row, at }
			let popover = null; // { container, root }

			/** Session rows are div[role=treeitem] with exactly one button (the ⋯ anchor). */
			function isSessionRow(row) {
				return row.matches("div") && row.querySelectorAll("button").length === 1;
			}

			/** Search-result rows are button[role=treeitem] (colored for consistency). */
			function isSearchRow(row) {
				return row.matches("button");
			}

			const SELECTED_ACCENT = "var(--dsw-accent, #4d7cfe)";

			function paint() {
				const colors = store.getSnapshot().colors || {};
				const rows = document.querySelectorAll('[role="treeitem"]');
				for (let i = 0; i < rows.length; i++) {
					const row = rows[i];
					if (!isSessionRow(row) && !isSearchRow(row)) continue;
					const selected = row.getAttribute("aria-selected") === "true"
						|| row.getAttribute("aria-current") === "true"
						|| row.getAttribute("data-selected") === "true";
					const id = resolveSessionId(sessions, row);
					const entry = id !== null ? paletteEntry(colors[id]) : undefined;
					if (entry) {
						row.style.backgroundColor = entry.tint;
						row.style.boxShadow = selected
							? "inset 3px 0 0 " + entry.solid
							: "";
						row.dataset.sessionColor = entry.key;
					} else {
						row.style.backgroundColor = "";
						row.style.boxShadow = selected
							? "inset 3px 0 0 " + SELECTED_ACCENT
							: "";
						delete row.dataset.sessionColor;
					}
				}
			}

			let paintTimer = null;
			function schedulePaint() {
				if (paintTimer !== null) return;
				paintTimer = setTimeout(() => {
					paintTimer = null;
					paint();
				}, 30);
			}

			function closePopover() {
				if (popover === null) return;
				try {
					popover.root.unmount();
				} catch {
					/* already unmounted */
				}
				if (popover.container.parentNode) popover.container.parentNode.removeChild(popover.container);
				popover = null;
			}

			function openPopover(sessionId, anchorRect, labels) {
				closePopover();
				const container = document.createElement("div");
				document.body.appendChild(container);
				const root = createRoot(container);
				popover = { container, root };
				const current = store.getSnapshot().colors[sessionId];
				root.render(React.createElement(PalettePopover, {
					labels,
					current: current === undefined ? null : current,
					anchorRect,
					containerEl: container,
					onPick(key) {
						store.actions.setColor(sessionId, key);
						paint();
						closePopover();
					},
					onClear() {
						store.actions.clearColor(sessionId);
						paint();
						closePopover();
					},
					onClose: closePopover
				}));
			}

			/** Detect zh vs en from any existing menu label. */
			function detectLabels() {
				const sample = document.querySelector('[role="menu"] [role="menuitem"]');
				const text = sample ? sample.textContent || "" : "";
				return /[\u4e00-\u9fff]/.test(text) ? I18N.zh : I18N.en;
			}

			/** Close the native menu by synthesizing an outside pointerdown. */
			function closeNativeMenu() {
				try {
					document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
				} catch {
					document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
				}
			}

			/** Append a "设置颜色" entry to a freshly opened session-row menu. */
			function tryInject(menu) {
				if (menu.dataset.dshscInjected) return;
				if (pending === null) return;
				if (Date.now() - pending.at > 800) {
					pending = null;
					return;
				}
				const viewport = menu.querySelector('[role="presentation"]');
				if (!viewport) return;
				const template = viewport.querySelector('button[role="menuitem"]');
				if (!template) return;

				const { sessionId, row: rowEl } = pending;
				pending = null;
				const labels = detectLabels();

				const wrap = document.createElement("div");
				wrap.className = template.parentElement ? template.parentElement.className : "";
				const btn = template.cloneNode(true);
				btn.setAttribute("role", "menuitem");
				btn.removeAttribute("aria-haspopup");
				btn.removeAttribute("aria-expanded");
				const spans = btn.querySelectorAll("span");
				if (spans.length >= 2) {
					spans[1].textContent = labels.setColor; // label
					spans[0].textContent = ""; // clear the edit icon
					const dot = document.createElement("span");
					dot.className = "dshsc-dot";
					spans[0].appendChild(dot);
				} else if (spans.length === 1) {
					spans[0].textContent = labels.setColor;
				}

				btn.addEventListener("click", (e) => {
					e.preventDefault();
					e.stopPropagation();
					const rect = btn.getBoundingClientRect();
					closeNativeMenu();
					openPopover(sessionId, rect, labels);
				});

				wrap.appendChild(btn);
				viewport.appendChild(wrap);
				menu.dataset.dshscInjected = "1";
			}

			// Record the session-row action-button click before the menu opens.
			const clickHandler = (e) => {
				const target = e.target;
				if (!(target instanceof Element)) return;
				const btn = target.closest("button");
				if (!btn) return;
				const row = btn.closest('div[role="treeitem"]');
				if (!row) return;
				if (row.querySelectorAll("button").length !== 1) return; // session rows only
				const sessionId = resolveSessionId(sessions, row);
				pending = sessionId !== null ? { sessionId, row, at: Date.now() } : null;
			};

			const observer = new MutationObserver((mutations) => {
				for (const m of mutations) {
					for (const node of m.addedNodes) {
						if (node.nodeType !== 1) continue;
						const el = node;
						if (el.matches && el.matches('[role="menu"]')) {
							tryInject(el);
						}
						if (el.querySelectorAll) {
							const menus = el.querySelectorAll('[role="menu"]');
							for (const menu of menus) tryInject(menu);
						}
					}
				}
				schedulePaint();
			});

			document.addEventListener("click", clickHandler, true);
			observer.observe(document.body, { childList: true, subtree: true });
			const unsubscribe = sessions.list.subscribe(schedulePaint);
			const unsubscribeStore = store.subscribe(schedulePaint);
			schedulePaint();

			ctx.effect(() => () => {
				document.removeEventListener("click", clickHandler, true);
				observer.disconnect();
				unsubscribe();
				unsubscribeStore();
				closePopover();
			});
		}

		exports.applySessionColor = applySessionColor;
		exports.resolveSessionId = resolveSessionId;
		return module.exports;
	}
});
