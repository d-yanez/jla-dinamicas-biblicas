// WebAudio engine: bell, tick and the tension layer, synthesized.
//
// No files and no CDN: every sound is an oscillator with an envelope, so the app stays
// weightless and works offline from the first use. The context is created on the first
// user gesture, because browsers refuse to start audio before one.

import { DEFAULT_VOLUME, normalizeVolume } from "../core/audio-plan.js";

export function createAudioEngine({ volume = DEFAULT_VOLUME, muted = false } = {}) {
	let context;
	let master;
	let currentVolume = normalizeVolume(volume);
	let mutedNow = muted === true;

	function ensure() {
		if (typeof window === "undefined") return undefined;
		if (!context) {
			const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
			if (typeof AudioContextClass !== "function") return undefined;
			try {
				context = new AudioContextClass();
				master = context.createGain();
				master.gain.value = mutedNow ? 0 : currentVolume;
				master.connect(context.destination);
			} catch {
				context = undefined;
				return undefined;
			}
		}
		if (context.state === "suspended") void context.resume();
		return context;
	}

	function tone({ frequency, type = "sine", duration, gain, detune = 0, startAt = 0, when }) {
		const ctx = ensure();
		if (!ctx || !master) return;
		const at = when ?? ctx.currentTime + startAt;
		const oscillator = ctx.createOscillator();
		const envelope = ctx.createGain();
		oscillator.type = type;
		oscillator.frequency.value = frequency;
		oscillator.detune.value = detune;
		envelope.gain.setValueAtTime(0.0001, at);
		envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.012);
		envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
		oscillator.connect(envelope);
		envelope.connect(master);
		oscillator.start(at);
		oscillator.stop(at + duration + 0.05);
	}

	function bell(kind = "start") {
		const base = kind === "end" ? 392 : 523.25;
		tone({ frequency: base, duration: 1.1, gain: 0.5 });
		tone({ frequency: base * 2.76, duration: 0.7, gain: 0.18 });
		tone({ frequency: base / 2, duration: 1.4, gain: 0.3 });
	}

	/** A short rising chime: something was just revealed. */
	function reveal() {
		tone({ frequency: 880, duration: 0.24, gain: 0.34 });
		tone({ frequency: 1320, duration: 0.34, gain: 0.2, startAt: 0.09 });
		tone({ frequency: 1760, type: "triangle", duration: 0.5, gain: 0.1, startAt: 0.18 });
	}

	function tick(intensity = 0) {
		const level = Math.min(4, Math.max(0, Number(intensity) || 0));
		tone({ frequency: 1180 + level * 90, type: "triangle", duration: 0.07, gain: 0.1 + level * 0.05 });
	}

	// ---------------------------------------------------------------- music
	//
	// Synthesized loops: an arpeggio, a bass and nothing else, scheduled ahead of time so
	// the rhythm does not drift. No files, no licences, and it stops the moment the screen
	// changes.

	const MUSIC = {
		lobby: { bpm: 84, gain: 0.1, steps: [0, 4, 7, 4, 9, 7, 4, 2], bass: [0, 0, 5, 5] },
		question: { bpm: 126, gain: 0.13, steps: [0, 4, 7, 9, 7, 4, 0, 4], bass: [0, 0, 5, 7] },
	};
	let music;

	const frequencyFor = (semitones) => 261.63 * 2 ** (semitones / 12);

	function scheduleMusic() {
		if (!music || !context) return;
		const { pattern } = music;
		const stepSeconds = 60 / pattern.bpm / 2;
		while (music.nextTime < context.currentTime + 0.4) {
			const step = music.step % pattern.steps.length;
			tone({
				frequency: frequencyFor(pattern.steps[step]),
				type: "triangle",
				duration: stepSeconds * 0.85,
				gain: pattern.gain,
				when: music.nextTime,
			});
			if (step % 4 === 0) {
				const bass = pattern.bass[Math.floor(music.step / 4) % pattern.bass.length];
				tone({
					frequency: frequencyFor(bass - 24),
					type: "sine",
					duration: stepSeconds * 3.4,
					gain: pattern.gain * 0.9,
					when: music.nextTime,
				});
			}
			music.nextTime += stepSeconds;
			music.step += 1;
		}
	}

	function startMusic(kind) {
		if (!kind || musicOff(kind)) {
			stopMusic();
			return;
		}
		const pattern = MUSIC[kind];
		if (!pattern) return;
		if (music?.kind === kind) return;
		const ctx = ensure();
		if (!ctx) return;
		stopMusic();
		music = { kind, pattern, step: 0, nextTime: ctx.currentTime + 0.1, timer: undefined };
		music.timer = window.setInterval(scheduleMusic, 120);
		scheduleMusic();
	}

	function stopMusic() {
		if (music?.timer !== undefined) window.clearInterval(music.timer);
		music = undefined;
	}

	let musicOff = () => false;
	/** The play screen decides per kind, so the engine stays free of preferences. */
	function setMusicGate(gate) {
		musicOff = typeof gate === "function" ? gate : () => false;
	}

	/** Three rising beeps for the countdown, the last one resolving into a bell. */
	function beep(step = 3) {
		tone({ frequency: 520 + (3 - Math.max(1, step)) * 90, type: "triangle", duration: 0.14, gain: 0.3 });
	}

	/** A soft major chord to close the activity. */
	function playClosing() {
		[0, 4, 7, 12].forEach((semitones, index) => {
			tone({ frequency: frequencyFor(semitones), duration: 1.6, gain: 0.16, startAt: index * 0.06 });
		});
	}

	function setVolume(next) {
		currentVolume = normalizeVolume(next);
		if (master && context) master.gain.setTargetAtTime(mutedNow ? 0 : currentVolume, context.currentTime, 0.05);
		return currentVolume;
	}

	function setMuted(next) {
		mutedNow = next === true;
		if (master && context) master.gain.setTargetAtTime(mutedNow ? 0 : currentVolume, context.currentTime, 0.05);
		return mutedNow;
	}

	function play(plan) {
		for (const item of plan ?? []) {
			if (item.sound === "bell") bell(item.kind);
			else if (item.sound === "tick") tick(item.intensity);
			else if (item.sound === "reveal") reveal();
		}
	}

	function dispose() {
		stopMusic();
		if (context) {
			try {
				void context.close();
			} catch {
				/* already closed */
			}
		}
		context = undefined;
		master = undefined;
	}

	return {
		unlock: ensure,
		play,
		bell,
		tick,
		reveal,
		beep,
		playClosing,
		startMusic,
		stopMusic,
		setMusicGate,
		setVolume,
		setMuted,
		isMuted: () => mutedNow,
		volume: () => currentVolume,
		dispose,
	};
}
