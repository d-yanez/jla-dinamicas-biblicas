import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_VOLUME, normalizeVolume, planForEvent } from "../src/core/audio-plan.js";

test("el volumen por defecto es 30 % y se recorta al rango usable", () => {
	assert.equal(DEFAULT_VOLUME, 0.3);
	assert.equal(normalizeVolume(0.75), 0.75);
	assert.equal(normalizeVolume(2), 1);
	assert.equal(normalizeVolume(-1), 0);
	assert.equal(normalizeVolume("ruidoso"), 0.3);
	assert.equal(normalizeVolume(undefined), 0.3);
});

test("cada evento del motor produce el sonido que corresponde", () => {
	assert.deepEqual(planForEvent({ type: "round-start" }), [{ sound: "bell", kind: "start" }]);
	assert.deepEqual(planForEvent({ type: "extra-start" }), [{ sound: "bell", kind: "start" }]);
	assert.deepEqual(planForEvent({ type: "time-up" }), [{ sound: "bell", kind: "end" }]);
	assert.deepEqual(planForEvent({ type: "reveal" }), [{ sound: "reveal" }], "revelar tiene su propio sonido");
	assert.deepEqual(planForEvent({ type: "desconocido" }), []);
	assert.deepEqual(planForEvent(null), []);
});

test("el tic se vuelve más intenso al acercarse el cero", () => {
	const intensity = (secondsLeft) => planForEvent({ type: "tick", secondsLeft })[0].intensity;
	assert.equal(intensity(5), 0);
	assert.equal(intensity(4), 1);
	assert.equal(intensity(1), 4);
	assert.equal(intensity(0), 4, "no se pasa del máximo");
	assert.equal(intensity(9), 0, "fuera de la ventana queda suave");
});
