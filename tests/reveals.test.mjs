import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_REVEALS, computeReveals } from "../src/core/anagram.js";
import { ACTIVITY_TYPE, createActivity, refreshDerivedState } from "../src/core/activity-model.js";

const mask = (solution, level) => {
	const normalized = solution.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
	const revealed = new Set(computeReveals(solution, level));
	return [...normalized].map((letter, index) => (revealed.has(index) ? letter : "_")).join("");
};

test("los descubrimientos son como máximo dos y empiezan apagados", () => {
	assert.equal(MAX_REVEALS, 2);
	assert.equal(computeReveals("AYUNO", 0).length, 0);
	assert.equal(computeReveals("AYUNO", -1).length, 0);
	assert.equal(computeReveals(undefined, 1).length, 0);
	assert.equal(computeReveals("", 1).length, 0);
});

test("el primer descubrimiento revela las vocales en su posición", () => {
	assert.deepEqual(computeReveals("Ayuno", 1), [0, 2, 4]);
	// ORACION: O(0) R(1) A(2) C(3) I(4) O(5) N(6)
	assert.deepEqual(computeReveals("Oración", 1), [0, 2, 4, 5]);
	assert.equal(mask("Ayuno", 1), "A_U_O");
	assert.equal(mask("Oración", 1), "O_A_IO_");
});

test("el segundo descubrimiento agrega una consonante, no otra vocal", () => {
	const level1 = computeReveals("Ayuno", 1);
	const level2 = computeReveals("Ayuno", 2);
	assert.ok(level2.length > level1.length, "debe sumar una letra");
	for (const index of level1) assert.ok(level2.includes(index), "conserva lo ya revelado");
	const extra = level2.filter((index) => !level1.includes(index));
	assert.equal(extra.length, 1);
	assert.equal("AYUNO"[extra[0]], "N", "revela la última consonante");
});

test("una palabra sin vocales revela una consonante en el primer descubrimiento", () => {
	const revealed = computeReveals("RTM", 1);
	assert.equal(revealed.length, 1);
	assert.equal("RTM"[revealed[0]], "R");
});

test("una palabra sin consonantes no agrega nada en el segundo descubrimiento", () => {
	const level1 = computeReveals("AEA", 1);
	const level2 = computeReveals("AEA", 2);
	assert.deepEqual(level1, [0, 1, 2], "AEA son tres vocales");
	assert.deepEqual(level2, [0, 1, 2], "sin consonantes no hay nada más que revelar");
});

test("dos letras: el primer descubrimiento deja la vocal y el segundo la consonante", () => {
	assert.equal(mask("Fe", 1), "_E");
	assert.equal(mask("Fe", 2), "FE");
});

test("el modelo guarda el nivel de descubrimientos por actividad y los índices por palabra", () => {
	const activity = createActivity({ type: ACTIVITY_TYPE.PALABRAS });
	assert.equal(activity.letterReveals, 0);
	activity.game.words = [
		{ id: "w1", solution: "Ayuno", normalized: "AYUNO", anagram: "UOYNA", hints: [] },
		{ id: "w2", solution: "Fe", normalized: "FE", anagram: "EF", hints: [] },
	];
	activity.letterReveals = 2;
	const refreshed = refreshDerivedState(activity);
	assert.deepEqual(refreshed.game.words[0].reveals, [0, 2, 4, 3]);
	assert.deepEqual(refreshed.game.words[1].reveals, [1, 0]);
});

test("subir el nivel recalcula y bajar lo reduce", () => {
	const base = createActivity({ type: ACTIVITY_TYPE.PALABRAS });
	base.game.words = [{ id: "w1", solution: "Ayuno", normalized: "AYUNO", anagram: "UOYNA", hints: [] }];
	assert.deepEqual(refreshDerivedState({ ...base, letterReveals: 1 }).game.words[0].reveals, [0, 2, 4]);
	assert.deepEqual(refreshDerivedState({ ...base, letterReveals: 0 }).game.words[0].reveals, []);
});
