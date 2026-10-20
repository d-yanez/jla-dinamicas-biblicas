// Sopa de letras engine.
//
// A variant is a complete, verifiable artefact: a 400-letter grid, ten placements with
// start/end coordinates and direction, and the seed that produced it. Nothing here is
// called again at play time — the grid is data, so playing, printing, reloading or
// restoring can never regenerate it.

import { createId } from "./ids.js";
import { isAlphabetLetter, normalizeWord, randomLetter, wordText } from "./letters.js";
import { createPrng, hashSeed } from "./random.js";

export const SOPA_SIZE = 20;
export const SOPA_WORD_COUNT = 10;

/** The eight directions, including the four reversed ones. */
export const DIRECTIONS = Object.freeze([
	Object.freeze({ id: "right", dr: 0, dc: 1, label: "horizontal →" }),
	Object.freeze({ id: "left", dr: 0, dc: -1, label: "horizontal ←" }),
	Object.freeze({ id: "down", dr: 1, dc: 0, label: "vertical ↓" }),
	Object.freeze({ id: "up", dr: -1, dc: 0, label: "vertical ↑" }),
	Object.freeze({ id: "down-right", dr: 1, dc: 1, label: "diagonal ↘" }),
	Object.freeze({ id: "down-left", dr: 1, dc: -1, label: "diagonal ↙" }),
	Object.freeze({ id: "up-right", dr: -1, dc: 1, label: "diagonal ↗" }),
	Object.freeze({ id: "up-left", dr: -1, dc: -1, label: "diagonal ↖" }),
]);

const DIRECTION_BY_ID = new Map(DIRECTIONS.map((direction) => [direction.id, direction]));

const PLACEMENT_ATTEMPTS = 400;
const GRID_ATTEMPTS = 60;

export function directionById(id) {
	return DIRECTION_BY_ID.get(id);
}

export function cellIndex(size, row, col) {
	return row * size + col;
}

/**
 * Indices of the cells a word would occupy, or undefined when it would leave the grid.
 * Direction is read forward from `start`, so a leftward word starts at its rightmost cell.
 */
export function pathCells({ size, start, directionId, length }) {
	if (!Number.isInteger(size) || size < 1) return undefined;
	if (!Number.isInteger(length) || length < 1) return undefined;
	const direction = DIRECTION_BY_ID.get(directionId);
	if (!direction) return undefined;
	if (!Number.isInteger(start?.row) || !Number.isInteger(start?.col)) return undefined;
	const cells = [];
	for (let step = 0; step < length; step += 1) {
		const row = start.row + direction.dr * step;
		const col = start.col + direction.dc * step;
		if (row < 0 || row >= size || col < 0 || col >= size) return undefined;
		cells.push(row * size + col);
	}
	return cells;
}

function prepareWords(words) {
	if (!Array.isArray(words)) return { ok: false, error: "La actividad no tiene palabras." };
	if (words.length !== SOPA_WORD_COUNT) {
		return { ok: false, error: `La sopa de letras necesita exactamente ${SOPA_WORD_COUNT} palabras.` };
	}
	const prepared = [];
	for (const word of words) {
		const normalized = normalizeWord(wordText(word));
		if (!normalized) {
			return { ok: false, error: `La palabra ${JSON.stringify(word?.text ?? "")} no es válida: usá solo letras, máximo 20.` };
		}
		const id = typeof word?.id === "string" && word.id.length > 0 ? word.id : "";
		if (id.length === 0) return { ok: false, error: "Cada palabra necesita un identificador." };
		prepared.push({ id, text: word?.text ?? normalized, normalized });
	}
	const ids = new Set(prepared.map((word) => word.id));
	if (ids.size !== prepared.length) return { ok: false, error: "Cada palabra necesita un identificador distinto." };
	const seen = new Set();
	for (const word of prepared) {
		if (seen.has(word.normalized)) return { ok: false, error: `La palabra ${word.normalized} está repetida.` };
		seen.add(word.normalized);
	}
	return { ok: true, words: prepared };
}

