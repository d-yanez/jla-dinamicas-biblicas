// Bundled default configuration.
//
// The moderator configures both games once, exports the backup and commits it as
// `assets/configuracion-inicial.json`. A browser with **no data** (the computer at church,
// a fresh profile) then opens the app with those activities already loaded, no pendrive.
//
// The rule that matters: it only ever applies to an empty database. It never merges into
// a device that already has work, and it never overwrites anything.

import { ACTIVITY_STATUS, normalizeActivity } from "./activity-model.js";

/** Where the optional seed lives, relative to the site root. */
export const SEED_PATH = "./assets/configuracion-inicial.json";
/** Setting written once the seed has been considered, so a deleted seed is not resurrected. */
export const SEED_MARKER_KEY = "bundledSeedAppliedAt";

/**
 * What the seed inserts into an empty database.
 *
 * The activity published in the seed stays published (one per game at most), so a fresh
 * browser can play immediately; everything else lands as a draft. Invalid entries are
 * skipped.
 */
export function planSeed({ incoming = [], activities = [], makeId } = {}) {
	if ((activities ?? []).length > 0) return { mode: "skip", toInsert: [], published: [] };
	const toInsert = [];
	const published = [];
	const publishedTypes = new Set();
	for (const raw of incoming) {
		const normalized = normalizeActivity(raw);
		if (!normalized) continue;
		const wantsPublished = normalized.status === ACTIVITY_STATUS.PUBLISHED;
		const canPublish = wantsPublished && !publishedTypes.has(normalized.type);
		if (canPublish) publishedTypes.add(normalized.type);
		toInsert.push({
			...normalized,
			id: typeof makeId === "function" ? makeId() : normalized.id,
			originId: "",
			exampleKey: "",
			status: canPublish ? ACTIVITY_STATUS.PUBLISHED : ACTIVITY_STATUS.DRAFT,
			publishedAt: canPublish ? normalized.publishedAt || new Date().toISOString() : "",
			testedAt: "",
			testedSignature: "",
		});
		if (canPublish) published.push(normalized.type);
	}
	return { mode: toInsert.length > 0 ? "seed" : "skip", toInsert, published };
}
