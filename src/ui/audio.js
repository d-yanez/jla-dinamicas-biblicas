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

	function tone({ frequency, type = "sine", duration, gain, detune = 0, startAt = 0 }) {
		const ctx = ensure();
		if (!ctx || !master) return;
		const at = ctx.currentTime + startAt;
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
		setVolume,
		setMuted,
		isMuted: () => mutedNow,
		volume: () => currentVolume,
		dispose,
	};
}