function fitsAt(board, cells, letters) {
	let newCells = 0;
	for (let index = 0; index < letters.length; index += 1) {
		const existing = board[cells[index]];
		if (existing.length === 0) {
			newCells += 1;
			continue;
		}
		if (existing !== letters[index]) return -1;
	}
	return newCells;
}

function placeWord(board, size, word, prng) {
	const letters = word.normalized;
	if (letters.length > size) return undefined;
	for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
		const direction = DIRECTIONS[prng.int(DIRECTIONS.length)];
		const start = { row: prng.int(size), col: prng.int(size) };
		const cells = pathCells({ size, start, directionId: direction.id, length: letters.length });
		if (!cells) continue;
		const newCells = fitsAt(board, cells, letters);
		// Reusing every cell would hide one word inside another: require at least one
		// fresh cell so each word occupies ground of its own.
		if (newCells < 1) continue;
		for (let index = 0; index < cells.length; index += 1) board[cells[index]] = letters[index];
		return {
			wordId: word.id,
			normalized: letters,
			direction: direction.id,
			start: { row: start.row, col: start.col },
			end: { row: start.row + direction.dr * (letters.length - 1), col: start.col + direction.dc * (letters.length - 1) },
		};
	}
	return undefined;
}

/**
 * Builds a verified variant, or explains why it could not. Words are placed longest
 * first (a stable sort, so the same input order always produces the same layout) and
 * each unsuccessful grid is retried with a seed derived from the attempt number.
 */
export function generateVariant({ words, seed, size = SOPA_SIZE }) {
	const prepared = prepareWords(words);
	if (!prepared.ok) return prepared;
	if (!Number.isInteger(size) || size < 2) return { ok: false, error: "El tamaño de la cuadrícula no es válido." };
	const requestedSeed =
		typeof seed === "string" && seed.trim().length > 0 ? seed.trim() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

	const ordered = [...prepared.words].sort((left, right) => right.normalized.length - left.normalized.length);
	for (let attempt = 0; attempt < GRID_ATTEMPTS; attempt += 1) {
		const prng = createPrng(hashSeed(`${requestedSeed}#${attempt}`));
		const board = new Array(size * size).fill("");
		const placements = [];
		let placedAll = true;
		for (const word of ordered) {
			const placement = placeWord(board, size, word, prng);
			if (!placement) {
				placedAll = false;
				break;
			}
			placements.push(placement);
		}
		if (!placedAll) continue;
		const grid = board.map((cell) => (cell.length > 0 ? cell : randomLetter(prng))).join("");
		const variant = {
			id: createId(),
			seed: requestedSeed,
			attempt,
			size,
			grid,
			placements,
			createdAt: new Date().toISOString(),
		};
		// Never hand back a grid that does not verify: the engine and the validator are
		// two independent readings of the same invariant.
		if (!verifyVariant(variant).ok) continue;
		return { ok: true, variant };
	}
	return {
		ok: false,
		error: "No se pudieron acomodar las diez palabras en la cuadrícula. Probá con palabras más cortas o generá otra variante.",
	};
}

function expectedEnd(placement) {
	const direction = directionById(placement.direction);
	if (!direction) return undefined;
	const length = typeof placement.normalized === "string" ? placement.normalized.length : 0;
	if (length === 0) return undefined;
	return {
		row: placement.start.row + direction.dr * (length - 1),
		col: placement.start.col + direction.dc * (length - 1),
	};
}

/**
 * Reads the stored artefact back: size, alphabet, every placement inside the grid, the
 * letters along each path, and the end coordinate matching the direction. This is what
 * makes a stored grid trustworthy without regenerating it.
 */
