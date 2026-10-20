// Activity queries.
//
// Phase 1 ships no activities yet, but the home screen already has to answer
// "is there a published activity to play?" instead of pretending. It queries the
// real store, so phase 2 only has to write rows.

import { getAll } from "./db.js";

export const ACTIVITY_STATUS = Object.freeze({ DRAFT: "draft", PUBLISHED: "published" });

/** The single published activity for a game, or undefined when there is none. */
export async function fetchPublishedActivity(db, game) {
	const rows = await getAll(db, "activities");
	return rows.find(
		(row) => row && row.type === game && row.status === ACTIVITY_STATUS.PUBLISHED && !row.deletedAt,
	);
}

export async function countPublishedActivities(db) {
	const rows = await getAll(db, "activities");
	return rows.filter((row) => row && row.status === ACTIVITY_STATUS.PUBLISHED && !row.deletedAt).length;
}
