// Activity repository: the only place that reads or writes activities in IndexedDB.
//
// Rows are stored normalized, so a corrupted or older row can never reach the editor
// with a shape the rest of the app does not expect.

import { generateAnagram, normalizeSolution, TIEBREAKER_COUNT } from "./anagram.js";
import {
	ACTIVITY_STATUS,
	ACTIVITY_TYPE,
	createActivity,
	normalizeActivity,
	refreshDerivedState,
	validateActivity,
} from "./activity-model.js";
import { buildBackup, mergeBackup, parseBackup } from "./backup.js";
import { getAll, getRow, putRow, readSetting, removeRow, writeSetting } from "./db.js";
import { createId } from "./ids.js";
import { defaultInstructionsFor } from "./instructions.js";
import { generateVariant } from "./sopa.js";

const SETTINGS_STORE = "settings";
const ACTIVITIES_STORE = "activities";
const EXAMPLES_KEY = "examplesSeededAt";
const SEEDED_KEYS_KEY = "examplesSeeded";

/** Stable keys of the examples the app ships with, in seeding order. */
export const EXAMPLE_KEYS = Object.freeze(["sopa-ayuno-oracion", "palabras-ayuno-oracion"]);

/** All stored activities, newest first. */
export async function listActivities(db, { type } = {}) {
	const rows = await getAll(db, ACTIVITIES_STORE);
	const activities = rows.map(normalizeActivity).filter(Boolean);
	const filtered = type === undefined ? activities : activities.filter((activity) => activity.type === type);
	return filtered.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
}

export async function getActivity(db, id) {
	const row = await getRow(db, ACTIVITIES_STORE, id);
	return row === undefined ? undefined : normalizeActivity(row);
}

/** The single published activity for a game, or undefined when there is none. */
export async function fetchPublishedActivity(db, game) {
	const activities = await listActivities(db, { type: game });
	return activities.find((activity) => activity.status === ACTIVITY_STATUS.PUBLISHED);
}

export async function countPublishedActivities(db, game) {
	const activities = await listActivities(db, game === undefined ? {} : { type: game });
	return activities.filter((activity) => activity.status === ACTIVITY_STATUS.PUBLISHED).length;
}

/**
 * Persists an activity: derived state is recomputed first (word normalization, stale
 * variants dropped, «probado» invalidated) and the result is what a reload will read.
 */
export async function saveActivity(db, activity) {
	const now = new Date().toISOString();
	const prepared = refreshDerivedState({ ...activity, updatedAt: now });
	const clean = normalizeActivity(prepared);
	if (!clean) throw new Error("La actividad no se puede guardar: sus datos no son válidos.");
	await putRow(db, ACTIVITIES_STORE, clean);
	return clean;
}

/**
 * The draft that edits a published activity. The published row is never edited directly:
 * a derived draft is created the first time, and publishing it replaces the published one.
 */
export async function ensureEditableDraft(db, id) {
	const activity = await getActivity(db, id);
	if (!activity) throw new Error("La actividad no existe.");
	if (activity.status !== ACTIVITY_STATUS.PUBLISHED) return activity;
	const sameGame = await listActivities(db, { type: activity.type });
	const existing = sameGame.find((candidate) => candidate.originId === activity.id);
	if (existing) return existing;
	const now = new Date().toISOString();
	const draft = normalizeActivity({
		...activity,
		id: createId(),
		originId: activity.id,
		status: ACTIVITY_STATUS.DRAFT,
		publishedAt: "",
		testedAt: "",
		testedSignature: "",
		createdAt: now,
		updatedAt: now,
	});
	await putRow(db, ACTIVITIES_STORE, draft);
	return draft;
}

/**
 * Publishes one activity: it must pass the strict validation, and publishing it
 * unpublishes the other published activity of the same game (one per game maximum).
 * Publishing a derived draft replaces the published content and keeps its identity.
 */
