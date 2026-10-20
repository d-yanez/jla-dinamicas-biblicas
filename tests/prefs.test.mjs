import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_PREFS, DISPLAY_SIZES, normalizePrefs } from "../src/core/prefs.js";

test("las preferencias por defecto son Grande sin alto contraste", () => {
	assert.deepEqual(DEFAULT_PREFS, { displaySize: "grande", highContrast: false });
	assert.deepEqual(DISPLAY_SIZES, ["normal", "grande"]);
	assert.equal(Object.isFrozen(DEFAULT_PREFS), true);
	assert.deepEqual(normalizePrefs(undefined), DEFAULT_PREFS);
});

test("normalizePrefs siempre devuelve preferencias válidas y no lanza", () => {
	const cases = [
		null,
		42,
		"grande",
		[],
		{ displaySize: "enorme" },
		{ displaySize: "normal" },
		{ highContrast: true },
		{ displaySize: "normal", highContrast: true },
		{ displaySize: "GRANDE", highContrast: "sí" },
	];
	assert.deepEqual(normalizePrefs(cases[0]), DEFAULT_PREFS);
	assert.deepEqual(normalizePrefs(cases[1]), DEFAULT_PREFS);
	assert.deepEqual(normalizePrefs(cases[2]), DEFAULT_PREFS);
	assert.deepEqual(normalizePrefs(cases[3]), DEFAULT_PREFS);
	assert.deepEqual(normalizePrefs(cases[4]), DEFAULT_PREFS);
	assert.deepEqual(normalizePrefs(cases[5]), { displaySize: "normal", highContrast: false });
	assert.deepEqual(normalizePrefs(cases[6]), { displaySize: "grande", highContrast: true });
	assert.deepEqual(normalizePrefs(cases[7]), { displaySize: "normal", highContrast: true });
	assert.deepEqual(normalizePrefs(cases[8]), DEFAULT_PREFS, "valores en mayúscula o de tipo incorrecto se descartan");
});

test("normalizePrefs no conserva claves desconocidas", () => {
	assert.deepEqual(normalizePrefs({ displaySize: "normal", highContrast: true, extra: 1 }), {
		displaySize: "normal",
		highContrast: true,
	});
});
