import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeWord } from "../src/core/letters.js";
import {
	DIRECTIONS,
	SOPA_SIZE,
	SOPA_WORD_COUNT,
	generateVariant,
	pathCells,
	placementsCoverWords,
	solutionFor,
	verifyVariant,
} from "../src/core/sopa.js";

const EXAMPLE_WORDS = [
	"Ayuno",
	"Oración",
	"Fe",
	"Entrega",
	"Silencio",
	"Perdón",
	"Gratitud",
	"Humildad",
	"Comunión",
	"Perseverancia",
];

function wordsOf(list) {
	return list.map((text, index) => ({
		id: `w${index + 1}`,
		text,
		normalized: normalizeWord(text),
	}));
}

function generated(seed = "fase-2") {
	const result = generateVariant({ words: wordsOf(EXAMPLE_WORDS), seed });
	assert.equal(result.ok, true, result.ok ? "" : result.error);
	return result.variant;
}

test("la sopa es de 20×20 con diez ubicaciones y ocho direcciones", () => {
	assert.equal(SOPA_SIZE, 20);
	assert.equal(SOPA_WORD_COUNT, 10);
	assert.equal(DIRECTIONS.length, 8);
	const ids = DIRECTIONS.map((direction) => direction.id);
	assert.deepEqual(new Set(ids).size, 8, "cada dirección es única");
	for (const direction of DIRECTIONS) {
		assert.ok([-1, 0, 1].includes(direction.dr), direction.id);
		assert.ok([-1, 0, 1].includes(direction.dc), direction.id);
		assert.ok(!(direction.dr === 0 && direction.dc === 0), `${direction.id} no puede ser nula`);
	}
});

test("la cuadrícula generada tiene exactamente 400 letras A-Z", () => {
	const variant = generated();
	assert.equal(variant.size, SOPA_SIZE);
	assert.equal(variant.grid.length, 400);
	assert.match(variant.grid, /^[A-Z]{400}$/u);
	assert.equal(variant.placements.length, 10);
});

test("cada palabra queda ubicada en la cuadrícula según su dirección", () => {
	const variant = generated();
	assert.deepEqual(verifyVariant(variant), { ok: true, errors: [] });
	for (const placement of variant.placements) {
		const cells = pathCells({
			size: variant.size,
			start: placement.start,
			directionId: placement.direction,
			length: placement.normalized.length,
		});
		assert.ok(cells, `${placement.wordId}: camino en rango`);
		assert.equal(cells.length, placement.normalized.length);
		const rebuilt = cells.map((index) => variant.grid[index]).join("");
		assert.equal(rebuilt, placement.normalized, `${placement.wordId}: letras del camino`);
		assert.deepEqual(placement.end, {
			row: placement.start.row + Math.sign(placement.end.row - placement.start.row) * (placement.normalized.length - 1),
			col: placement.start.col + Math.sign(placement.end.col - placement.start.col) * (placement.normalized.length - 1),
		});
	}
});

test("las palabras con acento se ubican normalizadas y conservan su texto", () => {
	const variant = generated();
	const oracion = variant.placements.find((placement) => placement.normalized === "ORACION");
	assert.ok(oracion, "ORACION debe estar ubicada");
	assert.deepEqual(placementsCoverWords(variant, wordsOf(EXAMPLE_WORDS)), []);
});

test("la generación es determinista por semilla y distinta entre semillas", () => {
	const first = generated("semilla-a");
	const second = generated("semilla-a");
	assert.equal(second.grid, first.grid);
	assert.deepEqual(second.placements, first.placements);

	const grids = new Set([first.grid, generated("semilla-b").grid, generated("semilla-c").grid]);
	assert.equal(grids.size, 3, "semillas distintas deben producir cuadrículas distintas");
});

