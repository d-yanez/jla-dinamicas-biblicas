// What sounds, and how loud, for each thing the round engine reports.
//
// Pure on purpose: the audible behaviour can be tested without an audio device, and the
// play screen only has to forward the plan to the WebAudio engine.

export const DEFAULT_VOLUME = 0.3;
export const TENSION_WINDOW_MS = 10_000;

/** Sounds to play for one engine event, in order. */
export function planForEvent(event) {
	if (typeof event !== "object" || event === null) return [];
	if (event.type === "round-start") return [{ sound: "bell", kind: "start" }];
	if (event.type === "extra-start") return [{ sound: "bell", kind: "start" }];
	if (event.type === "time-up") return [{ sound: "bell", kind: "end" }];
	if (event.type === "tick") {
		const secondsLeft = Number(event.secondsLeft);
		const safe = Number.isFinite(secondsLeft) ? secondsLeft : 5;
		// Five seconds left is the softest tick; one second left is the sharpest.
		const intensity = Math.min(4, Math.max(0, 5 - safe));
		return [{ sound: "tick", intensity }];
	}
	return [];
}

/**
 * 0 = silent, 1 = full tension. Only inside the last ten seconds of a running round or
 * extra time: before that there is nothing to heighten.
 */
export function tensionLevel({ remainingMs, running, stage } = {}) {
	if (!running) return 0;
	if (stage !== "round" && stage !== "extra") return 0;
	const remaining = Math.max(0, Number(remainingMs) || 0);
	if (remaining > TENSION_WINDOW_MS) return 0;
	return Math.round((1 - remaining / TENSION_WINDOW_MS) * 100) / 100;
}

/** Clamps a stored volume to a usable range. */
export function normalizeVolume(value) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return DEFAULT_VOLUME;
	return Math.min(1, Math.max(0, Math.round(numeric * 100) / 100));
}
