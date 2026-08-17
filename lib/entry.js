/**
 * dsh_ux_enhance — browser entry.
 *
 * Registers the main plugin module and composes the feature submodules:
 *   - dsh_ux_enhance/session-color   (sidebar row menu + root-scope store)
 *   - dsh_ux_enhance/workspace-tree  (dock panel + mobile tab; host route)
 *   - dsh_ux_enhance/layout-ui       (CSS skin + overlay FAB)
 *   - dsh_ux_enhance/sound-alert     (sessions-list based, store settings)
 */
window.__ModuleLoader__.load({
	id: "dsh_ux_enhance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const sessionColor = require("dsh_ux_enhance/session-color");
		const workspaceTree = require("dsh_ux_enhance/workspace-tree");
		const layoutUi = require("dsh_ux_enhance/layout-ui");
		const soundAlert = require("dsh_ux_enhance/sound-alert");

		exports.inject = ["sessions", "workspaces", "slots"];
		exports.apply = (ctx) => {
			console.log("[ux-enhance] apply — plugin loaded");
			sessionColor.applySessionColor(ctx);
			workspaceTree.applyWorkspaceTree(ctx);
			layoutUi.applyLayoutUi(ctx);
			soundAlert.applySoundAlert(ctx);
		};

		return module.exports;
	}
});
