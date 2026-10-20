import assert from "node:assert/strict";
import { test } from "node:test";

import { canHonorVerification, shouldOfferRecoveryFile } from "../src/core/admin-gate.js";

const ADMIN = { name: "admin", params: { section: "sopa" } };
const HOME = { name: "home", params: {} };
const GAME = { name: "game", params: { game: "sopa" } };

test("una verificación vigente dentro del panel autoriza el desbloqueo", () => {
	assert.equal(canHonorVerification({ startedAt: 7, current: 7, route: ADMIN }), true);
});

test("una verificación vieja no autoriza nada aunque se vuelva al panel", () => {
	assert.equal(canHonorVerification({ startedAt: 7, current: 8, route: ADMIN }), false);
});

test("una verificación no autoriza el desbloqueo fuera del panel", () => {
	assert.equal(canHonorVerification({ startedAt: 7, current: 7, route: HOME }), false);
	assert.equal(canHonorVerification({ startedAt: 7, current: 7, route: GAME }), false);
	assert.equal(canHonorVerification({ startedAt: 7, current: 7, route: undefined }), false);
});

test("navegar fuera y volver dentro de la misma verificación no habilita el panel", () => {
	// Leave and return bumps the generation twice; the stale completion must lose.
	assert.equal(canHonorVerification({ startedAt: 7, current: 9, route: ADMIN }), false);
});

// Offering the freshly generated recovery file is a different decision from unlocking:
// the previous file stops working the moment the PIN changes, so the moderator must be
// told whenever they are still inside the unlocked panel, even if a section navigation
// during the hash made the unlock itself stale.
test("el archivo nuevo se ofrece solo dentro del panel desbloqueado", () => {
	assert.equal(shouldOfferRecoveryFile({ unlocked: true, route: ADMIN }), true);
	assert.equal(shouldOfferRecoveryFile({ unlocked: true, route: HOME }), false);
	assert.equal(shouldOfferRecoveryFile({ unlocked: false, route: ADMIN }), false);
	assert.equal(shouldOfferRecoveryFile({ unlocked: false, route: HOME }), false);
	assert.equal(shouldOfferRecoveryFile({ unlocked: true, route: undefined }), false);
});