test("la variante guarda lo necesario para no regenerarse nunca", () => {
	const variant = generated();
	assert.equal(typeof variant.seed, "string");
	assert.equal(typeof variant.id, "string");
	assert.ok(variant.id.length > 0);
	assert.equal(typeof variant.createdAt, "string");
	for (const placement of variant.placements) {
		assert.equal(typeof placement.wordId, "string");
		assert.equal(typeof placement.normalized, "string");
		assert.equal(typeof placement.direction, "string");
		assert.ok(Number.isInteger(placement.start.row) && Number.isInteger(placement.start.col));
		assert.ok(Number.isInteger(placement.end.row) && Number.isInteger(placement.end.col));
	}
});

test("una cuadrícula manipulada no pasa la verificación", () => {
	const variant = generated();
	const target = variant.placements[0];
	const index = target.start.row * variant.size + target.start.col;
	const tampered = {
		...variant,
		grid: `${variant.grid.slice(0, index)}Z${variant.grid.slice(index + 1)}`,
	};
	const result = verifyVariant(tampered);
	assert.equal(result.ok, false);
	assert.ok(result.errors.length > 0);
});

test("verifyVariant detecta tamaño y letras inválidas", () => {
	const variant = generated();
	assert.equal(verifyVariant({ ...variant, grid: variant.grid.slice(0, 399) }).ok, false);
	assert.equal(verifyVariant({ ...variant, grid: `ñ${variant.grid.slice(1)}` }).ok, false);
	assert.equal(verifyVariant({ ...variant, size: 0 }).ok, false);
	assert.equal(verifyVariant({ ...variant, placements: [] }).ok, false);
});

test("solutionFor devuelve el camino de una palabra", () => {
	const variant = generated();
	const word = wordsOf(EXAMPLE_WORDS)[0];
	const solution = solutionFor(variant, word.id);
	assert.ok(solution);
	assert.equal(solution.wordId, word.id);
	assert.equal(solution.cells.length, word.normalized.length);
	assert.equal(solution.cells.map((index) => variant.grid[index]).join(""), word.normalized);
});

test("una palabra imposible no rompe el motor", () => {
	const tooLong = generateVariant({ words: wordsOf(["A".repeat(21), ...EXAMPLE_WORDS.slice(1)]), seed: "x" });
	assert.equal(tooLong.ok, false);
	assert.equal(typeof tooLong.error, "string");

	const nine = generateVariant({ words: wordsOf(EXAMPLE_WORDS.slice(0, 9)), seed: "x" });
	assert.equal(nine.ok, false);

	const duplicated = generateVariant({
		words: wordsOf([...EXAMPLE_WORDS.slice(0, 9), "Ayuno"]),
		seed: "x",
	});
	assert.equal(duplicated.ok, false);
});

test("una cuadrícula que no puede acomodar las palabras informa el error", () => {
	const result = generateVariant({
		words: wordsOf(EXAMPLE_WORDS),
		seed: "sin-espacio",
		size: 4,
	});
	assert.equal(result.ok, false);
	assert.equal(typeof result.error, "string");
});

test("un normalized vacío no invalida una palabra que tiene texto", () => {
	// Regression: an empty `normalized` means "not computed yet", not "empty word".
	const words = wordsOf(EXAMPLE_WORDS).map((word) => ({ ...word, normalized: "" }));
	const result = generateVariant({ words, seed: "vacio" });
	assert.equal(result.ok, true, result.ok ? "" : result.error);
	assert.equal(result.variant.placements.length, 10);
});

test("el ejemplo de fase 2 se genera con su semilla fija", () => {
	// The seeded example ships with this exact seed; if it stopped generating, the app
	// would show an example without a grid and nobody would notice from the list alone.
	const result = generateVariant({ words: wordsOf(EXAMPLE_WORDS), seed: "jla-ejemplo-sopa-ayuno-y-oracion" });
	assert.equal(result.ok, true, result.ok ? "" : result.error);
	assert.equal(result.variant.placements.length, 10);
	assert.deepEqual(verifyVariant(result.variant), { ok: true, errors: [] });
	assert.match(result.variant.grid, /^[A-Z]{400}$/u);
});
