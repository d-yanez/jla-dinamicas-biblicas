import assert from "node:assert/strict";
import { test } from "node:test";

import { INSTRUCTION_TEMPLATES, defaultInstructionsFor, renderInstructions } from "../src/core/instructions.js";

test("cada juego tiene su plantilla con la duración como marcador", () => {
	for (const type of ["sopa", "palabras"]) {
		const template = INSTRUCTION_TEMPLATES[type];
		assert.equal(typeof template, "string");
		assert.ok(template.includes("{{duracion}}"), `${type} debe interpolar la duración`);
	}
	assert.notEqual(INSTRUCTION_TEMPLATES.sopa, INSTRUCTION_TEMPLATES.palabras);
	assert.equal(defaultInstructionsFor("sopa"), INSTRUCTION_TEMPLATES.sopa);
	assert.equal(defaultInstructionsFor("desconocido"), "");
});

test("renderInstructions interpola la duración configurada", () => {
	const rendered = renderInstructions({ type: "sopa", instructions: "Tienen {{duracion}} por ronda.", roundSeconds: 30 });
	assert.equal(rendered, "Tienen 30 segundos por ronda.");
	assert.equal(
		renderInstructions({ type: "sopa", instructions: "Tienen {{duracion}}.", roundSeconds: 45 }),
		"Tienen 45 segundos.",
	);
});

test("renderInstructions no deja marcadores sin resolver", () => {
	const rendered = renderInstructions({ type: "sopa", instructions: INSTRUCTION_TEMPLATES.sopa, roundSeconds: 60 });
	assert.equal(rendered.includes("{{duracion}}"), false);
	assert.ok(rendered.includes("60 segundos"));
});

test("renderInstructions respeta un texto propio sin marcadores", () => {
	const custom = "Busquen las palabras en parejas.";
	assert.equal(renderInstructions({ type: "sopa", instructions: custom, roundSeconds: 30 }), custom);
});

test("renderInstructions tolera texto vacío o inválido", () => {
	assert.equal(renderInstructions({ type: "sopa", instructions: "", roundSeconds: 30 }), "");
	assert.equal(renderInstructions({ type: "sopa", instructions: undefined, roundSeconds: 30 }), "");
	assert.equal(renderInstructions(undefined), "");
});
