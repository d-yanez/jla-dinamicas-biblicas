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
} from "./activity-model.js";
import { getAll, getRow, putRow, readSetting, writeSetting } from "./db.js";
import { createId } from "./ids.js";
import { defaultInstructionsFor } from "./instructions.js";
import { generateVariant } from "./sopa.js";

const SETTINGS_STORE = "settings";
const ACTIVITIES_STORE = "activities";
const EXAMPLES_KEY = "examplesSeededAt";

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
 * Seeds the editable examples on first start. Both are drafts, never published; the
 * settings flag keeps them from coming back if the moderator deletes them on purpose.
 */
export async function ensureExampleActivities(db) {
	const seededAt = await readSetting(db, EXAMPLES_KEY);
	if (typeof seededAt === "string" && seededAt.length > 0) return [];
	const existing = await listActivities(db);
	if (existing.length > 0) {
		await writeSetting(db, EXAMPLES_KEY, new Date().toISOString());
		return [];
	}
	const examples = buildExampleActivities();
	for (const example of examples) await putRow(db, ACTIVITIES_STORE, example);
	await writeSetting(db, EXAMPLES_KEY, new Date().toISOString());
	return examples;
}

export { SETTINGS_STORE };
