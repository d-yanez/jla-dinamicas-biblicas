// Backup file: the only way to move work between devices, because everything else lives
// in one browser's IndexedDB.
//
// Pure on purpose: building, parsing and merging are testable without storage. The PIN
// and its recovery file are never part of a backup — they belong to the device, not to
// the work.

import { normalizeActivity } from "./activity-model.js";
import { createId } from "./ids.js";
import { normalizePrefs } from "./prefs.js";

export const BACKUP_KIND = "jla.backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const IMPORTED_SUFFIX = " (importado)";

const EMPTY = "El archivo está vacío.";
const INVALID_JSON = "El archivo no es JSON válido.";
const WRONG_KIND = "El archivo no es un respaldo de JLA.";
const NO_ACTIVITIES = "El respaldo no tiene actividades.";
const TOO_BIG = "El archivo es demasiado grande para ser un respaldo de JLA.";

/** The file to download: activities plus the non-sensitive settings. */
export function buildBackup({ activities = [], prefs, exportedAt = new Date().toISOString() } = {}) {
	return {
		kind: BACKUP_KIND,
		version: BACKUP_VERSION,
		app: "JLA Dinámicas Bíblicas",
		exportedAt,
		settings: normalizePrefs(prefs),
		activities: activities.map((activity) => ({ ...activity })),
	};
}

export function parseBackup(text) {
	if (typeof text !== "string" || text.trim().length === 0) return { ok: false, error: EMPTY };
	if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: TOO_BIG };
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		return { ok: false, error: INVALID_JSON };
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, error: WRONG_KIND };
	if (value.kind !== BACKUP_KIND || value.version !== BACKUP_VERSION) return { ok: false, error: WRONG_KIND };
	if (!Array.isArray(value.activities)) return { ok: false, error: NO_ACTIVITIES };
	return { ok: true, backup: value };
}

/**
 * What to insert for an imported backup.
 *
 * Every imported activity becomes a **draft with a new id**: importing must never
 * overwrite the work already on this device, must never change the published activity
 * automatically, and must not collide with an id already in use. A repeated name is
 * renamed instead of duplicated silently.
 */
export function mergeBackup({ existing = [], incoming = [], makeId = createId, now = () => new Date().toISOString() } = {}) {
	const usedNames = new Set(
		existing.map((activity) => String(activity?.name ?? "").trim().toLowerCase()).filter((name) => name.length > 0),
	);
	const toInsert = [];
	const summary = { added: 0, renamed: 0, skipped: 0 };
	for (const raw of incoming) {
		const normalized = normalizeActivity(raw);
		if (!normalized) {
			summary.skipped += 1;
			continue;
		}
		let name = normalized.name.trim().length > 0 ? normalized.name.trim() : "Actividad importada";
		if (usedNames.has(name.toLowerCase())) {
			name = `${name}${IMPORTED_SUFFIX}`;
			summary.renamed += 1;
		}
		usedNames.add(name.toLowerCase());
		const stamp = now();
		toInsert.push({
			...normalized,
			id: makeId(),
			name,
			status: "draft",
			originId: "",
			exampleKey: "",
			publishedAt: "",
			testedAt: "",
			testedSignature: "",
			createdAt: stamp,
			updatedAt: stamp,
		});
		summary.added += 1;
	}
	return { toInsert, summary };
}

/**
 * What the import dialog shows before anything is written: the export date and every
 * activity with its type and status, so the moderator can see that the file carries the
 * work they configured and not something else.
 */
export function previewBackup(text) {
	const parsed = parseBackup(text);
	if (!parsed.ok) return parsed;
	const items = parsed.backup.activities.map((raw) => {
		const normalized = normalizeActivity(raw);
		return normalized
			? { name: normalized.name.trim().length > 0 ? normalized.name : "Actividad sin nombre", type: normalized.type, status: normalized.status, valid: true }
			: { name: typeof raw?.name === "string" && raw.name.length > 0 ? raw.name : "Entrada inválida", type: typeof raw?.type === "string" ? raw.type : "?", status: "?", valid: false };
	});
	const invalid = items.filter((item) => !item.valid).length;
	return { ok: true, exportedAt: typeof parsed.backup.exportedAt === "string" ? parsed.backup.exportedAt : "", items, valid: items.length - invalid, invalid };
}
