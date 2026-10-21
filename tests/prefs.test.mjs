import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_PREFS, DISPLAY_SIZES, normalizePrefs } from "../src/core/prefs.js";

test("las preferencias por defecto son Grande sin alto contraste", () => {
	assert.deepEqual(DEFAULT_PREFS, {
		displaySize: "grande",
		highContrast: false,
		soundVolume: 0.3,
		muted: false,
		soundTension: true,
		soundTicks: true,
		soundBell: true,
	});
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
	assert.deepEqual(normalizePrefs(cases[5]), { ...DEFAULT_PREFS, displaySize: "normal" });
	assert.deepEqual(normalizePrefs(cases[6]), { ...DEFAULT_PREFS, highContrast: true });
	assert.deepEqual(normalizePrefs(cases[7]), { ...DEFAULT_PREFS, displaySize: "normal", highContrast: true });
	assert.deepEqual(normalizePrefs(cases[8]), DEFAULT_PREFS, "valores en mayúscula o de tipo incorrecto se descartan");
});

test("normalizePrefs no conserva claves desconocidas", () => {
	assert.deepEqual(normalizePrefs({ displaySize: "normal", highContrast: true, extra: 1 }), {
		...DEFAULT_PREFS,
		displaySize: "normal",
		highContrast: true,
	});
});

test("el volumen de sonido se guarda entre 0 y 1", () => {
	assert.equal(normalizePrefs({ soundVolume: 0.55 }).soundVolume, 0.55);
	assert.equal(normalizePrefs({ soundVolume: 5 }).soundVolume, 0.3);
	assert.equal(normalizePrefs({ soundVolume: -1 }).soundVolume, 0.3);
	assert.equal(normalizePrefs({ soundVolume: "alto" }).soundVolume, 0.3);
	assert.equal(normalizePrefs({ muted: true }).muted, true);
	assert.equal(normalizePrefs({ muted: "si" }).muted, false);
});

test("cada etapa de sonido se puede apagar por separado", () => {
	assert.deepEqual(normalizePrefs({ soundTension: false }).soundTension, false);
	assert.deepEqual(normalizePrefs({ soundTicks: false }).soundTicks, false);
	assert.deepEqual(normalizePrefs({ soundBell: false }).soundBell, false);
	assert.equal(normalizePrefs({ soundTicks: "no" }).soundTicks, true, "valores no booleanos vuelven al defecto");
	assert.equal(normalizePrefs({}).soundTension, true);
});
