import assert from "node:assert/strict";
import { test } from "node:test";

import {
	ACTIVITY_STATUS,
	ACTIVITY_TYPE,
	createActivity,
	duplicateAsDraft,
	normalizeActivity,
	refreshDerivedState,
	relevantContentSignature,
	validateActivity,
} from "../src/core/activity-model.js";
import { buildExampleActivities } from "../src/core/activities.js";
import { generateAnagram, normalizeSolution } from "../src/core/anagram.js";

const SOLUTIONS = ["Oración", "Ayuno", "Silencio", "Entrega", "Perdón", "Gratitud", "Humildad", "Comunión", "Esperanza", "Fe"];
const TIEBREAKERS = ["Misericordia", "Perseverancia", "Bendición"];

function wordOf(solution, hints = []) {
	return {
		id: `w-${normalizeSolution(solution)}`,
		solution,
		normalized: normalizeSolution(solution),
		anagram: generateAnagram({ solution, seed: `${solution}` }).anagram,
		hints,
	};
}

function tiebreakerOf(solution) {
	return {
		id: `t-${normalizeSolution(solution)}`,
		solution,
		normalized: normalizeSolution(solution),
		anagram: generateAnagram({ solution, seed: `tie-${solution}` }).anagram,
	};
}

function palabrasDraft() {
	const activity = createActivity({ type: ACTIVITY_TYPE.PALABRAS, name: "Palabras desordenadas: Ayuno y oración" });
	activity.theme = "Ayuno y oración";
	activity.instructions = "Escriban la solución de cada palabra.";
	activity.game.words = SOLUTIONS.map((solution) => wordOf(solution));
	activity.game.tiebreakers = TIEBREAKERS.map(tiebreakerOf);
	return activity;
}

test("createActivity arma el bolsillo correcto según el juego", () => {
	const sopa = createActivity({ type: ACTIVITY_TYPE.SOPA });
	assert.deepEqual(sopa.game, { words: [], variants: [], approvedVariantId: "" });
	const palabras = createActivity({ type: ACTIVITY_TYPE.PALABRAS });
	assert.deepEqual(palabras.game, { words: [], tiebreakers: [] });
	assert.equal(palabras.roundSeconds, 30);
	assert.equal(palabras.status, ACTIVITY_STATUS.DRAFT);
});

test("validateActivity acepta una actividad de palabras desordenadas completa", () => {
	assert.deepEqual(validateActivity(palabrasDraft()), { ok: true, errors: [] });
});

test("validateActivity exige diez palabras, tres desempates y pistas dentro del límite", () => {
	const nine = palabrasDraft();
	nine.game.words = nine.game.words.slice(0, 9);
	const nineResult = validateActivity(nine);
	assert.ok(nineResult.errors.some((error) => /exactamente 10/u.test(error.message)));

	const twoTies = palabrasDraft();
	twoTies.game.tiebreakers = twoTies.game.tiebreakers.slice(0, 2);
	const tiesResult = validateActivity(twoTies);
	assert.ok(tiesResult.errors.some((error) => error.field === "game.tiebreakers" && /3 palabras/u.test(error.message)));

	const tooManyHints = palabrasDraft();
	tooManyHints.game.words[0] = { ...tooManyHints.game.words[0], hints: ["una", "dos", "tres"] };
	assert.ok(validateActivity(tooManyHints).errors.some((error) => /dos pistas/u.test(error.message)));

	const longHint = palabrasDraft();
	longHint.game.words[0] = { ...longHint.game.words[0], hints: ["x".repeat(200)] };
	assert.ok(validateActivity(longHint).errors.some((error) => /140/u.test(error.message)));
});

test("validateActivity rechaza anagramas con letras de más, de menos o iguales a la solución", () => {
	const missing = palabrasDraft();
	missing.game.words[0] = { ...missing.game.words[0], anagram: "OICARN" };
	const missingResult = validateActivity(missing);
	assert.ok(missingResult.errors.some((error) => /mismas letras/u.test(error.message)));

	const extra = palabrasDraft();
	extra.game.tiebreakers[0] = { ...extra.game.tiebreakers[0], anagram: "MISERICORDIAA" };
	assert.ok(validateActivity(extra).errors.some((error) => /mismas letras/u.test(error.message)));

	const identical = palabrasDraft();
	identical.game.words[1] = { ...identical.game.words[1], anagram: "AYUNO" };
	assert.ok(validateActivity(identical).errors.some((error) => /igual a la solución/u.test(error.message)));
});

