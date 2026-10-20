import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeWord } from "../src/core/letters.js";
import {
	ACTIVITY_STATUS,
	ACTIVITY_TYPE,
	ROUND_SECONDS,
	createActivity,
	duplicateAsDraft,
	markTested,
	normalizeActivity,
	refreshDerivedState,
	refreshTestedState,
	relevantContentSignature,
	validateActivity,
	wordsSignature,
} from "../src/core/activity-model.js";
import { generateVariant } from "../src/core/sopa.js";

const WORDS = ["Ayuno", "Oración", "Fe", "Entrega", "Silencio", "Perdón", "Gratitud", "Humildad", "Comunión", "Perseverancia"];

function wordsOf(list = WORDS) {
	return list.map((text, index) => ({ id: `w${index + 1}`, text, normalized: normalizeWord(text) }));
}

function sopaDraft() {
	const activity = createActivity({ type: ACTIVITY_TYPE.SOPA, name: "Ayuno y oración" });
	activity.theme = "Ayuno y oración";
	activity.reference = "Mateo 6:16-18";
	activity.instructions = "Busquen cada palabra con su pareja.";
	activity.game.words = wordsOf();
	const variant = generateVariant({ words: activity.game.words, seed: "modelo" });
	assert.equal(variant.ok, true, variant.ok ? "" : variant.error);
	activity.game.variants = [variant.variant];
	activity.game.approvedVariantId = variant.variant.id;
	return activity;
}

test("createActivity arma un borrador con identificador estable y valores por defecto", () => {
	const activity = createActivity({ type: ACTIVITY_TYPE.SOPA, name: "Prueba" });
	assert.match(activity.id, /^[A-Za-z0-9-]{8,}$/u);
	assert.equal(activity.type, "sopa");
	assert.equal(activity.status, ACTIVITY_STATUS.DRAFT);
	assert.equal(activity.roundSeconds, 30);
	assert.equal(ROUND_SECONDS.default, 30);
	assert.equal(ROUND_SECONDS.min, 10);
	assert.equal(ROUND_SECONDS.max, 120);
	assert.deepEqual(activity.game.words, []);
	assert.deepEqual(activity.game.variants, []);
	assert.equal(activity.game.approvedVariantId, "");
	assert.equal(activity.testedAt, "");
	assert.equal(typeof activity.createdAt, "string");
	assert.equal(typeof activity.updatedAt, "string");
});

test("la duración de ronda acepta solo el rango de 10 a 120 segundos", () => {
	for (const value of [9, 121, 0, -5, 30.5, "30"]) {
		const activity = { ...sopaDraft(), roundSeconds: value };
		const result = validateActivity(activity);
		assert.equal(result.ok, false, `debe rechazar ${JSON.stringify(value)}`);
		assert.ok(result.errors.some((error) => error.field === "roundSeconds"));
	}
	for (const value of [10, 30, 120]) {
		const activity = { ...sopaDraft(), roundSeconds: value };
		assert.equal(validateActivity(activity).ok, true, `debe aceptar ${value}`);
	}
});

test("validateActivity exige los campos esenciales con errores específicos", () => {
	const empty = createActivity({ type: ACTIVITY_TYPE.SOPA, name: "" });
	const result = validateActivity(empty);
	assert.equal(result.ok, false);
	const fields = result.errors.map((error) => error.field);
	assert.deepEqual(new Set(fields), new Set(["name", "theme", "instructions", "game.words", "game.approvedVariantId"]));
	for (const error of result.errors) {
		assert.ok(error.message.length > 12, `mensaje específico: ${error.message}`);
	}
	assert.match(result.errors.find((error) => error.field === "name").message, /nombre/u);
	assert.match(result.errors.find((error) => error.field === "theme").message, /tema/u);
});

test("validateActivity acepta una actividad de sopa completa con variante aprobada", () => {
	const result = validateActivity(sopaDraft());
	assert.deepEqual(result, { ok: true, errors: [] });
});

test("validateActivity rechaza palabras inválidas, repetidas o demasiadas", () => {
	const digits = sopaDraft();
	digits.game.variants = [];
	digits.game.approvedVariantId = "";
	digits.game.words = wordsOf([...WORDS.slice(0, 9), "casa 1"]);
	const digitsResult = validateActivity(digits);
	assert.ok(digitsResult.errors.some((error) => error.field === "game.words" && /solo letras/u.test(error.message)));

	const repeated = sopaDraft();
	repeated.game.words = wordsOf([...WORDS.slice(0, 9), "Ayuno"]);
	repeated.game.variants = [];
	repeated.game.approvedVariantId = "";
	const repeatedResult = validateActivity(repeated);
	assert.ok(repeatedResult.errors.some((error) => /repetida/u.test(error.message)));

	const eleven = sopaDraft();
	eleven.game.words = wordsOf([...WORDS, "Extra"]);
	const elevenResult = validateActivity(eleven);
	assert.ok(elevenResult.errors.some((error) => /exactamente 10/u.test(error.message)));
});

test("validateActivity exige una variante aprobada que coincida con las palabras", () => {
	const withoutVariant = sopaDraft();
	withoutVariant.game.variants = [];
	withoutVariant.game.approvedVariantId = "";
	const missing = validateActivity(withoutVariant);
	assert.ok(missing.errors.some((error) => error.field === "game.approvedVariantId" && /aprobar una variante/u.test(error.message)));

	const staleVariant = sopaDraft();
	staleVariant.game.words = wordsOf([...WORDS.slice(0, 9), "Obediencia"]);
	const stale = validateActivity(staleVariant);
	assert.ok(stale.errors.some((error) => error.field === "game.approvedVariantId"));
});

