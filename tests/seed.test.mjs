import assert from "node:assert/strict";
import { test } from "node:test";

import { buildExampleActivities } from "../src/core/activities.js";
import { planSeed } from "../src/core/seed.js";

const EXAMPLES = buildExampleActivities();
let counter = 0;
const makeId = () => `seed-${(counter += 1)}`;

test("con datos en el dispositivo la semilla no toca nada", () => {
	const plan = planSeed({ incoming: EXAMPLES, activities: [EXAMPLES[0]], makeId });
	assert.equal(plan.mode, "skip");
	assert.deepEqual(plan.toInsert, []);
});

test("en una base vacía la semilla conserva lo publicado y deja el resto como borrador", () => {
	const published = EXAMPLES.map((activity) => ({ ...activity, status: "published" }));
	const plan = planSeed({ incoming: published, activities: [], makeId });
	assert.equal(plan.mode, "seed");
	assert.equal(plan.toInsert.length, 2);
	assert.deepEqual([...plan.published].sort(), ["palabras", "sopa"]);
	for (const activity of plan.toInsert) {
		assert.equal(activity.status, "published", "el navegador nuevo queda listo para jugar");
		assert.equal(activity.originId, "");
		assert.equal(activity.exampleKey, "");
		assert.ok(activity.publishedAt.length > 0);
	}
});

test("solo una publicada por juego: la segunda vuelve a borrador", () => {
	const published = [EXAMPLES[0], { ...EXAMPLES[0], name: "Otra sopa" }];
	const plan = planSeed({ incoming: published.map((activity) => ({ ...activity, status: "published" })), activities: [], makeId });
	assert.equal(plan.published.length, 1);
	assert.equal(plan.toInsert[0].status, "published");
	assert.equal(plan.toInsert[1].status, "draft");
});

test("sin publicadas, todo entra como borrador", () => {
	const plan = planSeed({ incoming: EXAMPLES, activities: [], makeId });
	assert.equal(plan.toInsert.length, 2);
	assert.ok(plan.toInsert.every((activity) => activity.status === "draft"));
	assert.deepEqual(plan.published, []);
});

test("las entradas inválidas se omiten", () => {
	const plan = planSeed({ incoming: [EXAMPLES[0], { type: "inventado" }, "basura"], activities: [], makeId });
	assert.equal(plan.toInsert.length, 1);
});

test("un archivo sin actividades no siembra nada", () => {
	assert.deepEqual(planSeed({ incoming: [], activities: [], makeId }), { mode: "skip", toInsert: [], published: [] });
});
