// Draft session: the machinery every activity editor shares.
//
// Autosave, the save indicator, the activity list, opening, creating, duplicating and
// clearing a stale requirement result live here once, so the sopa and the palabras
// editors cannot drift apart — least of all in the part that writes data.

import { ACTIVITY_STATUS, validateActivity } from "../core/activity-model.js";
import { ensureEditableDraft, getActivity, listActivities, publishActivity, saveActivity, unpublishActivity } from "../core/activities.js";
import { createActivity } from "../core/activity-model.js";

const SAVE_DELAY_MS = 800;

// Selection survives route re-renders within the session, per game.
const selection = new Map();

/**
 * Events a view can subscribe to:
 *   "save-state"  the indicator text changed
 *   "saved"       a draft was persisted; { approvalWithdrawn } says the grid stopped being approved
 *   "notice"      state.notice changed
 *   "title"       the activity name changed
 *   "requirements" a requirement check finished (or was cleared)
 */
export function createDraftSession({ db, type }) {
	const listeners = new Set();
	const state = {
		activities: [],
		draft: undefined,
		loading: true,
		saveState: "idle",
		lastSavedAt: "",
		notice: "",
		requirements: undefined,
	};
	let saveTimer;

	const emit = (event, payload) => {
		for (const listener of listeners) listener(event, payload);
	};

	const session = {
		type,
		state,
		get selectedId() {
			return selection.get(type) ?? "";
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		dispose() {
			window.clearTimeout(saveTimer);
			listeners.clear();
		},
		setNotice(message) {
			state.notice = message;
			emit("notice");
		},
		setRequirements(result) {
			state.requirements = result;
			emit("requirements");
		},
		markDirty() {
			state.saveState = "dirty";
			emit("save-state");
			// A previous requirement check stops being true the moment content changes; a
			// stale "cumple todos los requisitos" would be worse than none.
			if (state.requirements) {
				state.requirements = undefined;
				emit("requirements");
			}
			window.clearTimeout(saveTimer);
			saveTimer = window.setTimeout(() => {
				void session.flush();
			}, SAVE_DELAY_MS);
		},
		async flush() {
			window.clearTimeout(saveTimer);
			if (!state.draft) return;
			state.saveState = "saving";
			emit("save-state");
			const approvedBefore = state.draft.game?.approvedVariantId ?? "";
			const saved = await saveActivity(db, state.draft);
			// The grid is kept when a word changes; what the moderator must know is that the
			// approval was withdrawn because it no longer covers the words.
			const approvalWithdrawn = approvedBefore.length > 0 && (saved.game.approvedVariantId ?? "") === "";
			state.draft = saved;
			state.saveState = "saved";
			state.lastSavedAt = saved.updatedAt;
			await session.refreshList();
			emit("title");
			emit("save-state");
			emit("saved", { approvalWithdrawn });
		},
		async refreshList() {
			state.activities = await listActivities(db, { type });
			if (session.selectedId && !state.activities.some((activity) => activity.id === session.selectedId)) {
				selection.delete(type);
				state.draft = undefined;
			}
		},
		/** Restores the selected activity after a re-mount, without losing the selection. */
		async restore() {
			await session.refreshList();
			if (!session.selectedId) return;
			const activity = await getActivity(db, session.selectedId);
			if (!activity) {
				selection.delete(type);
				return;
			}
			state.draft = activity;
			state.requirements = undefined;
			state.notice = "";
			state.saveState = "saved";
			state.lastSavedAt = activity.updatedAt;
		},
		async open(id) {
			const requested = await getActivity(db, id);
			// Editing a published activity never touches it: a derived draft is opened instead.
			const activity = requested?.status === ACTIVITY_STATUS.PUBLISHED ? await ensureEditableDraft(db, id) : requested;
			if (!activity) {
				await session.refreshList();
				emit("open");
				return;
			}
			selection.set(type, activity.id);
			if (activity.id !== id) {
				state.draft = activity;
				state.requirements = undefined;
				state.saveState = "saved";
				state.lastSavedAt = activity.updatedAt;
				await session.refreshList();
				state.notice = "Estás editando un borrador: la actividad publicada no cambia hasta que publiques estos cambios.";
				emit("open");
				return;
			}
			state.draft = activity;
			state.requirements = undefined;
			state.notice = "";
			state.saveState = "saved";
			state.lastSavedAt = activity.updatedAt;
			emit("open");
		},
		async createNew() {
			const draft = await saveActivity(db, createActivity({ type, name: "" }));
			state.draft = draft;
			selection.set(type, draft.id);
			state.requirements = undefined;
			state.notice = "";
			state.saveState = "saved";
			state.lastSavedAt = draft.updatedAt;
			await session.refreshList();
			emit("open");
		},
		async duplicate(activity) {
			const { duplicateAsDraft } = await import("../core/activity-model.js");
			const copy = await saveActivity(db, duplicateAsDraft(activity));
			await session.refreshList();
			await session.open(copy.id);
		},
		async backToList() {
			await session.flush();
			selection.delete(type);
			state.draft = undefined;
			state.requirements = undefined;
			state.notice = "";
			await session.refreshList();
			emit("open");
		},
		async publish() {
			if (!state.draft) return { ok: false };
			await session.flush();
			const result = await publishActivity(db, state.draft.id);
			if (!result.ok) {
				state.requirements = result;
				emit("requirements");
				return result;
			}
			state.draft = result.activity;
			await session.refreshList();
			// Go back to the list: the published row is never edited in place, and the list is
			// where the moderator sees what is public.
			state.draft = undefined;
			selection.delete(type);
			emit("open");
			return result;
		},
		async unpublish() {
			if (!state.draft) return undefined;
			await session.flush();
			const unpublished = await unpublishActivity(db, state.draft.id);
			state.draft = unpublished;
			await session.refreshList();
			emit("open");
			return unpublished;
		},
		async verifyRequirements() {
			if (!state.draft) return;
			await session.refreshList();
			const published = state.activities.filter((activity) => activity.status === ACTIVITY_STATUS.PUBLISHED);
			const result = validateActivity(state.draft, { publishedOfType: published });
			state.requirements = result;
			emit("requirements");
		},
	};
	return session;
}

