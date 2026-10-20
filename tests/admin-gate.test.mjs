import assert from "node:assert/strict";
import { test } from "node:test";

import { createAdminGate, decideAdminAccess } from "../src/core/admin-gate.js";

test("decideAdminAccess pide configuración cuando todavía no hay PIN", () => {
	assert.equal(decideAdminAccess({ hasPin: false, unlocked: false }), "setup");
	assert.equal(decideAdminAccess({ hasPin: false, unlocked: true }), "setup");
});

test("decideAdminAccess pide el PIN al volver desde la portada", () => {
	assert.equal(decideAdminAccess({ hasPin: true, unlocked: false }), "unlock");
});

test("decideAdminAccess abre el panel sin volver a pedir el PIN", () => {
	assert.equal(decideAdminAccess({ hasPin: true, unlocked: true }), "admin");
});

test("createAdminGate arranca bloqueado y responde a unlock/lock", () => {
	const gate = createAdminGate();
	assert.equal(gate.isUnlocked(), false);
	gate.unlock();
	assert.equal(gate.isUnlocked(), true);
	gate.lock();
	assert.equal(gate.isUnlocked(), false);
});

test("createAdminGate expone el paso de acceso correspondiente", async () => {
	const gate = createAdminGate();
	assert.equal(await gate.step(true), "unlock");
	gate.unlock();
	assert.equal(await gate.step(true), "admin");
	gate.lock();
	assert.equal(await gate.step(false), "setup");
});
