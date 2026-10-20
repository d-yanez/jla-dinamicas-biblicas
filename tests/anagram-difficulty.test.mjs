import assert from "node:assert/strict";
import { test } from "node:test";

import {
	ANAGRAM_DIFFICULTIES,
	DEFAULT_ANAGRAM_DIFFICULTY,
	generateAnagram,
	letterMultiset,
	normalizeSolution,
} from "../src/core/anagram.js";

const WORDS = ["Fe", "Ayuno", "Oración", "Silencio", "Esperanza", "Misericordia", "Perseverancia"];

function inPlace(solution, anagram) {
	const base = normalizeSolution(solution);
	let count = 0;
	for (let index = 0; index < base.length; index += 1) if (anagram[index] === base[index]) count += 1;
	return count;
}

test("hay tres niveles y el de por defecto es media", () => {
	assert.deepEqual(ANAGRAM_DIFFICULTIES, ["facil", "media", "dificil"]);
	assert.equal(DEFAULT_ANAGRAM_DIFFICULTY, "media");
});

test("cada nivel respeta su ventana de letras en su lugar", () => {
	for (const solution of WORDS) {
		const base = normalizeSolution(solution);
		for (let seed = 1; seed <= 5; seed += 1) {
			const context = `${solution} (${base.length}) seed ${seed}`;
			const facil = generateAnagram({ solution, seed: `s${seed}`, difficulty: "facil" });
			const media = generateAnagram({ solution, seed: `s${seed}`, difficulty: "media" });
			const dificil = generateAnagram({ solution, seed: `s${seed}`, difficulty: "dificil" });
			assert.equal(facil.ok && media.ok && dificil.ok, true, context);

			for (const anagram of [facil.anagram, media.anagram, dificil.anagram]) {
				assert.equal(letterMultiset(anagram), letterMultiset(solution), context);
				assert.notEqual(anagram, base, `${context}: no puede ser igual a la solución`);
			}

			// Fácil: primera letra anclada y al menos dos letras en su lugar.
			if (base.length > 2) assert.equal(facil.anagram[0], base[0], `${context}: fácil ancla la primera letra`);
			if (base.length > 3) assert.ok(inPlace(solution, facil.anagram) >= 2, `${context}: fácil necesita dos anclas`);
			assert.ok(inPlace(solution, facil.anagram) <= Math.max(2, Math.ceil(base.length / 2)), `${context}: fácil no debe leerse solo`);

			// Media: solo la primera letra anclada.
			if (base.length > 2) assert.equal(media.anagram[0], base[0], `${context}: media ancla la primera letra`);
			if (base.length > 2) assert.ok(inPlace(solution, media.anagram) >= 1, `${context}: media conserva la ancla`);
			assert.ok(
				inPlace(solution, media.anagram) <= Math.max(1, Math.ceil(base.length / 3)),
				`${context}: media no debe pasar un tercio en su lugar`,
			);

			// Difícil: sin anclas y como mucho una letra quieta.
			assert.ok(inPlace(solution, dificil.anagram) <= 1, `${context}: difícil deja como mucho una letra quieta`);
		}
	}
});

test("el mismo nivel y la misma semilla dan el mismo anagrama", () => {
	for (const difficulty of ANAGRAM_DIFFICULTIES) {
		const first = generateAnagram({ solution: "Perseverancia", seed: "estable", difficulty });
		const second = generateAnagram({ solution: "Perseverancia", seed: "estable", difficulty });
		assert.equal(second.anagram, first.anagram, difficulty);
	}
});

test("cambiar el nivel cambia el anagrama de una palabra larga", () => {
	const facil = generateAnagram({ solution: "Perseverancia", seed: "compara", difficulty: "facil" });
	const dificil = generateAnagram({ solution: "Perseverancia", seed: "compara", difficulty: "dificil" });
	assert.notEqual(facil.anagram, dificil.anagram);
});

test("un nivel desconocido cae a media", () => {
	const invalid = generateAnagram({ solution: "Ayuno", seed: "x", difficulty: "imposible" });
	const media = generateAnagram({ solution: "Ayuno", seed: "x", difficulty: "media" });
	assert.equal(invalid.anagram, media.anagram);
});

test("dos letras: el único anagrama posible sigue siendo válido", () => {
	const generated = generateAnagram({ solution: "Fe", seed: "x", difficulty: "facil" });
	assert.equal(generated.ok, true);
	assert.equal(generated.anagram, "EF");
});

test("una palabra con letras repetidas sigue sin poder desordenarse", () => {
	const repeated = generateAnagram({ solution: "AA", seed: "x", difficulty: "dificil" });
	assert.equal(repeated.ok, false);
	assert.match(repeated.error, /anagrama/u);
});
