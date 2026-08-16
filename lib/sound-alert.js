/**
 * dsh_ux_enhance — sound-alert feature.
 *
 * Registers a lazy submodule under `dsh_ux_enhance/sound-alert`.
 * Watches `ctx.sessions.list` and plays a short in-browser chime when:
 *   - a session's turn completes (`running` flips true → false), and
 *   - a question/choice is presented to the user (`pendingInteraction`
 *     becomes 'question' | 'plan-review').
 *
 * The session-diff logic is unchanged from the original (it already used the
 * public `ctx.sessions.list` surface). What changed: the enabled/volume
 * settings now live in a root-scoped framework store (defineStore + persist)
 * instead of hand-rolled localStorage reads. The persist key keeps the legacy
 * name `dsh.soundAlert.v1` and the same JSON shape, so existing settings
 * migrate in place.
 */
window.__ModuleLoader__.load({
	id: "dsh_ux_enhance/sound-alert",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const { defineStore } = require("@deepseek-ai/dsh-client-runtime/client");

		const STORE_PERSIST_KEY = "dsh.soundAlert.v1";

		// Attention pattern: a short double "ping" (two quick beeps).
		const QUESTION_TONES = [
			{ freq: 880.0, at: 0.00, dur: 0.14, type: "triangle" },
			{ freq: 880.0, at: 0.20, dur: 0.14, type: "triangle" }
		];

		// Completion pattern: a soft ascending two-note chime.
		const DONE_TONES = [
			{ freq: 659.25, at: 0.00, dur: 0.18, type: "sine" },
			{ freq: 783.99, at: 0.10, dur: 0.22, type: "sine" }
		];

		let audioCtx = null;

		/** Lazily create/resume the shared AudioContext (idempotent; null when unsupported). */
		function ensureCtx() {
			try {
				const Ctor = window.AudioContext || window.webkitAudioContext;
				if (!Ctor) return null;
				if (audioCtx === null) audioCtx = new Ctor();
				if (audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
				return audioCtx;
			} catch {
				return null;
			}
		}

		/** Render one tone list through an oscillator + gain envelope. */
		function playTones(tones, volume) {
			const ctx = ensureCtx();
			if (!ctx) return;
			const now = ctx.currentTime;
			for (const tone of tones) {
				try {
					const osc = ctx.createOscillator();
					const gain = ctx.createGain();
					osc.type = tone.type;
					osc.frequency.value = tone.freq;
					const t0 = now + tone.at;
					const peak = Math.max(0.0001, volume);
					gain.gain.setValueAtTime(0.0001, t0);
					gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
					gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.dur);
					osc.connect(gain);
					gain.connect(ctx.destination);
					osc.start(t0);
					osc.stop(t0 + tone.dur + 0.05);
				} catch {
					/* ignore per-tone failures so one bad tone never breaks the rest */
				}
			}
		}

		/** 'question' and 'plan-review' are both "the user must choose" states. */
		function wantsAttention(pending) {
			return pending === "question" || pending === "plan-review";
		}

		/** Root-scoped settings store; the apply body holds one live instance. */
		function createSoundSettingsStore() {
			return defineStore({
				init: () => ({ enabled: true, volume: 0.15 }),
				persist: STORE_PERSIST_KEY,
				actions: {
					setEnabled(draft, enabled) { draft.enabled = enabled; },
					setVolume(draft, volume) { draft.volume = volume; }
				}
			});
		}

		function applySoundAlert(ctx) {
			const settings = createSoundSettingsStore().create();

			/**
			 * Defensive read: the legacy persisted value may be partial (e.g.
			 * `{ volume: 0.08 }` from the old README example), so normalize the
			 * same way the old loadSettings() did.
			 */
			function readSettings() {
				const state = settings.getSnapshot() || {};
				return {
					enabled: state.enabled !== false,
					volume: typeof state.volume === "number" && state.volume >= 0 && state.volume <= 1
						? state.volume
						: 0.15
				};
			}

			const sessions = ctx.sessions;

			// Browsers gate AudioContext until a user gesture; unlock on the first one
			// and resume whenever the browser suspends it again (tab throttling).
			const unlock = () => { ensureCtx(); };
			document.addEventListener("pointerdown", unlock, { capture: true });
			document.addEventListener("keydown", unlock, { capture: true });

			// Previous per-session state, so only *transitions* sound.
			const prev = new Map(); // sessionId -> { running, pending }

			function diff() {
				const snap = sessions.list.getSnapshot();
				const s = readSettings();

				for (const id of snap.ids) {
					const summary = snap.byId[id];
					if (!summary) continue;
					const running = summary.running === true;
					const pending = summary.pendingInteraction;
					const prior = prev.get(id);

					if (prior && s.enabled) {
						// A question/choice just appeared for this session.
						if (wantsAttention(pending) && !wantsAttention(prior.pending)) {
							playTones(QUESTION_TONES, s.volume);
						}
						// The session's turn just finished.
						if (prior.running && !running) {
							playTones(DONE_TONES, s.volume);
						}
					}

					prev.set(id, { running, pending });
				}

				// Prune sessions that dropped out of the list so the map stays bounded.
				for (const id of [...prev.keys()]) {
					if (!snap.byId[id]) prev.delete(id);
				}
			}

			const unsubscribe = sessions.list.subscribe(diff);
			diff(); // baseline only: records the current state without sounding

			ctx.effect(() => () => {
				unsubscribe();
				document.removeEventListener("pointerdown", unlock, true);
				document.removeEventListener("keydown", unlock, true);
				try {
					if (audioCtx) void audioCtx.close();
					audioCtx = null;
				} catch {
					/* ignore */
				}
			});
		}

		exports.applySoundAlert = applySoundAlert;
		return module.exports;
	}
});