export async function publishActivity(db, id) {
	const activity = await getActivity(db, id);
	if (!activity) throw new Error("La actividad no existe.");
	const sameGame = await listActivities(db, { type: activity.type });
	// The activity this draft replaces is not "another published one": it is the target.
	const validation = validateActivity(activity, {
		publishedOfType: sameGame.filter((candidate) => candidate.id !== id && candidate.id !== activity.originId),
	});
	if (!validation.ok) return { ok: false, errors: validation.errors };
	const now = new Date().toISOString();
	const origin = activity.originId ? sameGame.find((candidate) => candidate.id === activity.originId) : undefined;
	for (const other of sameGame) {
		if (other.id !== id && other.id !== activity.originId && other.status === ACTIVITY_STATUS.PUBLISHED) {
			await putRow(db, ACTIVITIES_STORE, { ...other, status: ACTIVITY_STATUS.DRAFT, publishedAt: "", updatedAt: now });
		}
	}
	if (origin) {
		const replaced = {
			...activity,
			id: origin.id,
			originId: "",
			createdAt: origin.createdAt,
			status: ACTIVITY_STATUS.PUBLISHED,
			publishedAt: now,
			updatedAt: now,
		};
		await putRow(db, ACTIVITIES_STORE, replaced);
		await removeRow(db, ACTIVITIES_STORE, activity.id);
		return { ok: true, activity: replaced, replaced: origin.id };
	}
	const published = { ...activity, originId: "", status: ACTIVITY_STATUS.PUBLISHED, publishedAt: now, updatedAt: now };
	await putRow(db, ACTIVITIES_STORE, published);
	return { ok: true, activity: published };
}

/** Unpublishing keeps the content: it only stops being the game the public plays. */
export async function unpublishActivity(db, id) {
	const activity = await getActivity(db, id);
	if (!activity) throw new Error("La actividad no existe.");
	const unpublished = { ...activity, status: ACTIVITY_STATUS.DRAFT, publishedAt: "", updatedAt: new Date().toISOString() };
	await putRow(db, ACTIVITIES_STORE, unpublished);
	return unpublished;
}

// -------------------------------------------------------------------- backup

/** Everything needed to move the work to another device. The PIN is never included. */
export async function exportBackup(db, prefs) {
	const activities = await listActivities(db);
	return buildBackup({ activities, prefs });
}

/**
 * Merges a backup file: every imported activity lands as a fresh draft, nothing on this
 * device is overwritten and the published activity is never changed.
 */
export async function importBackup(db, text) {
	const parsed = parseBackup(text);
	if (!parsed.ok) return { ok: false, error: parsed.error };
	const existing = await listActivities(db);
	const { toInsert, summary } = mergeBackup({ existing, incoming: parsed.backup.activities, makeId: createId });
	for (const activity of toInsert) await putRow(db, ACTIVITIES_STORE, activity);
	return { ok: true, summary, settings: parsed.backup.settings, exportedAt: parsed.backup.exportedAt };
}

// ------------------------------------------------------------------- examples

const SOPA_WORDS = ["Ayuno", "Oración", "Fe", "Entrega", "Silencio", "Perdón", "Gratitud", "Humildad", "Comunión", "Perseverancia"];

const PALABRAS_WORDS = [
	{ solution: "Oración", hints: [] },
	{ solution: "Ayuno", hints: ["Se hace dejando de comer por un tiempo, para buscar a Dios."] },
	{ solution: "Silencio", hints: ["Se busca en la quietud, sin ruido.", "Ayuda a escuchar antes de hablar."] },
	{ solution: "Entrega", hints: [] },
	{ solution: "Perdón", hints: [] },
	{ solution: "Gratitud", hints: [] },
	{ solution: "Humildad", hints: [] },
	{ solution: "Comunión", hints: [] },
	{ solution: "Esperanza", hints: [] },
	{ solution: "Fe", hints: [] },
];

const PALABRAS_TIEBREAKERS = ["Misericordia", "Perseverancia", "Bendición"];

function buildSopaExample() {
	const activity = createActivity({ type: ACTIVITY_TYPE.SOPA, name: "Sopa de letras: Ayuno y oración" });
	activity.exampleKey = EXAMPLE_KEYS[0];
	activity.theme = "Ayuno y oración";
	// References only: a quotation would have to be checked literally against RVR1960,
	// and it is better to point to the passage than to paraphrase it as if it were quoted.
	activity.reference = "Mateo 6:16-18";
	activity.teaching = "El ayuno y la oración nos ayudan a buscar a Dios con atención y humildad, sin buscar la mirada de los demás.";
	activity.instructions = defaultInstructionsFor(ACTIVITY_TYPE.SOPA);
	activity.reflection = "Jesús invita a ayunar y orar con sencillez, delante de Dios y no delante de la gente.";
	activity.reflectionReference = "Mateo 6:16-18";
	activity.roundSeconds = 30;
	activity.game.words = SOPA_WORDS.map((text) => ({ id: createId(), text }));
	// A fixed seed keeps the example reproducible, and the grid is stored as data: the
	// example never changes behind the moderator's back.
	const generated = generateVariant({ words: activity.game.words, seed: "jla-ejemplo-sopa-ayuno-y-oracion" });
	if (generated.ok) {
		activity.game.variants = [generated.variant];
		activity.game.approvedVariantId = generated.variant.id;
	}
	const ready = refreshDerivedState(activity);
	ready.updatedAt = new Date().toISOString();
	return ready;
}

