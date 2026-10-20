// Grid alphabet and word normalization.
//
// The grid stores only A-Z: exactly one letter per cell, exactly 400 cells, and a
// comparison that cannot be ambiguous because of Unicode composition. A word keeps two
// forms — `text` exactly as the moderator typed it (accents included, shown to the
// public) and `normalized` (what is placed and verified in the grid).

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const MAX_WORD_LENGTH = 20;

const LETTERS = new Set(ALPHABET);

export function isAlphabetLetter(value) {
	return typeof value === "string" && value.length === 1 && LETTERS.has(value);
}

/**
 * Uppercase, accent-free form of a single word, or undefined when the text is not a
 * single word of letters (digits, spaces, punctuation) or does not fit the grid.
 */
export function normalizeWord(value) {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	// NFD splits "Ó" into "O" + combining acute; dropping the marks folds accents and
	// the eñe onto the grid alphabet.
	const stripped = trimmed
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase();
	if (!/^[A-Z]+$/.test(stripped)) return undefined;
	if (stripped.length > MAX_WORD_LENGTH) return undefined;
	return stripped;
}

export function randomLetter(prng) {
	return ALPHABET[prng.int(ALPHABET.length)];
}

/**
 * The text to normalize for a word record.
 *
 * `text` is the source of truth and `normalized` is only a cache of it. Preferring the
 * cache made the engine place the previous word after an edit that had not been saved
 * yet — the grid looked like it never updated. A record without text (older data) still
 * falls back to its normalized form.
 */
export function wordText(word) {
	if (typeof word?.text === "string" && word.text.trim().length > 0) return word.text;
	if (typeof word?.normalized === "string" && word.normalized.length > 0) return word.normalized;
	return undefined;
}
