// Activity model: the common fields every game shares, the per-game payload, strict
// validation, and the rules that keep a draft honest (variants invalidated when their
// words change, «probado» invalidated when relevant content changes).

import { MAX_HINTS, HINT_MAX_LENGTH, TIEBREAKER_COUNT, checkAnagramPair, normalizeSolution } from "./anagram.js";
import { createId } from "./ids.js";
import { normalizeWord, wordText } from "./letters.js";
import { SOPA_SIZE, SOPA_WORD_COUNT, verifyVariant } from "./sopa.js";

export const ACTIVITY_TYPE = Object.freeze({ SOPA: "sopa", PALABRAS: "palabras" });
export const ACTIVITY_STATUS = Object.freeze({ DRAFT: "draft", PUBLISHED: "published" });
export const ROUND_SECONDS = Object.freeze({ min: 10, max: 120, default: 30 });

export const PALABRAS_WORD_COUNT = 10;

const TYPE_LABELS = Object.freeze({ sopa: "sopa de letras", palabras: "palabras desordenadas" });

const TEXT_FIELDS = Object.freeze([
	"name",
	"theme",
	"reference",
	"teaching",
	"instructions",
	"reflection",
	"reflectionReference",
	"eventName",
	"eventDate",
]);

function nonEmpty(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function isRoundSeconds(value) {
	return Number.isInteger(value) && value >= ROUND_SECONDS.min && value <= ROUND_SECONDS.max;
}

function emptyGame(type) {
	if (type === ACTIVITY_TYPE.PALABRAS) return { words: [], tiebreakers: [] };
	return { words: [], variants: [], approvedVariantId: "" };
}

export function createActivity({ type = ACTIVITY_TYPE.SOPA, name = "" } = {}) {
	const now = new Date().toISOString();
	return {
		id: createId(),
		schema: 1,
		// Set only on the activities the app ships with, so seeding can tell an example
		// from a copy or from the moderator's own work.
		exampleKey: "",
		type,
		status: ACTIVITY_STATUS.DRAFT,
		name,
		theme: "",
		reference: "",
		teaching: "",
		instructions: "",
		reflection: "",
		reflectionReference: "",
		eventName: "",
		eventDate: "",
		roundSeconds: ROUND_SECONDS.default,
		testedAt: "",
		testedSignature: "",
		publishedAt: "",
		createdAt: now,
		updatedAt: now,
		game: emptyGame(type),
	};
}

/**
 * Order-insensitive signature of the normalized word set. Reordering is a presentation
 * decision in the sopa, so it must not count as a content change there.
 */
export function wordsSignature(words) {
	return (words ?? [])
		.map((word) => normalizeWord(wordText(word)))
		.filter((normalized) => typeof normalized === "string")
		.sort()
		.join("|");
}

/**
 * What has to stay identical for a previous «probado» run to still mean something.
 *
 * Name, event and date are excluded on purpose: they appear on the printout but do not
 * change what the pair of players faces. In palabras desordenadas the round order is
 * part of the game, so there it is included; in the sopa it is not.
 */
export function relevantContentSignature(activity) {
	const common = {
		type: activity?.type ?? "",
		roundSeconds: activity?.roundSeconds ?? 0,
		instructions: activity?.instructions ?? "",
	};
	const game = activity?.game ?? {};
	if (activity?.type === ACTIVITY_TYPE.PALABRAS) {
		return JSON.stringify({
			...common,
			words: (game.words ?? []).map((word) => [
				normalizeSolution(word?.solution) ?? "",
				normalizeSolution(word?.anagram) ?? "",
				(word?.hints ?? []).map((hint) => String(hint).trim()),
			]),
			tiebreakers: (game.tiebreakers ?? []).map((tiebreaker) => [
				normalizeSolution(tiebreaker?.solution) ?? "",
				normalizeSolution(tiebreaker?.anagram) ?? "",
			]),
		});
	}
	const approved = (game.variants ?? []).find((variant) => variant.id === game.approvedVariantId);
	return JSON.stringify({
		...common,
		words: wordsSignature(game.words),
		grid: approved?.grid ?? "",
		placements: (approved?.placements ?? []).map((placement) => [
			placement.normalized,
			placement.direction,
			placement.start?.row ?? -1,
			placement.start?.col ?? -1,
		]),
	});
}

export function markTested(activity, when = new Date().toISOString()) {
	return { ...activity, testedAt: when, testedSignature: relevantContentSignature(activity) };
}

export function refreshTestedState(activity) {
	const signature = relevantContentSignature(activity);
	if (activity?.testedSignature === signature) return activity;
	return { ...activity, testedAt: "", testedSignature: signature };
}

// ------------------------------------------------------------------- normalize

function normalizeVariant(variant) {
	if (!verifyVariant(variant).ok) return undefined;
	return {
		id: variant.id,
		seed: String(variant.seed ?? ""),
		attempt: Number.isInteger(variant.attempt) ? variant.attempt : 0,
		size: variant.size,
		grid: variant.grid,
		createdAt: String(variant.createdAt ?? ""),
		placements: variant.placements.map((placement) => ({
			wordId: placement.wordId,
			normalized: placement.normalized,
			direction: placement.direction,
			start: { row: placement.start.row, col: placement.start.col },
			end: { row: placement.end.row, col: placement.end.col },
		})),
	};
}

function normalizeSopaGame(value) {
	const game = emptyGame(ACTIVITY_TYPE.SOPA);
	if (typeof value !== "object" || value === null) return game;
	if (Array.isArray(value.words)) {
		game.words = value.words.flatMap((word) => {
			const text = typeof word?.text === "string" ? word.text : "";
			const normalized = normalizeWord(text);
			if (!normalized) return [];
			const id = typeof word?.id === "string" && word.id.length > 0 ? word.id : createId();
			return [{ id, text, normalized }];
		});
	}
	if (Array.isArray(value.variants)) {
		game.variants = value.variants.map(normalizeVariant).filter(Boolean);
	}
	if (typeof value.approvedVariantId === "string" && game.variants.some((variant) => variant.id === value.approvedVariantId)) {
		game.approvedVariantId = value.approvedVariantId;
	}
	return game;
}

function normalizeHints(value) {
	if (!Array.isArray(value)) return [];
	// An empty hint is a row the moderator just added. Dropping it made the new input
	// disappear on the next autosave; validation is what decides whether it is usable.
	return value
		.filter((hint) => typeof hint === "string")
		.map((hint) => hint.trim())
		.slice(0, MAX_HINTS);
}

function normalizePalabrasEntry(value, { withHints }) {
	const solution = typeof value?.solution === "string" ? value.solution : "";
	const normalized = normalizeSolution(solution);
	if (normalized === undefined) return undefined;
	const entry = {
		id: typeof value?.id === "string" && value.id.length > 0 ? value.id : createId(),
		solution,
		normalized,
		// The anagram is kept exactly as written; validation is what rejects a mismatch,
		// so a half-edited draft is never silently repaired or discarded.
		anagram: typeof value?.anagram === "string" ? value.anagram : "",
	};
	if (withHints) entry.hints = normalizeHints(value?.hints);
	return entry;
}

function normalizePalabrasGame(value) {
	const game = emptyGame(ACTIVITY_TYPE.PALABRAS);
	if (typeof value !== "object" || value === null) return game;
	if (Array.isArray(value.words)) {
		game.words = value.words.map((word) => normalizePalabrasEntry(word, { withHints: true })).filter(Boolean);
	}
	if (Array.isArray(value.tiebreakers)) {
		game.tiebreakers = value.tiebreakers.map((entry) => normalizePalabrasEntry(entry, { withHints: false })).filter(Boolean);
	}
	return game;
}

/** Lenient read of a stored activity: unknown keys dropped, invalid data defaulted. */
export function normalizeActivity(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	if (value.type !== ACTIVITY_TYPE.SOPA && value.type !== ACTIVITY_TYPE.PALABRAS) return undefined;
	const type = value.type;
	const base = createActivity({ type });
	const activity = { ...base };
	if (typeof value.id === "string" && value.id.length > 0) activity.id = value.id;
	if (typeof value.exampleKey === "string" && value.exampleKey.length > 0) activity.exampleKey = value.exampleKey;
	for (const field of TEXT_FIELDS) {
		if (typeof value[field] === "string") activity[field] = value[field];
	}
	activity.status = value.status === ACTIVITY_STATUS.PUBLISHED ? ACTIVITY_STATUS.PUBLISHED : ACTIVITY_STATUS.DRAFT;
	activity.roundSeconds = isRoundSeconds(value.roundSeconds) ? value.roundSeconds : ROUND_SECONDS.default;
	if (typeof value.testedAt === "string") activity.testedAt = value.testedAt;
	if (typeof value.testedSignature === "string") activity.testedSignature = value.testedSignature;
	if (typeof value.publishedAt === "string") activity.publishedAt = value.publishedAt;
	if (typeof value.createdAt === "string") activity.createdAt = value.createdAt;
	if (typeof value.updatedAt === "string") activity.updatedAt = value.updatedAt;
	activity.game = type === ACTIVITY_TYPE.PALABRAS ? normalizePalabrasGame(value.game) : normalizeSopaGame(value.game);
	return activity;
}

// --------------------------------------------------------------------- derive

function variantCoversWordsSafe(variant, validWords) {
	if (!verifyVariant(variant).ok) return false;
	if (variant.size !== SOPA_SIZE) return false;
	const placed = new Set((variant.placements ?? []).map((placement) => placement.normalized));
	if (placed.size !== validWords.length) return false;
	return validWords.every((word) => placed.has(word.normalized));
}

/**
 * Recomputes what is derivable and drops what no longer holds.
 *
 * Sopa: a variant that does not cover the current words is discarded, because it would
 * place a word nobody can find. Palabras: solutions are re-normalized; anagrams and
 * hints are kept as written so the editor can show and explain the exact problem.
 */
export function refreshDerivedState(activity) {
	if (activity?.type === ACTIVITY_TYPE.PALABRAS) {
		const words = (activity.game?.words ?? [])
			.map((word) => ({ ...word, normalized: normalizeSolution(word.solution) }))
			.filter((word) => typeof word.normalized === "string");
		const tiebreakers = (activity.game?.tiebreakers ?? [])
			.map((tiebreaker) => ({ ...tiebreaker, normalized: normalizeSolution(tiebreaker.solution) }))
			.filter((tiebreaker) => typeof tiebreaker.normalized === "string");
		return refreshTestedState({ ...activity, game: { ...activity.game, words, tiebreakers } });
	}
	const words = (activity?.game?.words ?? []).map((word) => {
		const normalized = normalizeWord(word.text);
		return { ...word, normalized };
	});
	const validWords = words.filter((word) => typeof word.normalized === "string");
	const game = { ...activity.game, words };
	game.variants = (game.variants ?? []).filter((variant) => variantCoversWordsSafe(variant, validWords));
	if (!game.variants.some((variant) => variant.id === game.approvedVariantId)) game.approvedVariantId = "";
	return refreshTestedState({ ...activity, game });
}

/** A duplicated activity is always an independent draft, never a published twin. */
export function duplicateAsDraft(activity) {
	const source = normalizeActivity(activity) ?? createActivity({ type: activity?.type });
	const now = new Date().toISOString();
	const game =
		source.type === ACTIVITY_TYPE.PALABRAS
			? {
					words: source.game.words.map((word) => ({ ...word, hints: [...(word.hints ?? [])] })),
					tiebreakers: source.game.tiebreakers.map((tiebreaker) => ({ ...tiebreaker })),
				}
			: {
					words: source.game.words.map((word) => ({ ...word })),
					variants: source.game.variants.map((variant) => ({
						...variant,
						placements: variant.placements.map((placement) => ({
							...placement,
							start: { ...placement.start },
							end: { ...placement.end },
						})),
					})),
					approvedVariantId: source.game.approvedVariantId,
				};
	const copy = {
		...source,
		id: createId(),
		exampleKey: "",
		status: ACTIVITY_STATUS.DRAFT,
		name: `${source.name} (copia)`,
		testedAt: "",
		testedSignature: "",
		publishedAt: "",
		createdAt: now,
		updatedAt: now,
		game,
	};
	return refreshTestedState(copy);
}

// ------------------------------------------------------------------- validate

/**
 * Strict publication validation. Every error names its field and says what to fix, and
 * the caller decides how to present them; nothing here mutates the activity.
 */
export function validateActivity(activity, options = {}) {
	const errors = [];
	const push = (field, message) => errors.push({ field, message });
	if (typeof activity !== "object" || activity === null) {
		push("activity", "La actividad no es válida.");
		return { ok: false, errors };
	}
	if (!nonEmpty(activity.name)) push("name", "El nombre de la actividad es obligatorio.");
	if (!nonEmpty(activity.theme)) push("theme", "El tema bíblico es obligatorio.");
	if (!nonEmpty(activity.instructions)) push("instructions", "Las instrucciones introductorias son obligatorias.");
	if (!isRoundSeconds(activity.roundSeconds)) {
		push("roundSeconds", `La duración de cada ronda debe ser un número entre ${ROUND_SECONDS.min} y ${ROUND_SECONDS.max} segundos.`);
	}
	if (activity.type === ACTIVITY_TYPE.SOPA) validateSopa(activity, push);
	if (activity.type === ACTIVITY_TYPE.PALABRAS) validatePalabras(activity, push);
	const published = (options.publishedOfType ?? []).filter(
		(candidate) => candidate && candidate.type === activity.type && candidate.status === ACTIVITY_STATUS.PUBLISHED && candidate.id !== activity.id,
	);
	if (published.length > 0) {
		push("status", `Ya hay una actividad publicada de ${TYPE_LABELS[activity.type] ?? "este juego"}: solo puede haber una.`);
	}
	return { ok: errors.length === 0, errors };
}

function validateSopa(activity, push) {
	const words = activity.game?.words ?? [];
	if (words.length !== SOPA_WORD_COUNT) {
		push("game.words", `La sopa de letras necesita exactamente ${SOPA_WORD_COUNT} palabras.`);
	} else {
		words.forEach((word, index) => {
			if (typeof normalizeWord(word?.text) !== "string") {
				push("game.words", `La palabra ${index + 1} no es válida: usá solo letras, sin números ni espacios, máximo 20.`);
			}
		});
		const seen = new Set();
		for (const word of words) {
			const normalized = normalizeWord(word?.text);
			if (typeof normalized !== "string") continue;
			if (seen.has(normalized)) push("game.words", `La palabra ${normalized} está repetida.`);
			seen.add(normalized);
		}
	}
	const approved = (activity.game?.variants ?? []).find((variant) => variant.id === activity.game?.approvedVariantId);
	if (!approved) {
		push("game.approvedVariantId", "Falta aprobar una variante de la cuadrícula.");
	} else if (!variantCoversWordsSafe(approved, words.filter((word) => typeof normalizeWord(word?.text) === "string"))) {
		push("game.approvedVariantId", "La variante aprobada no coincide con las palabras actuales: generá y aprobá una variante nueva.");
	}
}

function validatePalabrasEntry(entry, index, field, push, { label, withHints }) {
	const solution = normalizeSolution(entry?.solution);
	if (solution === undefined) {
		push(field, `La ${label} ${index + 1} no es válida: usá solo letras, de 2 a 20, sin números ni espacios.`);
		return;
	}
	const pair = checkAnagramPair({ solution: entry.solution, anagram: entry.anagram });
	if (!pair.ok) {
		push(field, `La ${label} ${index + 1} (${solution}): ${pair.message}`);
		return;
	}
	if (!withHints) return;
	const hints = Array.isArray(entry?.hints) ? entry.hints : [];
	if (hints.length > MAX_HINTS) push(field, `La ${label} ${index + 1} admite hasta dos pistas.`);
	for (const hint of hints) {
		if (typeof hint === "string" && hint.trim().length > HINT_MAX_LENGTH) {
			push(field, `Cada pista de la ${label} ${index + 1} admite hasta ${HINT_MAX_LENGTH} caracteres.`);
			break;
		}
	}
}

function validatePalabras(activity, push) {
	const words = activity.game?.words ?? [];
	if (words.length !== PALABRAS_WORD_COUNT) {
		push("game.words", `Las palabras desordenadas necesitan exactamente ${PALABRAS_WORD_COUNT} palabras.`);
	}
	words.forEach((word, index) => validatePalabrasEntry(word, index, "game.words", push, { label: "palabra", withHints: true }));
	const tiebreakers = activity.game?.tiebreakers ?? [];
	if (tiebreakers.length !== TIEBREAKER_COUNT) {
		push(
			"game.tiebreakers",
			`La actividad necesita exactamente ${TIEBREAKER_COUNT} palabras de desempate: una principal y dos reservas.`,
		);
	}
	tiebreakers.forEach((tiebreaker, index) =>
		validatePalabrasEntry(tiebreaker, index, "game.tiebreakers", push, { label: "palabra de desempate", withHints: false }),
	);
}