export function verifyVariant(variant) {
	const errors = [];
	if (typeof variant !== "object" || variant === null) return { ok: false, errors: ["La variante no es válida."] };
	const size = variant.size;
	const sizeValid = Number.isInteger(size) && size >= 2;
	if (!sizeValid) errors.push("El tamaño de la cuadrícula no es válido.");
	const expectedLength = sizeValid ? size * size : 0;
	const grid = variant.grid;
	let lettersReadable = false;
	if (typeof grid !== "string" || grid.length !== expectedLength) {
		errors.push(`La cuadrícula debe tener exactamente ${expectedLength || "400"} letras.`);
	} else {
		lettersReadable = true;
		for (const letter of grid) {
			if (!isAlphabetLetter(letter)) {
				errors.push("La cuadrícula solo admite letras de A a Z.");
				lettersReadable = false;
				break;
			}
		}
	}
	const placements = Array.isArray(variant.placements) ? variant.placements : [];
	if (placements.length === 0) errors.push("La variante no tiene ubicaciones.");
	const seenWordIds = new Set();
	for (const placement of placements) {
		const wordId = typeof placement?.wordId === "string" && placement.wordId.length > 0 ? placement.wordId : "";
		if (wordId.length === 0) {
			errors.push("Una ubicación no tiene palabra asociada.");
			continue;
		}
		if (seenWordIds.has(wordId)) errors.push(`La palabra ${wordId} aparece ubicada más de una vez.`);
		seenWordIds.add(wordId);
		const normalized = typeof placement.normalized === "string" ? placement.normalized : "";
		if (!/^[A-Z]+$/.test(normalized)) {
			errors.push(`La ubicación de ${wordId} no tiene letras válidas.`);
			continue;
		}
		if (!Number.isInteger(placement.start?.row) || !Number.isInteger(placement.start?.col)) {
			errors.push(`La ubicación de ${wordId} no tiene un inicio válido.`);
			continue;
		}
		if (!directionById(placement.direction)) {
			errors.push(`La ubicación de ${wordId} tiene una dirección desconocida.`);
			continue;
		}
		const cells = pathCells({ size, start: placement.start, directionId: placement.direction, length: normalized.length });
		if (!cells) {
			errors.push(`La ubicación de ${wordId} se sale de la cuadrícula.`);
			continue;
		}
		if (lettersReadable) {
			const rebuilt = cells.map((index) => grid[index]).join("");
			if (rebuilt !== normalized) errors.push(`La ubicación de ${wordId} no coincide con la cuadrícula.`);
		}
		const end = expectedEnd(placement);
		if (!end) {
			errors.push(`La ubicación de ${wordId} no tiene un final calculable.`);
		} else if (placement.end?.row !== end.row || placement.end?.col !== end.col) {
			errors.push(`La posición final de ${wordId} no coincide con su dirección.`);
		}
	}
	return { ok: errors.length === 0, errors };
}

/** Normalized words of `words` that the variant does not place. */
export function placementsCoverWords(variant, words) {
	const placed = new Set((variant?.placements ?? []).map((placement) => placement.normalized));
	return (words ?? [])
		.map((word) => normalizeWord(wordText(word)))
		.filter((normalized) => typeof normalized === "string" && normalized.length > 0)
		.filter((normalized) => !placed.has(normalized));
}

/** True when the variant verifies and covers exactly the given words. */
export function variantCoversWords(variant, words) {
	if (!verifyVariant(variant).ok) return false;
	const normalized = (words ?? [])
		.map((word) => normalizeWord(wordText(word)))
		.filter((value) => typeof value === "string" && value.length > 0);
	if (normalized.length === 0) return false;
	const placementWords = (variant.placements ?? []).map((placement) => placement.normalized);
	if (placementWords.length !== normalized.length) return false;
	const remaining = placementsCoverWords(variant, normalized.map((value) => ({ normalized: value })));
	return remaining.length === 0;
}

/** The placement plus the cell indices of its word, for highlighting a solution. */
export function solutionFor(variant, wordId) {
	const placement = (variant?.placements ?? []).find((candidate) => candidate.wordId === wordId);
	if (!placement) return undefined;
	const cells = pathCells({
		size: variant.size,
		start: placement.start,
		directionId: placement.direction,
		length: placement.normalized.length,
	});
	if (!cells) return undefined;
	return { ...placement, cells };
}