test("validateActivity exige solución válida en palabras y desempates", () => {
	const badWord = palabrasDraft();
	badWord.game.words[2] = { id: "x", solution: "casa 1", normalized: "CASA1", anagram: "AACS1", hints: [] };
	assert.ok(validateActivity(badWord).errors.some((error) => error.field === "game.words"));

	const badTie = palabrasDraft();
	badTie.game.tiebreakers[2] = { id: "y", solution: "a", normalized: "A", anagram: "A" };
	assert.ok(validateActivity(badTie).errors.some((error) => error.field === "game.tiebreakers"));
});

test("normalizeActivity reconstruye las palabras de este juego", () => {
	const stored = normalizeActivity({
		id: "abc-123",
		type: "palabras",
		name: "X",
		game: {
			words: [
				{ id: "w1", solution: "Oración", anagram: "OICARNO", hints: ["una"] },
				{ id: "w2", solution: "", anagram: "ZZZ" },
				{ id: "w3", solution: "Fe", anagram: "EF" },
			],
			tiebreakers: [{ id: "t1", solution: "Bendición", anagram: "NOICIDNEB" }],
		},
	});
	assert.equal(stored.type, "palabras");
	assert.deepEqual(stored.game.words.map((word) => word.normalized), ["ORACION", "FE"]);
	assert.deepEqual(stored.game.words[0].hints, ["una"]);
	assert.deepEqual(stored.game.words[1].hints, []);
	assert.equal(stored.game.tiebreakers.length, 1);
	assert.equal(stored.game.tiebreakers[0].normalized, "BENDICION");
});

test("refreshDerivedState recalcula la solución normalizada y conserva el anagrama escrito", () => {
	const edited = palabrasDraft();
	edited.game.words[0] = { ...edited.game.words[0], solution: "Oración", normalized: "VIEJO", anagram: "OICARNO" };
	const refreshed = refreshDerivedState(edited);
	assert.equal(refreshed.game.words[0].normalized, "ORACION");
	assert.equal(refreshed.game.words[0].anagram, "OICARNO");
	assert.equal(refreshed.game.tiebreakers.length, 3);
});

test("la firma de contenido incluye anagramas, pistas, desempates y el orden de ronda", () => {
	const base = palabrasDraft();
	const signature = relevantContentSignature(base);
	assert.equal(relevantContentSignature({ ...base, name: "Otro" }), signature);
	assert.notEqual(relevantContentSignature({ ...base, roundSeconds: 45 }), signature);

	const anagramChanged = {
		...base,
		game: { ...base.game, words: [{ ...base.game.words[0], anagram: "ACINORO" }, ...base.game.words.slice(1)] },
	};
	assert.notEqual(relevantContentSignature(anagramChanged), signature);

	const hintChanged = {
		...base,
		game: { ...base.game, words: [{ ...base.game.words[0], hints: ["una pista"] }, ...base.game.words.slice(1)] },
	};
	assert.notEqual(relevantContentSignature(hintChanged), signature);

	const reordered = { ...base, game: { ...base.game, words: [...base.game.words].reverse() } };
	assert.notEqual(relevantContentSignature(reordered), signature, "el orden de ronda es contenido relevante en este juego");

	const tiebreakerChanged = {
		...base,
		game: { ...base.game, tiebreakers: [{ ...base.game.tiebreakers[0], anagram: "MISERICORDIA".split("").reverse().join("") }, ...base.game.tiebreakers.slice(1)] },
	};
	assert.notEqual(relevantContentSignature(tiebreakerChanged), signature);
});

