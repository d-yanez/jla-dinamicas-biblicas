import assert from "node:assert/strict";
import { test } from "node:test";

import { buildExampleActivities, EXAMPLE_KEYS, pendingExamples } from "../src/core/activities.js";
import { duplicateAsDraft, normalizeActivity } from "../src/core/activity-model.js";

// Regression for the reported bug: a browser that already stored the phase-2 marker
// (when the only example was the sopa) never received the phase-3 example, because the
// seeding flag was global instead of per example.

test("sin nada sembrado se siembran los dos ejemplos", () => {
	const pending = pendingExamples({ activities: [], seededKeys: [] });
	assert.deepEqual(
		pending.map((example) => example.exampleKey),
		["sopa-ayuno-oracion", "palabras-ayuno-oracion"],
	);
});

test("una base que ya tiene el ejemplo de sopa recibe solo el de palabras", () => {
	const sopa = buildExampleActivities().find((example) => example.type === "sopa");
	const pending = pendingExamples({ activities: [sopa], seededKeys: ["sopa-ayuno-oracion"] });
	assert.deepEqual(
		pending.map((example) => example.exampleKey),
		["palabras-ayuno-oracion"],
	);
});

test("con todo sembrado no se siembra nada", () => {
	const examples = buildExampleActivities();
	const pending = pendingExamples({ activities: examples, seededKeys: [...EXAMPLE_KEYS] });
	assert.deepEqual(pending, []);
});

test("un ejemplo presente en la base no se duplica aunque falte su clave", () => {
	const examples = buildExampleActivities();
	const pending = pendingExamples({ activities: examples, seededKeys: [] });
	assert.deepEqual(pending, []);
});

test("una copia del ejemplo no hereda la marca ni bloquea la siembra", () => {
	const sopa = buildExampleActivities().find((example) => example.type === "sopa");
	const copy = duplicateAsDraft(sopa);
	assert.equal(copy.exampleKey, "", "una copia no es el ejemplo");
	const pending = pendingExamples({ activities: [copy], seededKeys: [] });
	assert.ok(
		pending.some((example) => example.type === "sopa"),
		"la copia no debe impedir que el ejemplo real se siembre",
	);
});

test("los dos ejemplos llevan su clave estable y se conserva al leerlos", () => {
	const examples = buildExampleActivities();
	assert.deepEqual(examples.map((example) => example.exampleKey), [...EXAMPLE_KEYS]);
	for (const example of examples) {
		const stored = normalizeActivity(JSON.parse(JSON.stringify(example)));
		assert.equal(stored.exampleKey, example.exampleKey);
	}
});

test("una actividad normal no tiene marca de ejemplo", () => {
	const stored = normalizeActivity({ id: "x-1", type: "sopa", name: "Mía" });
	assert.equal(stored.exampleKey, "");
});
