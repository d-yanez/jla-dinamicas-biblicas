import assert from "node:assert/strict";
import { test } from "node:test";

import {
	HINT_MAX_LENGTH,
	MAX_HINTS,
	MIN_SOLUTION_LENGTH,
	TIEBREAKER_COUNT,
	checkAnagramPair,
	generateAnagram,
	letterMultiset,
	normalizeSolution,
} from "../src/core/anagram.js";

test("normalizeSolution aplica la misma regla que la sopa, con mínimo de dos letras", () => {
	assert.equal(MIN_SOLUTION_LENGTH, 2);
	assert.equal(MAX_HINTS, 2);
	assert.equal(TIEBREAKER_COUNT, 3);
	assert.equal(HINT_MAX_LENGTH, 140);
	assert.equal(normalizeSolution("Oración"), "ORACION");
	assert.equal(normalizeSolution("Ñandú"), "NANDU");
	assert.equal(normalizeSolution("  fe  "), "FE");
	for (const bad of ["", "a", "1", "dos palabras", "casa 1", null, undefined, 42, "A".repeat(21)]) {
		assert.equal(normalizeSolution(bad), undefined, `debe rechazar ${JSON.stringify(bad)}`);
	}
});

test("letterMultiset compara letras sin importar el orden", () => {
	assert.equal(letterMultiset("ORACION"), "ACINOOR");
	assert.equal(letterMultiset("Oración"), "ACINOOR");
	assert.equal(letterMultiset("OICARNO"), "ACINOOR");
	assert.notEqual(letterMultiset("ORACION"), letterMultiset("ORACIO"));
	assert.notEqual(letterMultiset("ORACION"), letterMultiset("ORACCION"));
	assert.equal(letterMultiset(""), "");
});

test("checkAnagramPair acepta solo el mismo multiconjunto y distinto orden", () => {
	const valid = checkAnagramPair({ solution: "Oración", anagram: "oicarno" });
	assert.equal(valid.ok, true);
	assert.equal(valid.solution, "ORACION");
	assert.equal(valid.anagram, "OICARNO");

	const missing = checkAnagramPair({ solution: "ORACION", anagram: "OICARN" });
	assert.equal(missing.ok, false);
	assert.equal(missing.code, "letters_mismatch");

	const extra = checkAnagramPair({ solution: "ORACION", anagram: "OICARNOS" });
	assert.equal(extra.ok, false);
	assert.equal(extra.code, "letters_mismatch");

	// "OOICARN" would be the same multiset (O twice): a real repeated extra letter is
	// three O's against the solution's two.
	const repeatedExtra = checkAnagramPair({ solution: "ORACION", anagram: "OOICARNO" });
	assert.equal(repeatedExtra.ok, false);
	assert.equal(repeatedExtra.code, "letters_mismatch");

	const identical = checkAnagramPair({ solution: "ORACION", anagram: "oracion" });
	assert.equal(identical.ok, false);
	assert.equal(identical.code, "identical");

	const badSolution = checkAnagramPair({ solution: "O R A C I O N", anagram: "OICARNO" });
	assert.equal(badSolution.ok, false);
	assert.equal(badSolution.code, "invalid_solution");

	const badAnagram = checkAnagramPair({ solution: "ORACION", anagram: "" });
	assert.equal(badAnagram.ok, false);
	assert.equal(badAnagram.code, "invalid_anagram");
});

test("cada código de error trae un mensaje propio y accionable", () => {
	const codes = [
		[{ solution: "x", anagram: "abc" }, "invalid_solution"],
		[{ solution: "abc", anagram: "" }, "invalid_anagram"],
		[{ solution: "abc", anagram: "abd" }, "letters_mismatch"],
		[{ solution: "abc", anagram: "abc" }, "identical"],
	];
	for (const [input, expected] of codes) {
		const result = checkAnagramPair(input);
		assert.equal(result.code, expected);
		assert.ok(result.message.length > 20, `mensaje específico para ${expected}: ${result.message}`);
	}
	const messages = new Set(codes.map(([input]) => checkAnagramPair(input).message));
	assert.equal(messages.size, codes.length, "cada código explica algo distinto");
});

test("generateAnagram es determinista y respeta el multiconjunto", () => {
	const first = generateAnagram({ solution: "Oración", seed: "semilla-a" });
	assert.equal(first.ok, true, first.ok ? "" : first.error);
	const second = generateAnagram({ solution: "Oración", seed: "semilla-a" });
	assert.equal(second.anagram, first.anagram);
	assert.equal(letterMultiset(first.anagram), "ACINOOR");
	assert.notEqual(first.anagram, "ORACION");
	assert.match(first.anagram, /^[A-Z]+$/u);
});

test("generateAnagram cambia con la semilla y separa al menos dos posiciones", () => {
	const anagrams = new Set(
		["s1", "s2", "s3", "s4", "s5"].map((seed) => generateAnagram({ solution: "PERSEVERANCIA", seed }).anagram),
	);
	assert.ok(anagrams.size >= 3, "semillas distintas deben producir anagramas distintos");
	for (const anagram of anagrams) {
		assert.equal(letterMultiset(anagram), letterMultiset("PERSEVERANCIA"));
		const changed = [...anagram].filter((letter, index) => letter !== "PERSEVERANCIA"[index]).length;
		assert.ok(changed >= 2, `el anagrama ${anagram} debe mover al menos dos letras`);
	}
});

test("generateAnagram informa cuando no existe un anagrama distinto", () => {
	const repeated = generateAnagram({ solution: "AA", seed: "x" });
	assert.equal(repeated.ok, false);
	assert.match(repeated.error, /anagrama/u);
	const invalid = generateAnagram({ solution: "a", seed: "x" });
	assert.equal(invalid.ok, false);
	assert.equal(typeof invalid.error, "string");
});

test("un anagrama generado siempre pasa la validación del par", () => {
	for (const solution of ["Fe", "Ayuno", "Silencio", "Oración", "Perseverancia", "Misericordia"]) {
		const generated = generateAnagram({ solution, seed: `${solution}-seed` });
		assert.equal(generated.ok, true, `${solution}: ${generated.error ?? ""}`);
		const checked = checkAnagramPair({ solution, anagram: generated.anagram });
		assert.equal(checked.ok, true, `${solution}: ${checked.message ?? ""}`);
	}
});
