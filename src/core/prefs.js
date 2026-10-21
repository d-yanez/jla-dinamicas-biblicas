// Display preferences shared by the whole app: projection size and contrast.
// Defaults follow the spec: size "grande" and the JLA style (contrast "jla").

export const DISPLAY_SIZES = Object.freeze(["normal", "grande"]);
export const CONTRAST_MODES = Object.freeze(["jla", "alto"]);
export const PREFS_STORAGE_KEY = "jla.prefs";

export const DEFAULT_PREFS = Object.freeze({
	displaySize: "grande",
	highContrast: false,
	soundVolume: 0.3,
	muted: false,
	soundTicks: true,
	soundBell: true,
	soundReveal: true,
	soundLobby: true,
	soundQuestion: true,
	soundCountdown: true,
	soundClosing: true,
});

/**
 * Always returns a usable preference object. Stored values are untrusted: an
 * unknown size or a non-boolean flag falls back to its default instead of
 * throwing, because a corrupt preference must never block the app.
 */
export function normalizePrefs(value) {
	const source = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
	const displaySize = DISPLAY_SIZES.includes(source.displaySize) ? source.displaySize : DEFAULT_PREFS.displaySize;
	const highContrast = typeof source.highContrast === "boolean" ? source.highContrast : DEFAULT_PREFS.highContrast;
	const volumeRaw = Number(source.soundVolume);
	const soundVolume = Number.isFinite(volumeRaw) && volumeRaw >= 0 && volumeRaw <= 1
		? Math.round(volumeRaw * 100) / 100
		: DEFAULT_PREFS.soundVolume;
	const muted = typeof source.muted === "boolean" ? source.muted : DEFAULT_PREFS.muted;
	const flag = (key) => (typeof source[key] === "boolean" ? source[key] : DEFAULT_PREFS[key]);
	return {
		displaySize,
		highContrast,
		soundVolume,
		muted,
		soundTicks: flag("soundTicks"),
		soundBell: flag("soundBell"),
		soundReveal: flag("soundReveal"),
		soundLobby: flag("soundLobby"),
		soundQuestion: flag("soundQuestion"),
		soundCountdown: flag("soundCountdown"),
		soundClosing: flag("soundClosing"),
	};
}

/**
 * Reads preferences from synchronous web storage.
 *
 * Preferences deliberately do not use IndexedDB: its writes are asynchronous, and a
 * moderator who toggles contrast and immediately reloads (or closes the app) would
 * lose the change with no error. localStorage is synchronous and its failure modes
 * are recoverable, so a lost write is not silent. Anything unreadable falls back to
 * the defaults instead of blocking the app.
 */
export function readStoredPrefs(storage = globalThis.localStorage) {
	let raw = null;
	try {
		raw = storage?.getItem(PREFS_STORAGE_KEY) ?? null;
	} catch {
		return DEFAULT_PREFS;
	}
	if (typeof raw !== "string" || raw.length === 0) return DEFAULT_PREFS;
	try {
		return normalizePrefs(JSON.parse(raw));
	} catch {
		return DEFAULT_PREFS;
	}
}

/** Writes normalized preferences. Returns false when storage refuses the write. */
export function writeStoredPrefs(prefs, storage = globalThis.localStorage) {
	try {
		if (!storage) return false;
		storage.setItem(PREFS_STORAGE_KEY, JSON.stringify(normalizePrefs(prefs)));
		return true;
	} catch {
		return false;
	}
}

/** Applies preferences to the document root; the CSS owns the actual styling. */
export function applyPrefsToDocument(prefs, root = globalThis.document?.documentElement) {
	if (!root) return;
	const normalized = normalizePrefs(prefs);
	root.dataset.size = normalized.displaySize;
	root.dataset.contrast = normalized.highContrast ? "alto" : "jla";
}
