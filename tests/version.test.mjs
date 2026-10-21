import assert from "node:assert/strict";
import { test } from "node:test";

import { buildBackup, previewBackup } from "../src/core/backup.js";
import { DEFAULT_PREFS } from "../src/core/prefs.js";
import { compareVersions, formatVersion, isNewerVersion, parseVersion } from "../src/core/version.js";

test("parseVersion acepta solo versiones semánticas", () => {
	assert.deepEqual(parseVersion("0.6.0"), { major: 0, minor: 6, patch: 0 });
	assert.deepEqual(parseVersion(" 12.3.4 "), { major: 12, minor: 3, patch: 4 });
	for (const bad of ["", "0.6", "v0.6.0", "0.6.0-beta", "a.b.c", null, undefined, 3]) {
		assert.equal(parseVersion(bad), undefined, String(bad));
	}
});

test("compareVersions ordena y tolera lo ilegible", () => {
	assert.ok(compareVersions("0.6.0", "0.6.1") < 0);
	assert.ok(compareVersions("0.6.1", "0.6.0") > 0);
	assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
	assert.ok(compareVersions("1.0.0", "0.9.9") > 0);
	assert.equal(compareVersions("no-version", "1.0.0"), 0, "un valor ilegible nunca bloquea");
});

test("isNewerVersion responde solo por versiones válidas", () => {
	assert.equal(isNewerVersion("0.7.0", "0.6.0"), true);
	assert.equal(isNewerVersion("0.6.0", "0.6.0"), false);
	assert.equal(isNewerVersion("basura", "0.6.0"), false);
});

test("formatVersion muestra la v y calla si no hay nada", () => {
	assert.equal(formatVersion("0.6.0"), "v0.6.0");
	assert.equal(formatVersion(""), "");
	assert.equal(formatVersion(undefined), "");
});

test("el respaldo guarda la versión y la vista previa la informa", () => {
	const backup = buildBackup({ activities: [], prefs: DEFAULT_PREFS, appVersion: "0.6.0", exportedAt: "2026-10-21T00:00:00.000Z" });
	assert.equal(backup.appVersion, "0.6.0");
	const preview = previewBackup(JSON.stringify(backup));
	assert.equal(preview.ok, true);
	assert.equal(preview.appVersion, "0.6.0");
	assert.equal(previewBackup(JSON.stringify(buildBackup({ activities: [], prefs: DEFAULT_PREFS }))).appVersion, "");
});
