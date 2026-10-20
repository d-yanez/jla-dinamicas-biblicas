import assert from "node:assert/strict";
import { test } from "node:test";

// Every module must import cleanly in a plain Node process. That proves two things
// at once: the ES module graph has no broken paths, and no module touches the DOM
// at import time (which would break tests and any non-browser tooling).

const MODULES = [
	["../src/app.js", ["bootstrap", "render"]],
	["../src/core/activities.js", ["fetchPublishedActivity", "countPublishedActivities"]],
	["../src/core/admin-gate.js", ["createAdminGate", "decideAdminAccess"]],
	["../src/core/db.js", ["openDatabase", "readSetting", "writeSetting", "getAll", "applyMigrations", "plannedStoreNames"]],
	["../src/core/pin.js", ["createPinRecord", "verifyPin", "normalizePin", "isPinRecord"]],
	["../src/core/prefs.js", ["normalizePrefs", "applyPrefsToDocument"]],
	[
		"../src/core/recovery.js",
		["buildRecoveryFile", "parseRecoveryFile", "matchesRecoveryIdentity", "createRecoveryKey", "createInstallationId", "recoveryFileName"],
	],
	["../src/core/router.js", ["parseRoute", "toHash", "isAdminRoute", "shouldLockOnNavigation"]],
	["../src/ui/admin.js", ["renderAdmin"]],
	["../src/ui/common.js", ["renderHeader", "renderFooter", "renderGear", "renderEmptyState", "renderError", "createDialog", "confirmDialog"]],
	["../src/ui/dom.js", ["el", "clear", "append", "uniqueId"]],
	["../src/ui/download.js", ["downloadJson", "readFileText"]],
	["../src/ui/fields.js", ["pinField", "errorLine", "showError", "hideError"]],
	["../src/ui/game.js", ["renderGame"]],
	["../src/ui/gate.js", ["renderPinSetup", "renderPinUnlock"]],
	["../src/ui/home.js", ["renderHome"]],
	["../src/ui/icons.js", ["renderIcon"]],
	["../src/ui/security.js", ["renderSecurityGroup", "openChangePinDialog", "startRecoveryImport", "openRecoveryDownloadDialog"]],
];

test("todos los módulos se importan sin tocar el DOM", async () => {
	assert.equal(typeof globalThis.document, "undefined", "las pruebas corren fuera del navegador");
	for (const [path, expected] of MODULES) {
		const loaded = await import(path);
		for (const name of expected) {
			assert.equal(typeof loaded[name], "function", `${path} debe exportar ${name}`);
		}
	}
});

test("el router y la portada exponen las etiquetas que la interfaz usa", async () => {
	const router = await import("../src/core/router.js");
	assert.deepEqual(router.GAMES, ["sopa", "palabras"]);
	assert.equal(router.GAME_LABELS.sopa, "Sopa de letras");
	assert.equal(router.SECTION_LABELS.config, "Configuración general");
});
