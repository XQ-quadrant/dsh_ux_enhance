/**
 * dsh_ux_enhance — browser entry.
 *
 * Registers the main plugin module and composes the feature submodules:
 *   - dsh_ux_enhance/session-color   (slot + store based)
 *   - dsh_ux_enhance/layout-ui       (kept for now, DOM-based)
 *   - dsh_ux_enhance/sound-alert     (kept for now, sessions-list based)
 */
window.__ModuleLoader__.load({
	id: "dsh_ux_enhance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const sessionColor = require("dsh_ux_enhance/session-color");
		const layoutUi = require("dsh_ux_enhance/layout-ui");
		const soundAlert = require("dsh_ux_enhance/sound-alert");

		exports.inject = ["sessions", "workspaces", "slots"];
		exports.apply = (ctx) => {
			sessionColor.applySessionColor(ctx);
			layoutUi.applyLayoutUi(ctx);
			soundAlert.applySoundAlert(ctx);
		};

		return module.exports;
	}
});
