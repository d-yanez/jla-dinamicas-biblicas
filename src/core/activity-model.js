// Activity model: the common fields every game shares, the sopa-specific payload,
// strict validation, and the rules that keep a draft honest (variants invalidated when
// their words change, «probado» invalidated when relevant content changes).

import { createId } from "./ids.js";
import { normalizeWord, wordText } from "./letters.js";
import { SOPA_SIZE, SOPA_WORD_COUNT, verifyVariant } from "./sopa.js";

export const ACTIVITY_TYPE = Object.freeze({ SOPA: "sopa", PALABRAS: "palabras" });
export const ACTIVITY_STATUS = Object.freeze({ DRAFT: "draft", PUBLISHED: "published" });
export const ROUND_SECONDS = Object.freeze({ min: 10, max: 120, default: 30 });

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

function emptyGame() {
	return { words: [], variants: [], approvedVariantId: "" };
}

export function createActivity({ type = ACTIVITY_TYPE.SOPA, name = "" } = {}) {
	const now = new Date().toISOString();
	return {
		id: createId(),
		schema: 1,
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
		game: emptyGame(),
	};
}

/**
 * Order-insensitive signature of the normalized word set. Reordering is a presentation
 * decision, so it must not count as a content change.
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
 * Name, event and date are excluded on purpose: they appear on the printout but do not
 * change what the pair of players faces.
 */
export function relevantContentSignature(activity) {
	const game = activity?.game ?? {};
	const approved = (game.variants ?? []).find((variant) => variant.id === game.approvedVariantId);
	return JSON.stringify({
		type: activity?.type ?? "",
		roundSeconds: activity?.roundSeconds ?? 0,
		instructions: activity?.instructions ?? "",
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

function normalizeGame(value) {
	const game = emptyGame();
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

/** Lenient read of a stored activity: unknown keys dropped, invalid data defaulted. */
export function normalizeActivity(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	if (value.type !== ACTIVITY_TYPE.SOPA && value.type !== ACTIVITY_TYPE.PALABRAS) return undefined;
	const type = value.type;
	const base = createActivity({ type });
	const activity = { ...base };
	if (typeof value.id === "string" && value.id.length > 0) activity.id = value.id;
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
	activity.game = normalizeGame(value.game);
	return activity;
}

/**
 * Recomputes what is derivable from the words and drops variants that no longer cover
 * them. Changing a word cannot leave an approved grid behind: that grid would place a
 * word nobody can find. Reordering keeps the grid, because the word set is the same.
 */
export function refreshDerivedState(activity) {
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

function variantCoversWordsSafe(variant, validWords) {
	if (!verifyVariant(variant).ok) return false;
	if (variant.size !== SOPA_SIZE) return false;
	const placed = new Set((variant.placements ?? []).map((placement) => placement.normalized));
	if (placed.size !== validWords.length) return false;
	return validWords.every((word) => placed.has(word.normalized));
}

/** A duplicated activity is always an independent draft, never a published twin. */
export function duplicateAsDraft(activity) {
	const source = normalizeActivity(activity) ?? createActivity({ type: activity?.type });
	const now = new Date().toISOString();
	const copy = {
		...source,
		id: createId(),
		status: ACTIVITY_STATUS.DRAFT,
		name: `${source.name} (copia)`,
		testedAt: "",
		testedSignature: "",
		publishedAt: "",
		createdAt: now,
		updatedAt: now,
		game: {
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
		},
	};
	return refreshTestedState(copy);
}

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
	if (activity.type === ACTIVITY_TYPE.PALABRAS) {
		// The engine for this game arrives in phase 3; until then its specifics cannot be
		// validated, and pretending otherwise would ship unchecked anagrams.
		push("game", "La validación de las palabras desordenadas llega en la siguiente fase.");
	}
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
