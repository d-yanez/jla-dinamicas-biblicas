// Round engine for both games.
//
// Pure and clock-injected: no DOM, no timer of its own. The play screen feeds it the
// elapsed milliseconds and it answers with the events to sound. That is what makes
// "zero seconds", "double action", "go back" and "60 extra seconds" testable without
// waiting in real time.

export const ROUND_COUNT = 10;
export const EXTRA_SECONDS = 60;
/** Two advances closer than this are the same click or a key repeat, not two decisions. */
export const DOUBLE_ACTION_MS = 300;

export const PLAY_STAGE = Object.freeze({
	INTRO: "intro",
	ROUND: "round",
	EXTRA: "extra",
	REVIEW: "review",
	TIEBREAKER: "tiebreaker",
	REFLECTION: "reflection",
	THANKS: "thanks",
});

export const PLAY_EVENT = Object.freeze({
	ROUND_START: "round-start",
	EXTRA_START: "extra-start",
	TICK: "tick",
	TIME_UP: "time-up",
	REVEAL: "reveal",
});

const TICK_FROM_SECONDS = 5;

export function createRoundSession({ roundSeconds, extraSeconds = EXTRA_SECONDS, reviewCount = ROUND_COUNT, tiebreakCount = 3 } = {}) {
	const durationMs = Math.max(1, Math.round(Number(roundSeconds) || 30)) * 1000;
	const extraMs = Math.max(1, Math.round(Number(extraSeconds) || EXTRA_SECONDS)) * 1000;

	let state = {
		stage: PLAY_STAGE.INTRO,
		roundIndex: 0,
		remainingMs: durationMs,
		extraRemainingMs: extraMs,
		running: false,
		history: [],
		hints: {},
		review: { cursor: 0, watermark: 0 },
		tiebreak: { index: 0, anagramShown: false, answerShown: false },
		lastAdvanceAt: Number.NEGATIVE_INFINITY,
		pausedForHelp: false,
	};

	const activeRemaining = () => (state.stage === PLAY_STAGE.EXTRA ? state.extraRemainingMs : state.remainingMs);

	function setActiveRemaining(value) {
		if (state.stage === PLAY_STAGE.EXTRA) state.extraRemainingMs = value;
		else state.remainingMs = value;
	}

	function freshRemaining() {
		return state.stage === PLAY_STAGE.EXTRA ? extraMs : durationMs;
	}

	const canAdvance = (now) => {
		if (!Number.isFinite(now)) return true;
		return now - state.lastAdvanceAt >= DOUBLE_ACTION_MS;
	};

	return {
		get stage() {
			return state.stage;
		},
		get roundIndex() {
			return state.roundIndex;
		},
		get running() {
			return state.running;
		},
		get roundSeconds() {
			return Math.round(durationMs / 1000);
		},
		remainingMs: activeRemaining,

		snapshot() {
			return {
				stage: state.stage,
				roundIndex: state.roundIndex,
				roundNumber: state.roundIndex + 1,
				roundCount: ROUND_COUNT,
				remainingMs: activeRemaining(),
				extraRemainingMs: state.extraRemainingMs,
				running: state.running,
				history: [...state.history],
				hints: { ...state.hints },
				review: { ...state.review },
				reviewCount,
				tiebreak: { ...state.tiebreak },
				tiebreakCount,
				pausedForHelp: state.pausedForHelp,
			};
		},

		/** Intro → first round, clock running. */
		start(now) {
			if (state.stage !== PLAY_STAGE.INTRO) return [];
			state.stage = PLAY_STAGE.ROUND;
			state.roundIndex = 0;
			state.remainingMs = durationMs;
			state.running = true;
			state.history = [0];
			state.lastAdvanceAt = Number.isFinite(now) ? now : Number.NEGATIVE_INFINITY;
			return [{ type: PLAY_EVENT.ROUND_START, roundIndex: 0 }];
		},

		/** Next round starts the clock in the same action; never auto-advances on zero. */
		next(now) {
			if (state.stage !== PLAY_STAGE.ROUND) return [];
			if (state.roundIndex >= ROUND_COUNT - 1) return [];
			if (!canAdvance(now)) return [];
			state.roundIndex += 1;
			state.remainingMs = durationMs;
			state.running = true;
			state.history = [...new Set([...state.history, state.roundIndex])].sort((left, right) => left - right);
			state.lastAdvanceAt = Number.isFinite(now) ? now : Number.NEGATIVE_INFINITY;
			return [{ type: PLAY_EVENT.ROUND_START, roundIndex: state.roundIndex }];
		},

		/** Back one round, clock paused, hints kept: the spec asks for the previous state. */
		previous() {
			if (state.stage !== PLAY_STAGE.ROUND || state.roundIndex === 0) return [];
			state.roundIndex -= 1;
			state.remainingMs = durationMs;
			state.running = false;
			state.history = state.history.filter((index) => index <= state.roundIndex);
			return [];
		},

		pause() {
			if (!state.running) return [];
			state.running = false;
			return [];
		},

		resume(_now) {
			if (state.running) return [];
			if (state.stage !== PLAY_STAGE.ROUND && state.stage !== PLAY_STAGE.EXTRA) return [];
			if (activeRemaining() <= 0) return [];
			state.running = true;
			// Resuming is not an advance: the double-action guard only protects advancing,
			// so an advance right after resuming must still work.
			return [];
		},

		togglePause(now) {
			return state.running ? this.pause() : this.resume(now);
		},

		/** Restarts the clock of the current round, keeping the hints already shown. */
		restart() {
			if (state.stage !== PLAY_STAGE.ROUND && state.stage !== PLAY_STAGE.EXTRA) return [];
			setActiveRemaining(freshRemaining());
			state.running = true;
			return [];
		},

		/** Manual 60 extra seconds after the tenth round. */
		startExtra(now) {
			if (state.stage !== PLAY_STAGE.ROUND) return [];
			if (state.roundIndex < ROUND_COUNT - 1) return [];
			if (!canAdvance(now)) return [];
			state.stage = PLAY_STAGE.EXTRA;
			state.extraRemainingMs = extraMs;
			state.running = true;
			state.lastAdvanceAt = Number.isFinite(now) ? now : Number.NEGATIVE_INFINITY;
			return [{ type: PLAY_EVENT.EXTRA_START, seconds: Math.round(extraMs / 1000) }];
		},

		/** Advances the clock. Returns the events to play, in order. */
		tick(deltaMs) {
			if (!state.running) return [];
			const elapsed = Math.max(0, Number(deltaMs) || 0);
			if (elapsed === 0) return [];
			const before = activeRemaining();
			const after = Math.max(0, before - elapsed);
			setActiveRemaining(after);
			const events = [];
			// A tick belongs to the moment the display enters a second in 1..5, which is what
			// the moderator hears and sees; the boundary case at 00:01 must not be lost.
			const beforeSecond = Math.ceil(before / 1000);
			const afterSecond = Math.ceil(after / 1000);
			for (let second = TICK_FROM_SECONDS; second >= 1; second -= 1) {
				if (beforeSecond > second && afterSecond <= second) events.push({ type: PLAY_EVENT.TICK, secondsLeft: second });
			}
			if (after === 0) {
				state.running = false;
				events.push({ type: PLAY_EVENT.TIME_UP });
			}
			return events;
		},

		/** One hint per action, per round, up to the maximum that has a hint written. */
		showHint(roundIndex = state.roundIndex) {
			const shown = state.hints[roundIndex] ?? 0;
			state.hints = { ...state.hints, [roundIndex]: shown + 1 };
			return [{ type: PLAY_EVENT.REVEAL, kind: "hint", roundIndex, shown: shown + 1 }];
		},

		beginReview() {
			if (state.stage !== PLAY_STAGE.ROUND && state.stage !== PLAY_STAGE.EXTRA) return [];
			state.stage = PLAY_STAGE.REVIEW;
			state.running = false;
			state.review = { cursor: 0, watermark: 0 };
			state.lastAdvanceAt = Number.NEGATIVE_INFINITY;
			return [];
		},

		/** Reveals one more answer. The watermark keeps the cells already painted. */
		revealNext(now) {
			if (state.stage !== PLAY_STAGE.REVIEW) return [];
			if (state.review.cursor >= reviewCount) return [];
			if (!canAdvance(now)) return [];
			state.review = {
				cursor: state.review.cursor + 1,
				watermark: Math.max(state.review.watermark, state.review.cursor + 1),
			};
			state.lastAdvanceAt = Number.isFinite(now) ? now : Number.NEGATIVE_INFINITY;
			return [{ type: PLAY_EVENT.REVEAL, kind: "solution", revealed: state.review.cursor }];
		},

		/**
		 * Tiebreakers: no clock at all. The moderator shows the scramble, waits for a hand,
		 * and reveals the answer by hand — the spec asks for exactly that.
		 */
		startTiebreak(now) {
			if (state.stage !== PLAY_STAGE.REVIEW) return [];
			if (!canAdvance(now)) return [];
			state.stage = PLAY_STAGE.TIEBREAKER;
			state.tiebreak = { index: 0, anagramShown: false, answerShown: false };
			state.lastAdvanceAt = Number.isFinite(now) ? now : Number.NEGATIVE_INFINITY;
			return [{ type: PLAY_EVENT.REVEAL, kind: "tiebreak-open", index: 0 }];
		},

		showTiebreakAnagram() {
			if (state.stage !== PLAY_STAGE.TIEBREAKER) return [];
			if (state.tiebreak.anagramShown) return [];
			state.tiebreak = { ...state.tiebreak, anagramShown: true };
			return [];
		},

		revealTiebreakAnswer() {
			if (state.stage !== PLAY_STAGE.TIEBREAKER) return [];
			if (state.tiebreak.answerShown) return [];
			state.tiebreak = { ...state.tiebreak, anagramShown: true, answerShown: true };
			return [{ type: PLAY_EVENT.REVEAL, kind: "tiebreak-answer" }];
		},

		nextTiebreak(now) {
			if (state.stage !== PLAY_STAGE.TIEBREAKER) return [];
			if (state.tiebreak.index >= tiebreakCount - 1) return [];
			if (!canAdvance(now)) return [];
			state.tiebreak = { index: state.tiebreak.index + 1, anagramShown: false, answerShown: false };
			state.lastAdvanceAt = Number.isFinite(now) ? now : Number.NEGATIVE_INFINITY;
			return [];
		},

		previousTiebreak() {
			if (state.stage !== PLAY_STAGE.TIEBREAKER) return [];
			if (state.tiebreak.index === 0) return [];
			state.tiebreak = { index: state.tiebreak.index - 1, anagramShown: false, answerShown: false };
			return [];
		},

		closeTiebreak() {
			if (state.stage !== PLAY_STAGE.TIEBREAKER) return [];
			state.stage = PLAY_STAGE.REVIEW;
			state.tiebreak = { index: 0, anagramShown: false, answerShown: false };
			return [];
		},

		/** Going back moves the cursor only: colours already shown stay on the grid. */
		revealPrevious() {
			if (state.stage !== PLAY_STAGE.REVIEW) return [];
			if (state.review.cursor === 0) return [];
			state.review = { ...state.review, cursor: state.review.cursor - 1 };
			return [];
		},

		goToReflection() {
			state.stage = PLAY_STAGE.REFLECTION;
			state.running = false;
			state.pausedForHelp = false;
			return [];
		},

		finish() {
			state.stage = PLAY_STAGE.THANKS;
			state.running = false;
			state.pausedForHelp = false;
			return [];
		},

		/** Help pauses the clock; closing help leaves it paused, as the spec asks. */
		openHelp() {
			state.pausedForHelp = true;
			state.running = false;
			return [];
		},

		closeHelp() {
			state.pausedForHelp = false;
			return [];
		},
	};
}

/** `mm:ss` for the projector. */
export function formatClock(remainingMs) {
	const total = Math.max(0, Math.ceil((Number(remainingMs) || 0) / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