test("solo puede haber una actividad publicada por juego", () => {
	const published = { ...sopaDraft(), status: ACTIVITY_STATUS.PUBLISHED };
	const candidate = { ...sopaDraft(), status: ACTIVITY_STATUS.PUBLISHED };
	const result = validateActivity(candidate, { publishedOfType: [published] });
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /una actividad publicada/u.test(error.message)));
});

test("cambiar las palabras invalida las variantes y la aprobada", () => {
	const activity = sopaDraft();
	assert.equal(activity.game.variants.length, 1);
	const changed = {
		...activity,
		game: { ...activity.game, words: wordsOf([...WORDS.slice(0, 9), "Obediencia"]) },
	};
	const refreshed = refreshDerivedState(changed);
	assert.equal(refreshed.game.variants.length, 1, "la cuadrícula se conserva: no se destruye trabajo aprobado");
	assert.equal(refreshed.game.approvedVariantId, "", "pero la aprobación se retira porque ya no cubre las palabras");
	assert.equal(refreshed.game.words[9].normalized, "OBEDIENCIA");
});

test("reordenar las palabras no invalida la cuadrícula", () => {
	const activity = sopaDraft();
	const reordered = [activity.game.words[9], ...activity.game.words.slice(0, 9)];
	const refreshed = refreshDerivedState({ ...activity, game: { ...activity.game, words: reordered } });
	assert.equal(refreshed.game.variants.length, 1);
	assert.equal(refreshed.game.approvedVariantId, activity.game.approvedVariantId);
});

test("la firma de contenido relevante ignora nombre, evento y fecha", () => {
	const base = sopaDraft();
	const signature = relevantContentSignature(base);
	assert.equal(relevantContentSignature({ ...base, name: "Otro nombre" }), signature);
	assert.equal(relevantContentSignature({ ...base, eventName: "Retiro" }), signature);
	assert.equal(relevantContentSignature({ ...base, eventDate: "2026-11-01" }), signature);
	assert.notEqual(relevantContentSignature({ ...base, roundSeconds: 45 }), signature);
	assert.notEqual(relevantContentSignature({ ...base, instructions: "Otras instrucciones" }), signature);
});

test("el indicador de probado se invalida al cambiar contenido relevante", () => {
	const tested = markTested(sopaDraft(), "2026-10-20T10:00:00.000Z");
	assert.equal(tested.testedAt, "2026-10-20T10:00:00.000Z");
	assert.equal(refreshTestedState({ ...tested, eventName: "Retiro" }).testedAt, tested.testedAt);
	assert.equal(refreshTestedState({ ...tested, roundSeconds: 60 }).testedAt, "");
});

test("duplicar produce un borrador independiente", () => {
	const original = { ...sopaDraft(), status: ACTIVITY_STATUS.PUBLISHED, testedAt: "2026-10-20T10:00:00.000Z" };
	const copy = duplicateAsDraft(original);
	assert.notEqual(copy.id, original.id);
	assert.equal(copy.status, ACTIVITY_STATUS.DRAFT);
	assert.equal(copy.name, `${original.name} (copia)`);
	assert.equal(copy.testedAt, "");
	assert.equal(copy.publishedAt, "");
	assert.deepEqual(copy.game.words, original.game.words);
	assert.notEqual(copy.game, original.game, "no debe compartir referencias mutables");
});

test("normalizeActivity tolera datos incompletos y descarta basura", () => {
	assert.equal(normalizeActivity(undefined), undefined);
	assert.equal(normalizeActivity("texto"), undefined);
	assert.equal(normalizeActivity([]), undefined);
	const partial = normalizeActivity({ id: "abc-123", type: "sopa", name: "X" });
	assert.equal(partial.id, "abc-123");
	assert.equal(partial.type, "sopa");
	assert.equal(partial.roundSeconds, 30);
	assert.deepEqual(partial.game.words, []);
	const coerced = normalizeActivity({ id: "x1", type: "sopa", roundSeconds: 999, status: "inventado" });
	assert.equal(coerced.roundSeconds, 30);
	assert.equal(coerced.status, ACTIVITY_STATUS.DRAFT);
});

test("wordsSignature cambia con el contenido y no con el orden de las palabras", () => {
	const words = wordsOf();
	const reordered = [...words].reverse();
	assert.equal(wordsSignature(reordered), wordsSignature(words));
	assert.notEqual(wordsSignature(wordsOf([...WORDS.slice(0, 9), "Otra"])), wordsSignature(words));
});

test("corregir la palabra devuelve la cuadrícula aprobada sin regenerar", () => {
	const activity = sopaDraft();
	const changed = {
		...activity,
		game: { ...activity.game, words: wordsOf([...WORDS.slice(0, 9), "Obediencia"]) },
	};
	const stale = refreshDerivedState(changed);
	assert.equal(stale.game.approvedVariantId, "", "mientras no coincide, no hay aprobación");
	const reverted = refreshDerivedState({ ...stale, game: { ...stale.game, words: activity.game.words } });
	assert.equal(reverted.game.variants.length, 1, "la variante sigue ahí");
	assert.equal(reverted.game.words[9].normalized, "PERSEVERANCIA");
	assert.equal(reverted.game.variants[0].id, activity.game.variants[0].id, "es la misma cuadrícula, no una nueva");
});