test("duplicar una actividad de palabras produce un borrador independiente", () => {
	const original = { ...palabrasDraft(), status: ACTIVITY_STATUS.PUBLISHED, testedAt: "2026-10-20T10:00:00.000Z" };
	const copy = duplicateAsDraft(original);
	assert.notEqual(copy.id, original.id);
	assert.equal(copy.status, ACTIVITY_STATUS.DRAFT);
	assert.equal(copy.name, `${original.name} (copia)`);
	assert.equal(copy.testedAt, "");
	assert.deepEqual(copy.game.words, original.game.words);
	assert.notEqual(copy.game.words, original.game.words, "no debe compartir el arreglo mutable");
});

test("los dos ejemplos de la app son válidos, editables y no publicados", () => {
	const examples = buildExampleActivities();
	assert.equal(examples.length, 2);
	assert.deepEqual(examples.map((example) => example.type).sort(), ["palabras", "sopa"]);
	for (const example of examples) {
		assert.equal(example.status, ACTIVITY_STATUS.DRAFT, `${example.type} no debe estar publicada`);
		assert.ok(example.theme.length > 0);
		assert.deepEqual(validateActivity(example), { ok: true, errors: [] }, `${example.type}: ${JSON.stringify(validateActivity(example).errors)}`);
	}
	const sopa = examples.find((example) => example.type === "sopa");
	assert.equal(sopa.game.words.length, 10);
	assert.equal(sopa.game.variants.length, 1);
	assert.ok(sopa.game.approvedVariantId.length > 0);
	const palabras = examples.find((example) => example.type === "palabras");
	assert.equal(palabras.game.words.length, 10);
	assert.equal(palabras.game.tiebreakers.length, 3);
	assert.ok(palabras.game.words.some((word) => word.hints.length > 0), "el ejemplo debe mostrar pistas");
});

test("una pista recién agregada y todavía vacía no se descarta al guardar", () => {
	// Regression: adding a hint created an empty string, and normalization dropped it on
	// the very next autosave, so the new hint input vanished half a second later.
	const stored = normalizeActivity({
		id: "x-1",
		type: "palabras",
		game: { words: [{ solution: "Fe", anagram: "EF", hints: ["", "algo"] }] },
	});
	assert.deepEqual(stored.game.words[0].hints, ["", "algo"]);
	assert.equal(stored.game.words[0].hints.length, 2);
});

test("más de dos pistas se recortan al leer", () => {
	const stored = normalizeActivity({
		id: "x-2",
		type: "palabras",
		game: { words: [{ solution: "Fe", anagram: "EF", hints: ["una", "dos", "tres"] }] },
	});
	assert.deepEqual(stored.game.words[0].hints, ["una", "dos"]);
});

test("los desempates también admiten hasta dos pistas", () => {
	// The spec only asks for a valid answer and anagram on tiebreakers; blocking hints
	// there was an unnecessary restriction of ours.
	const withHints = palabrasDraft();
	withHints.game.tiebreakers[0] = { ...withHints.game.tiebreakers[0], hints: ["una", "dos"] };
	assert.deepEqual(validateActivity(withHints), { ok: true, errors: [] });

	const tooMany = palabrasDraft();
	tooMany.game.tiebreakers[0] = { ...tooMany.game.tiebreakers[0], hints: ["una", "dos", "tres"] };
	assert.ok(validateActivity(tooMany).errors.some((error) => /dos pistas/u.test(error.message)));

	const long = palabrasDraft();
	long.game.tiebreakers[0] = { ...long.game.tiebreakers[0], hints: ["x".repeat(200)] };
	assert.ok(validateActivity(long).errors.some((error) => /140/u.test(error.message)));
});

test("las pistas de los desempates se guardan y cuentan como contenido relevante", () => {
	const stored = normalizeActivity({
		id: "x-3",
		type: "palabras",
		game: { tiebreakers: [{ solution: "Fe", anagram: "EF", hints: ["", "algo"] }] },
	});
	assert.deepEqual(stored.game.tiebreakers[0].hints, ["", "algo"]);

	const base = palabrasDraft();
	base.game.tiebreakers[0] = { ...base.game.tiebreakers[0], hints: ["algo"] };
	assert.notEqual(relevantContentSignature(base), relevantContentSignature(palabrasDraft()), "una pista de desempate es contenido relevante");
	const copy = duplicateAsDraft(base);
	assert.deepEqual(copy.game.tiebreakers[0].hints, ["algo"]);
});
