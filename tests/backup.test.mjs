import assert from "node:assert/strict";
import { test } from "node:test";

import { buildExampleActivities } from "../src/core/activities.js";
import { normalizeActivity, validateActivity } from "../src/core/activity-model.js";
import { BACKUP_KIND, BACKUP_VERSION, MAX_BACKUP_BYTES, buildBackup, mergeBackup, parseBackup, previewBackup } from "../src/core/backup.js";
import { DEFAULT_PREFS } from "../src/core/prefs.js";

const EXAMPLES = buildExampleActivities();

test("el respaldo lleva actividades y configuraciones, jamás el PIN", () => {
	const backup = buildBackup({ activities: EXAMPLES, prefs: { ...DEFAULT_PREFS, displaySize: "normal" }, exportedAt: "2026-10-21T10:00:00.000Z" });
	assert.equal(backup.kind, BACKUP_KIND);
	assert.equal(backup.version, BACKUP_VERSION);
	assert.equal(backup.exportedAt, "2026-10-21T10:00:00.000Z");
	assert.equal(backup.settings.displaySize, "normal");
	assert.equal(backup.activities.length, 2);
	const serialized = JSON.stringify(backup);
	assert.equal(serialized.includes("pin"), false, "el respaldo no debe contener el PIN");
	assert.equal(serialized.includes("recoveryKey"), false, "ni la clave de recuperación");
});

test("parseBackup rechaza archivos que no son respaldos, con mensaje propio", () => {
	const cases = [
		["", "El archivo está vacío."],
		["no es json", "El archivo no es JSON válido."],
		["[]", "El archivo no es un respaldo de JLA."],
		[JSON.stringify({ kind: "otra-cosa", version: 1 }), "El archivo no es un respaldo de JLA."],
		[JSON.stringify({ kind: BACKUP_KIND, version: 99 }), "El archivo no es un respaldo de JLA."],
		[JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION }), "El respaldo no tiene actividades."],
		["x".repeat(MAX_BACKUP_BYTES + 1), "El archivo es demasiado grande para ser un respaldo de JLA."],
	];
	for (const [text, error] of cases) {
		const parsed = parseBackup(text);
		assert.equal(parsed.ok, false, text.slice(0, 30));
		assert.equal(parsed.error, error);
	}
});

test("el respaldo hace roundtrip y sus actividades siguen siendo válidas", () => {
	const text = JSON.stringify(buildBackup({ activities: EXAMPLES, prefs: DEFAULT_PREFS }));
	const parsed = parseBackup(text);
	assert.equal(parsed.ok, true);
	const { toInsert } = mergeBackup({ existing: [], incoming: parsed.backup.activities });
	assert.equal(toInsert.length, 2);
	for (const activity of toInsert) {
		assert.deepEqual(validateActivity(activity), { ok: true, errors: [] }, activity.type);
	}
});

test("importar siempre crea borradores con identificadores nuevos", () => {
	const existing = [EXAMPLES[0]];
	const { toInsert, summary } = mergeBackup({ existing, incoming: EXAMPLES });
	assert.equal(toInsert.length, 2);
	assert.equal(summary.added, 2);
	for (const activity of toInsert) {
		assert.equal(activity.status, "draft", "nunca se importa una publicada");
		assert.equal(activity.publishedAt, "");
		assert.equal(activity.originId, "");
		assert.equal(activity.exampleKey, "");
		assert.notEqual(activity.id, existing[0].id);
		assert.equal(toInsert.filter((candidate) => candidate.id === activity.id).length, 1);
	}
	const ids = new Set(toInsert.map((activity) => activity.id));
	assert.equal(ids.size, 2, "cada importado tiene su propio id");
});

test("un nombre repetido se renombra en vez de duplicarse en silencio", () => {
	const existing = [EXAMPLES[0]];
	const { toInsert, summary } = mergeBackup({ existing, incoming: [EXAMPLES[0]] });
	assert.equal(toInsert.length, 1);
	assert.equal(toInsert[0].name, `${EXAMPLES[0].name} (importado)`);
	assert.equal(summary.renamed, 1);
});

test("una actividad inválida se omite y se cuenta", () => {
	const { toInsert, summary } = mergeBackup({
		existing: [],
		incoming: [{ type: "inventado", name: "x" }, { type: "sopa", name: "válida" }, "basura"],
	});
	assert.equal(toInsert.length, 1);
	assert.equal(summary.skipped, 2);
	assert.equal(summary.added, 1);
});

test("importar no toca la actividad publicada del dispositivo", () => {
	const published = { ...EXAMPLES[0], status: "published" };
	const existing = [published];
	const { toInsert } = mergeBackup({ existing, incoming: [{ ...EXAMPLES[0], status: "published" }] });
	assert.equal(existing[0].status, "published", "la publicada local no cambia");
	assert.equal(toInsert[0].status, "draft");
});

test("lo importado conserva el contenido del juego", () => {
	const sopa = EXAMPLES.find((activity) => activity.type === "sopa");
	const { toInsert } = mergeBackup({ existing: [], incoming: [JSON.parse(JSON.stringify(sopa))] });
	const imported = toInsert[0];
	assert.equal(imported.game.words.length, 10);
	assert.equal(imported.game.variants.length, 1);
	assert.ok(imported.game.approvedVariantId.length > 0);
	assert.equal(normalizeActivity(imported).game.words[0].text, sopa.game.words[0].text);
});

test("la vista previa muestra qué trae el archivo antes de importar", () => {
	const text = JSON.stringify(buildBackup({ activities: EXAMPLES, prefs: DEFAULT_PREFS, exportedAt: "2026-10-21T10:00:00.000Z" }));
	const preview = previewBackup(text);
	assert.equal(preview.ok, true);
	assert.equal(preview.exportedAt, "2026-10-21T10:00:00.000Z");
	assert.equal(preview.items.length, 2);
	assert.equal(preview.valid, 2);
	assert.equal(preview.invalid, 0);
	const names = preview.items.map((item) => item.name);
	assert.ok(names.includes("Sopa de letras: Ayuno y oración"));
	assert.ok(names.includes("Palabras desordenadas: Ayuno y oración"));
	assert.ok(preview.items.every((item) => item.status === "draft"));
});

test("la vista previa marca las entradas inválidas en vez de esconderlas", () => {
	const text = JSON.stringify({
		kind: BACKUP_KIND,
		version: BACKUP_VERSION,
		activities: [EXAMPLES[0], { type: "inventado", name: "Rota" }],
	});
	const preview = previewBackup(text);
	assert.equal(preview.ok, true);
	assert.equal(preview.items.length, 2);
	assert.equal(preview.valid, 1);
	assert.equal(preview.invalid, 1);
	assert.equal(preview.items[1].valid, false);
	assert.equal(preview.items[1].name, "Rota");
});

test("la vista previa informa el mismo error que el parseo", () => {
	assert.deepEqual(previewBackup("no es json"), { ok: false, error: "El archivo no es JSON válido." });
});
