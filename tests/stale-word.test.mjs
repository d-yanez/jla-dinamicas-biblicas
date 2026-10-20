import assert from "node:assert/strict";
import { test } from "node:test";

import { wordText } from "../src/core/letters.js";
import { generateVariant, placementsCoverWords } from "../src/core/sopa.js";

// Regression for the reported bug: editing a word's text in the editor leaves its
// previously computed `normalized` cache in place until the draft is saved. Every
// consumer must treat `text` as the source of truth, or the engine keeps placing the
// word the moderator just replaced.

test("wordText prefiere el texto editado sobre un normalized viejo", () => {
	assert.equal(wordText({ text: "Consagración", normalized: "SILENCIO" }), "Consagración");
	assert.equal(wordText({ text: "Santificación", normalized: "PERSEVERANCIA" }), "Santificación");
	assert.equal(wordText({ text: "Ayuno", normalized: "AYUNO" }), "Ayuno");
});

test("wordText cae al normalized solo cuando no hay texto", () => {
	assert.equal(wordText({ normalized: "AYUNO" }), "AYUNO");
	assert.equal(wordText({ text: "   ", normalized: "AYUNO" }), "AYUNO");
	assert.equal(wordText({ text: "", normalized: "" }), undefined);
	assert.equal(wordText(undefined), undefined);
});

test("una variante generada con normalized viejo ubica la palabra nueva", () => {
	const words = [
		{ id: "w1", text: "Ayuno", normalized: "AYUNO" },
		{ id: "w2", text: "Oración", normalized: "ORACION" },
		{ id: "w3", text: "Obediencia", normalized: "FE" },
		{ id: "w4", text: "Entrega", normalized: "ENTREGA" },
		{ id: "w5", text: "Consagración", normalized: "SILENCIO" },
		{ id: "w6", text: "Perdón", normalized: "PERDON" },
		{ id: "w7", text: "Gratitud", normalized: "GRATITUD" },
		{ id: "w8", text: "Humildad", normalized: "HUMILDAD" },
		{ id: "w9", text: "Comunión", normalized: "COMUNION" },
		{ id: "w10", text: "Santificación", normalized: "PERSEVERANCIA" },
	];
	const result = generateVariant({ words, seed: "palabras-editadas" });
	assert.equal(result.ok, true, result.ok ? "" : result.error);
	const placed = result.variant.placements.map((placement) => placement.normalized).sort();
	assert.deepEqual(placed, ["AYUNO", "COMUNION", "CONSAGRACION", "ENTREGA", "GRATITUD", "HUMILDAD", "OBEDIENCIA", "ORACION", "PERDON", "SANTIFICACION"]);
	assert.equal(placed.includes("SILENCIO"), false, "no debe ubicar la palabra reemplazada");
	assert.equal(placed.includes("PERSEVERANCIA"), false, "no debe ubicar la palabra reemplazada");
	assert.deepEqual(placementsCoverWords(result.variant, words), []);
});

test("una variante vieja no cubre las palabras nuevas", () => {
	const original = Array.from({ length: 10 }, (_, index) => ({
		id: `w${index + 1}`,
		text: ["Ayuno", "Oración", "Fe", "Entrega", "Silencio", "Perdón", "Gratitud", "Humildad", "Comunión", "Perseverancia"][index],
	}));
	const generated = generateVariant({ words: original, seed: "cobertura" });
	assert.equal(generated.ok, true, generated.ok ? "" : generated.error);

	const edited = original.map((word, index) =>
		index === 2 ? { ...word, text: "Obediencia", normalized: "FE" } : index === 4 ? { ...word, text: "Consagración", normalized: "SILENCIO" } : word,
	);
	assert.deepEqual(placementsCoverWords(generated.variant, edited).sort(), ["CONSAGRACION", "OBEDIENCIA"]);
});
