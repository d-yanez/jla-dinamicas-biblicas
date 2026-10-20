import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DEFAULT_PREFS,
	PREFS_STORAGE_KEY,
	readStoredPrefs,
	writeStoredPrefs,
} from "../src/core/prefs.js";

function fakeStorage(initial = {}) {
	const map = new Map(Object.entries(initial));
	return {
		map,
		getItem: (key) => (map.has(key) ? map.get(key) : null),
		setItem: (key, value) => map.set(key, String(value)),
		removeItem: (key) => map.delete(key),
	};
}

test("las preferencias usan una clave estable y propia", () => {
	assert.equal(PREFS_STORAGE_KEY, "jla.prefs");
});

test("escribir y leer preferencias hace roundtrip síncrono", () => {
	const storage = fakeStorage();
	assert.equal(writeStoredPrefs({ displaySize: "normal", highContrast: true }, storage), true);
	assert.equal(storage.map.has(PREFS_STORAGE_KEY), true);
	assert.deepEqual(readStoredPrefs(storage), { displaySize: "normal", highContrast: true });
});

test("sin datos guardados se usan los valores por defecto", () => {
	assert.deepEqual(readStoredPrefs(fakeStorage()), DEFAULT_PREFS);
});

test("un valor corrupto o inválido nunca rompe la lectura", () => {
	assert.deepEqual(readStoredPrefs(fakeStorage({ [PREFS_STORAGE_KEY]: "no es json" })), DEFAULT_PREFS);
	assert.deepEqual(readStoredPrefs(fakeStorage({ [PREFS_STORAGE_KEY]: "null" })), DEFAULT_PREFS);
	assert.deepEqual(readStoredPrefs(fakeStorage({ [PREFS_STORAGE_KEY]: JSON.stringify({ displaySize: "enorme" }) })), DEFAULT_PREFS);
	assert.deepEqual(
		readStoredPrefs(fakeStorage({ [PREFS_STORAGE_KEY]: JSON.stringify({ displaySize: "normal", highContrast: "sí" }) })),
		{ displaySize: "normal", highContrast: false },
	);
});

test("sin almacenamiento disponible se cae a los valores por defecto", () => {
	assert.deepEqual(readStoredPrefs(undefined), DEFAULT_PREFS);
	assert.deepEqual(readStoredPrefs(null), DEFAULT_PREFS);
});

test("un almacenamiento que falla al escribir no lanza", () => {
	const broken = {
		getItem: () => null,
		setItem: () => {
			throw new Error("QuotaExceededError");
		},
	};
	assert.equal(writeStoredPrefs({ displaySize: "normal", highContrast: true }, broken), false);
	assert.equal(writeStoredPrefs(DEFAULT_PREFS, undefined), false);
});

test("escribir normaliza antes de guardar", () => {
	const storage = fakeStorage();
	writeStoredPrefs({ displaySize: "GRANDE", highContrast: 1, extra: true }, storage);
	assert.deepEqual(JSON.parse(storage.map.get(PREFS_STORAGE_KEY)), DEFAULT_PREFS);
});
