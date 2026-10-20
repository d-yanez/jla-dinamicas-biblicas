import assert from "node:assert/strict";
import { test } from "node:test";

import { ALPHABET, MAX_WORD_LENGTH, isAlphabetLetter, normalizeWord } from "../src/core/letters.js";

test("el alfabeto de la cuadrícula es A-Z, sin acentos ni eñe", () => {
	assert.equal(ALPHABET.length, 26);
	assert.equal(ALPHABET, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
	assert.equal(MAX_WORD_LENGTH, 20);
	for (const letter of ALPHABET) assert.equal(isAlphabetLetter(letter), true, letter);
	for (const bad of ["ñ", "á", "a", "1", " ", "-", ""]) {
		assert.equal(isAlphabetLetter(bad), false, `no debe aceptar ${JSON.stringify(bad)}`);
	}
});

test("normalizeWord quita acentos y pasa a mayúsculas", () => {
	assert.equal(normalizeWord("Oración"), "ORACION");
	assert.equal(normalizeWord("AYUNO"), "AYUNO");
	assert.equal(normalizeWord("  fe  "), "FE");
	assert.equal(normalizeWord("Ñandú"), "NANDU");
	assert.equal(normalizeWord("Comunión"), "COMUNION");
	assert.equal(normalizeWord("Ü"), "U");
});

test("normalizeWord rechaza lo que no es una sola palabra de letras", () => {
	for (const bad of ["", "   ", "casa 1", "dos palabras", "casa-de-fe", "123", "FE!", null, undefined, 42]) {
		assert.equal(normalizeWord(bad), undefined, `debe rechazar ${JSON.stringify(bad)}`);
	}
});

test("normalizeWord respeta el largo máximo de la cuadrícula", () => {
	assert.equal(normalizeWord("A".repeat(MAX_WORD_LENGTH)), "A".repeat(20));
	assert.equal(normalizeWord("A".repeat(MAX_WORD_LENGTH + 1)), undefined);
	assert.equal(normalizeWord("supercalifragilisticoespialidoso"), undefined);
});
