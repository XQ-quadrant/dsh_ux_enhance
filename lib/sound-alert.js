/**
 * dsh-session-color — sound-alert feature.
 *
 * Registers a lazy submodule under `dsh-session-color/sound-alert`.
 * It watches `ctx.sessions.list` and plays a short in-browser chime when:
 *   - a session's turn completes (`running` flips true → false), and
 *   - a question/choice is presented to the user (`pendingInteraction`
 *     becomes 'question' | 'plan-review').
 *
 * This mirrors Claude Code's `Stop` + `PreToolUse(AskUserQuestion)` hook
 * sounds. The web platform has no shell, so the tone is synthesized with the
 * Web Audio API instead of `powershell.exe ... Exclamation.Play()`.
 */
window.__ModuleLoader__.load({
	id: "dsh-session-color/sound-alert",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const STORAGE_KEY = "dsh.soundAlert.v1";

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

		function loadSettings() {
			const defaults = { enabled: true, volume: 0.15 };
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (!raw) return defaults;
				const value = JSON.parse(raw);
				if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
				return {
					enabled: value.enabled !== false,
					volume: typeof value.volume === "number" && value.volume >= 0 && value.volume <= 1
						? value.volume
						: defaults.volume
				};
			} catch {
				return defaults;
			}
		}

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

		function applySoundAlert(ctx) {
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
				const settings = loadSettings();

				for (const id of snap.ids) {
					const summary = snap.byId[id];
					if (!summary) continue;
					const running = summary.running === true;
					const pending = summary.pendingInteraction;
					const prior = prev.get(id);

					if (prior && settings.enabled) {
						// A question/choice just appeared for this session.
						if (wantsAttention(pending) && !wantsAttention(prior.pending)) {
							playTones(QUESTION_TONES, settings.volume);
						}
						// The session's turn just finished.
						if (prior.running && !running) {
							playTones(DONE_TONES, settings.volume);
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
