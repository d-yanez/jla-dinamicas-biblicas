import assert from "node:assert/strict";
import { test } from "node:test";

import {
	PIN_LENGTH,
	createPinRecord,
	isPinRecord,
	normalizePin,
	verifyPin,
} from "../src/core/pin.js";

test("normalizePin acepta solo cuatro dígitos", () => {
	assert.equal(PIN_LENGTH, 4);
	assert.equal(normalizePin("1234"), "1234");
	assert.equal(normalizePin(" 0042 "), "0042");
	for (const rejected of ["", "123", "12345", "12a4", "12 4", "٤٥٦٧", null, undefined, 1234]) {
		assert.equal(normalizePin(rejected), undefined, `debe rechazar ${JSON.stringify(rejected)}`);
	}
});

test("createPinRecord produce un registro verificable y sin el PIN en claro", async () => {
	const record = await createPinRecord("1234", { iterations: 1000 });
	assert.equal(record.algorithm, "PBKDF2-SHA256");
	assert.equal(record.iterations, 1000);
	assert.equal(typeof record.salt, "string");
	assert.equal(typeof record.hash, "string");
	assert.ok(!JSON.stringify(record).includes("1234"), "el PIN no debe aparecer en el registro");
	assert.equal(await verifyPin("1234", record), true);
	assert.equal(await verifyPin("4321", record), false);
	assert.equal(await verifyPin("123", record), false);
});

test("cada registro usa una sal distinta aunque el PIN sea el mismo", async () => {
	const [a, b] = await Promise.all([
		createPinRecord("1234", { iterations: 1000 }),
		createPinRecord("1234", { iterations: 1000 }),
	]);
	assert.notEqual(a.salt, b.salt);
	assert.notEqual(a.hash, b.hash);
	assert.equal(await verifyPin("1234", a), true);
	assert.equal(await verifyPin("1234", b), true);
});

test("el registro por defecto usa el costo configurado y verifica", async () => {
	const record = await createPinRecord("9876");
	assert.ok(record.iterations >= 100000, "el costo por defecto debe ser alto");
	assert.equal(await verifyPin("9876", record), true);
});

test("verifyPin nunca lanza y rechaza registros inválidos", async () => {
	assert.equal(await verifyPin("1234", undefined), false);
	assert.equal(await verifyPin("1234", {}), false);
	assert.equal(await verifyPin("1234", { algorithm: "plain", salt: "x", hash: "y", iterations: 1000 }), false);
	assert.equal(await verifyPin("1234", { algorithm: "PBKDF2-SHA256", salt: "no-base64!", hash: "x", iterations: 1000 }), false);
});

test("isPinRecord valida la forma del registro", async () => {
	const record = await createPinRecord("1234", { iterations: 1000 });
	assert.equal(isPinRecord(record), true);
	for (const invalid of [undefined, null, {}, "1234", { ...record, algorithm: "md5" }, { ...record, hash: 42 }]) {
		assert.equal(isPinRecord(invalid), false);
	}
});