function buildPalabrasExample() {
	const activity = createActivity({ type: ACTIVITY_TYPE.PALABRAS, name: "Palabras desordenadas: Ayuno y oración" });
	activity.exampleKey = EXAMPLE_KEYS[1];
	activity.theme = "Ayuno y oración";
	activity.reference = "Mateo 6:16-18";
	activity.teaching = "El ayuno y la oración nos ayudan a buscar a Dios con atención y humildad, sin buscar la mirada de los demás.";
	activity.instructions = defaultInstructionsFor(ACTIVITY_TYPE.PALABRAS);
	activity.reflection = "Jesús invita a ayunar y orar con sencillez, delante de Dios y no delante de la gente.";
	activity.reflectionReference = "Mateo 6:16-18";
	activity.roundSeconds = 30;
	// Fixed seeds: the scrambles are stable, so the example is the same tomorrow and
	// can be checked against the stored anagram without regenerating it.
	activity.game.words = PALABRAS_WORDS.map(({ solution, hints }) => {
		const normalized = normalizeSolution(solution);
		const generated = generateAnagram({ solution, seed: `jla-ejemplo-palabras-${normalized}` });
		return { id: createId(), solution, normalized, anagram: generated.ok ? generated.anagram : "", hints: [...hints] };
	});
	activity.game.tiebreakers = PALABRAS_TIEBREAKERS.slice(0, TIEBREAKER_COUNT).map((solution) => {
		const normalized = normalizeSolution(solution);
		const generated = generateAnagram({ solution, seed: `jla-ejemplo-desempate-${normalized}` });
		return { id: createId(), solution, normalized, anagram: generated.ok ? generated.anagram : "" };
	});
	const ready = refreshDerivedState(activity);
	ready.updatedAt = new Date().toISOString();
	return ready;
}

/** The two editable examples the app ships with. Pure: no storage, no clock beyond timestamps. */
export function buildExampleActivities() {
	return [buildSopaExample(), buildPalabrasExample()];
}

/**
 * Examples still missing from a database. Seeding is tracked per example key, not with a
 * single global flag: a browser that stored the phase-2 marker (when the sopa was the
 * only example) must still receive the examples added in later phases.
 */
export function pendingExamples({ activities = [], seededKeys = [] } = {}) {
	const seeded = new Set((seededKeys ?? []).filter((key) => typeof key === "string"));
	const present = new Set(
		(activities ?? []).map((activity) => activity?.exampleKey).filter((key) => typeof key === "string" && key.length > 0),
	);
	return buildExampleActivities().filter((example) => !seeded.has(example.exampleKey) && !present.has(example.exampleKey));
}

/**
 * Seeds the editable examples that are still missing. They are drafts, never published,
 * and the per-example key keeps them from coming back if the moderator removes one.
 */
export async function ensureExampleActivities(db) {
	const [storedKeys, legacyFlag] = await Promise.all([readSetting(db, SEEDED_KEYS_KEY), readSetting(db, EXAMPLES_KEY)]);
	const seededKeys = new Set(Array.isArray(storedKeys) ? storedKeys.filter((key) => typeof key === "string") : []);
	// Migration from the single global flag used before this fix: it only ever seeded
	// the sopa example.
	if (!Array.isArray(storedKeys) && typeof legacyFlag === "string" && legacyFlag.length > 0) {
		seededKeys.add(EXAMPLE_KEYS[0]);
	}
	const activities = await listActivities(db);
	const pending = pendingExamples({ activities, seededKeys: [...seededKeys] });
	for (const example of pending) {
		await putRow(db, ACTIVITIES_STORE, example);
		seededKeys.add(example.exampleKey);
	}
	if (pending.length > 0) await writeSetting(db, EXAMPLES_KEY, new Date().toISOString());
	if (pending.length > 0 || !Array.isArray(storedKeys)) await writeSetting(db, SEEDED_KEYS_KEY, [...seededKeys]);
	return pending;
}

export { SETTINGS_STORE };
