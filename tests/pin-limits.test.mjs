import assert from "node:assert/strict";
import { test } from "node:test";

import { PIN_MAX_ITERATIONS, createPinRecord, isPinRecord, verifyPin } from "../src/core/pin.js";

test("el costo de un registro tiene un techo explícito", () => {
	assert.equal(PIN_MAX_ITERATIONS, 1_000_000);
});

test("isPinRecord rechaza un costo absurdo en vez de derivarlo", async () => {
	const record = await createPinRecord("1234", { iterations: 1000 });
	assert.equal(isPinRecord({ ...record, iterations: PIN_MAX_ITERATIONS }), true);
	assert.equal(isPinRecord({ ...record, iterations: PIN_MAX_ITERATIONS + 1 }), false);
	assert.equal(isPinRecord({ ...record, iterations: Number.MAX_SAFE_INTEGER }), false);
	assert.equal(isPinRecord({ ...record, iterations: 0 }), false);
	assert.equal(isPinRecord({ ...record, iterations: 1.5 }), false);
});

test("un registro manipulado con costo enorme se rechaza sin colgarse", async () => {
	const record = await createPinRecord("1234", { iterations: 1000 });
	const startedAt = Date.now();
	assert.equal(await verifyPin("1234", { ...record, iterations: 5_000_000_000 }), false);
	const elapsed = Date.now() - startedAt;
	assert.ok(elapsed < 1000, `la verificación no debe derivar con un costo absurdo (tardó ${elapsed}ms)`);
});
