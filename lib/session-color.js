/**
 * dsh_ux_enhance — session color feature (slot-based rewrite).
 *
 * Registers a lazy submodule under `dsh_ux_enhance/session-color`.
 * Instead of the old MutationObserver + menu-clone + localStorage approach,
 * this version uses the official extension surface:
 *
 *   - ctx.slots.register(...) into `conversation.session.header.actions`
 *     (a list / session-scoped slot declared by ui-conversation). The
 *     framework hands the component `sessionId`, `useStore`, and `actions`
 *     directly — no DOM text-matching to recover the session id.
 *   - a per-session store via defineStore({ persist }) — persistence and
 *     per-session scoping (plus auto-cleanup on session death) are framework
 *     run, replacing the hand-rolled localStorage map.
 */
window.__ModuleLoader__.load({
	id: "dsh_ux_enhance/session-color",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const { defineStore } = require("@deepseek-ai/dsh-client-runtime/client");

		const PLUGIN_ID = "dsh_ux_enhance";
		const CSS_TAG = "dsh_ux_enhance/session-color";
		const STORE_PERSIST_KEY = "dsh-ux-enhance/session-color/v1";

		// Preset palette. `solid` paints the swatch and the trigger dot.
		const PALETTE = [
			{ key: "red",    solid: "#ef4444" },
			{ key: "orange", solid: "#f97316" },
			{ key: "amber",  solid: "#f59e0b" },
			{ key: "green",  solid: "#22c55e" },
			{ key: "teal",   solid: "#14b8a6" },
			{ key: "blue",   solid: "#3b82f6" },
			{ key: "indigo", solid: "#6366f1" },
			{ key: "purple", solid: "#a855f7" },
			{ key: "pink",   solid: "#ec4899" },
			{ key: "slate",  solid: "#64748b" }
		];

		function paletteEntry(key) {
			for (const p of PALETTE) if (p.key === key) return p;
			return undefined;
		}

		/** One-off stylesheet for the trigger button, dot, and popover. */
		function injectCss() {
			if (document.querySelector('style[data-plugin-css="' + CSS_TAG + '"]')) return;
			const css = [
				".dshux-sc{position:relative}",
				".dshux-sc-trigger{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;",
				"border:1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.14));cursor:pointer;padding:0;background:transparent}",
				".dshux-sc-trigger:hover{box-shadow:0 0 0 2px rgba(0,0,0,.25)}",
				".dshux-sc-dot{display:inline-block;width:12px;height:12px;border-radius:50%;",
				"background:conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ec4899,#ef4444)}",
				".dshux-sc-pop{position:absolute;z-index:2147483000;top:calc(100% + 6px);right:0;min-width:176px;padding:10px;",
				"border-radius:12px;background:#1b1b24;border:1px solid rgba(255,255,255,.12);color:#e7e7ee;",
				"box-shadow:0 12px 32px rgba(0,0,0,.5);font-size:12px;line-height:1.4}",
				".dshux-sc-pop-title{margin:0 2px 2px;opacity:.62}",
				".dshux-sc-grid{display:grid;grid-template-columns:repeat(5,24px);gap:8px;justify-content:space-between;margin:8px 0 10px}",
				".dshux-sc-swatch{width:24px;height:24px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;",
				"transition:transform .1s ease}",
				".dshux-sc-swatch:hover{transform:scale(1.18)}",
				".dshux-sc-swatch-current{border-color:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.35)}",
				".dshux-sc-clear{width:100%;padding:6px 8px;border:1px solid rgba(255,255,255,.14);background:transparent;",
				"color:inherit;border-radius:8px;cursor:pointer;font-size:12px}",
				".dshux-sc-clear:hover{background:rgba(255,255,255,.08)}"
			].join("");
			const style = document.createElement("style");
			style.dataset.plugin = PLUGIN_ID;
			style.dataset.pluginCss = CSS_TAG;
			style.textContent = css;
			document.head.appendChild(style);
		}

		/**
		 * Per-session color control rendered into the conversation header.
		 * `useStore`/`actions` come from the store seat below; `sessionId` is a
		 * framework-standard prop (owners never pass it).
		 */
		function SessionColorAction(props) {
			const { useStore, actions } = props;
			const colorKey = useStore((s) => s.colorKey);
			const [open, setOpen] = React.useState(false);
			const rootRef = React.useRef(null);

			React.useEffect(() => {
				if (!open) return;
				const onPointerDown = (e) => {
					if (rootRef.current && rootRef.current.contains(e.target)) return;
					setOpen(false);
				};
				const onKeyDown = (e) => {
					if (e.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);

			const entry = colorKey ? paletteEntry(colorKey) : undefined;

			return React.createElement("div", { ref: rootRef, className: "dshux-sc" },
				React.createElement("button", {
					type: "button",
					className: "dshux-sc-trigger",
					title: "设置会话颜色 / Set session color",
					"aria-label": "设置会话颜色 / Set session color",
					onClick: () => setOpen((v) => !v)
				}, React.createElement("span", {
					className: "dshux-sc-dot",
					style: entry ? { background: entry.solid } : undefined
				})),
				open ? React.createElement("div", { className: "dshux-sc-pop" },
					React.createElement("div", { className: "dshux-sc-pop-title" }, "颜色 / Color"),
					React.createElement("div", { className: "dshux-sc-grid" },
						PALETTE.map((p) => React.createElement("button", {
							key: p.key,
							type: "button",
							title: p.key,
							className: "dshux-sc-swatch" + (p.key === colorKey ? " dshux-sc-swatch-current" : ""),
							style: { backgroundColor: p.solid },
							onClick: () => { actions.setColor(p.key); setOpen(false); }
						}))
					),
					React.createElement("button", {
						type: "button",
						className: "dshux-sc-clear",
						onClick: () => { actions.clearColor(); setOpen(false); }
					}, "清除颜色 / Clear")
				) : null
			);
		}

		/** Exclusive store factory: the framework instantiates per session scope. */
		function createSessionColorStore() {
			return defineStore({
				init: () => ({ colorKey: null }),
				persist: STORE_PERSIST_KEY,
				actions: {
					setColor(draft, key) { draft.colorKey = key; },
					clearColor(draft) { draft.colorKey = null; }
				}
			});
		}

		function applySessionColor(ctx) {
			injectCss();
			// `ctx.slots.inject` waits for the slot declaration (ui-conversation)
			// and wires the registration into this fiber's unload cascade.
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "ux-enhance-session-color",
				order: 100,
				store: createSessionColorStore
			}, SessionColorAction));
		}

		exports.applySessionColor = applySessionColor;
		return module.exports;
	}
});
