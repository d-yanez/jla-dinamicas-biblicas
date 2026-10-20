// Anagram engine for "Palabras desordenadas".
//
// The rule the specification calls "mismo multiconjunto de letras": the solution and its
// anagram must contain exactly the same letters, no more and no fewer. Normalization is
// the same one the grid uses (uppercase, accents folded, A-Z only), documented once in
// letters.js and applied here.
//
// The anagram is stored and shown normalized: scrambling "ORACIÓN" with its accents
// would leak where the accent belongs and give away part of the answer.

import { normalizeWord } from "./letters.js";
import { createPrng, hashSeed } from "./random.js";

export const MIN_SOLUTION_LENGTH = 2;
export const MAX_HINTS = 2;
export const HINT_MAX_LENGTH = 140;
export const TIEBREAKER_COUNT = 3;
export const MAX_REVEALS = 2;

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

const SHUFFLE_ATTEMPTS = 300;
// A one-swap scramble is too easy to spot; prefer moving at least two letters.
const PREFERRED_CHANGED_POSITIONS = 2;

/** Solvable word: same normalization as the grid, but at least two letters. */
export function normalizeSolution(value) {
	const normalized = normalizeWord(value);
	if (typeof normalized !== "string" || normalized.length < MIN_SOLUTION_LENGTH) return undefined;
	return normalized;
}

/**
 * Positions revealed by one "descubrimiento", in order.
 *
 * Level 1 reveals the vowels, because the vowel skeleton turns the round into a shared
 * guessing moment instead of an incidental hint. Level 2 adds the last consonant, so the
 * second reveal still has something to give. A word with no vowels falls back to its
 * first consonant; a word with no consonants simply has nothing extra to add.
 *
 * The result is a position list, stored with the word: the play screen never recomputes
 * it, so a reveal cannot change between playing, restoring or reloading.
 */
export function computeReveals(solution, level = 1) {
	const normalized = normalizeSolution(solution);
	if (normalized === undefined) return [];
	const requested = Number.isInteger(level) ? level : 0;
	if (requested < 1) return [];
	const vowels = [];
	const consonants = [];
	for (let index = 0; index < normalized.length; index += 1) {
		if (VOWELS.has(normalized[index])) vowels.push(index);
		else consonants.push(index);
	}
	const revealed = vowels.length > 0 ? [...vowels] : consonants.slice(0, 1);
	if (requested < 2) return revealed;
	const extra = consonants.filter((index) => !revealed.includes(index)).at(-1);
	if (extra !== undefined) revealed.push(extra);
	return revealed;
}

/** The sorted letters of a word, which is what "mismo multiconjunto" compares. */
export function letterMultiset(value) {
	const normalized = normalizeWord(value) ?? "";
	return [...normalized].sort().join("");
}

/**
 * Validates one solution/anagram pair. Returns the normalized forms on success, or a
 * code and a message that says what to fix on failure.
 */
export function checkAnagramPair({ solution, anagram } = {}) {
	const normalizedSolution = normalizeSolution(solution);
	if (normalizedSolution === undefined) {
		return {
			ok: false,
			code: "invalid_solution",
			message: `La solución debe ser una palabra de ${MIN_SOLUTION_LENGTH} a 20 letras, sin números ni espacios.`,
		};
	}
	const normalizedAnagram = normalizeSolution(anagram);
	if (normalizedAnagram === undefined) {
		return {
			ok: false,
			code: "invalid_anagram",
			message: "El anagrama debe tener letras de A a Z, de 2 a 20, sin números ni espacios.",
		};
	}
	if (letterMultiset(normalizedSolution) !== letterMultiset(normalizedAnagram)) {
		return {
			ok: false,
			code: "letters_mismatch",
			message: "El anagrama debe tener exactamente las mismas letras que la solución: ni una más, ni una menos.",
		};
	}
	if (normalizedSolution === normalizedAnagram) {
		return { ok: false, code: "identical", message: `El anagrama no puede ser igual a la solución (${normalizedSolution}).` };
	}
	return { ok: true, solution: normalizedSolution, anagram: normalizedAnagram };
}

function changedPositions(left, right) {
	let changed = 0;
	for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) changed += 1;
	return changed;
}

/**
 * Builds a deterministic scramble from a seed. Returns an error when no anagram can be
 * different from the solution (every letter identical), instead of a trivial one.
 */
export function generateAnagram({ solution, seed } = {}) {
	const normalized = normalizeSolution(solution);
	if (normalized === undefined) {
		return { ok: false, error: `La solución debe ser una palabra de ${MIN_SOLUTION_LENGTH} a 20 letras.` };
	}
	const seedText = typeof seed === "string" && seed.trim().length > 0 ? seed.trim() : normalized;
	const prng = createPrng(hashSeed(`${seedText}#anagram`));
	const letters = [...normalized];
	let fallback;
	for (let attempt = 0; attempt < SHUFFLE_ATTEMPTS; attempt += 1) {
		const shuffled = prng.shuffle(letters).join("");
		if (shuffled === normalized) continue;
		if (changedPositions(shuffled, normalized) >= PREFERRED_CHANGED_POSITIONS) return { ok: true, anagram: shuffled };
		if (fallback === undefined) fallback = shuffled;
	}
	if (fallback !== undefined) return { ok: true, anagram: fallback };
	return {
		ok: false,
		error: `No se puede generar un anagrama distinto de ${normalized}: todas sus letras son iguales.`,
	};
}
