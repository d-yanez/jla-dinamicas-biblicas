// Activity repository: the only place that reads or writes activities in IndexedDB.
//
// Rows are stored normalized, so a corrupted or older row can never reach the editor
// with a shape the rest of the app does not expect.

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

const EXAMPLE_WORDS = ["Ayuno", "Oración", "Fe", "Entrega", "Silencio", "Perdón", "Gratitud", "Humildad", "Comunión", "Perseverancia"];

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
	activity.game.words = EXAMPLE_WORDS.map((text) => ({ id: createId(), text }));
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

/**
 * Seeds the editable examples on first start. The example is a draft, never published;
 * the settings flag keeps it from coming back if the moderator deletes it on purpose.
 */
export async function ensureExampleActivities(db) {
	const seededAt = await readSetting(db, EXAMPLES_KEY);
	if (typeof seededAt === "string" && seededAt.length > 0) return [];
	const existing = await listActivities(db);
	if (existing.length > 0) {
		await writeSetting(db, EXAMPLES_KEY, new Date().toISOString());
		return [];
	}
	const example = buildSopaExample();
	await putRow(db, ACTIVITIES_STORE, example);
	await writeSetting(db, EXAMPLES_KEY, new Date().toISOString());
	return [example];
}

export { SETTINGS_STORE };
