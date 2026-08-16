/**
 * dsh-session-color — browser entry.
 *
 * Registers the main plugin module and composes the feature submodules:
 *   - dsh-session-color/session-color
 *   - dsh-session-color/layout-ui
 *   - dsh-session-color/sound-alert
 */
window.__ModuleLoader__.load({
	id: "dsh-session-color",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const sessionColor = require("dsh-session-color/session-color");
		const layoutUi = require("dsh-session-color/layout-ui");
		const soundAlert = require("dsh-session-color/sound-alert");

		exports.inject = ["sessions", "workspaces"];
		exports.apply = (ctx) => {
			sessionColor.applySessionColor(ctx);
			layoutUi.applyLayoutUi(ctx, { resolveSessionId: sessionColor.resolveSessionId });
			soundAlert.applySoundAlert(ctx);
		};

		return module.exports;
	}
});
