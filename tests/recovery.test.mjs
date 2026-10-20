import assert from "node:assert/strict";
import { test } from "node:test";

import {
	RECOVERY_KIND,
	RECOVERY_VERSION,
	buildRecoveryFile,
	createRecoveryKey,
	matchesRecoveryIdentity,
	parseRecoveryFile,
	recoveryFileName,
} from "../src/core/recovery.js";

const identity = {
	installationId: "8f14e45f-ceea-467a-9d0a-1a2b3c4d5e6f",
	recoveryKey: createRecoveryKey(),
	createdAt: "2026-10-19T22:10:00.000Z",
	appVersion: "0.1.0",
};

test("createRecoveryKey genera claves distintas y seguras para URL", () => {
	const keys = new Set(Array.from({ length: 20 }, () => createRecoveryKey()));
	assert.equal(keys.size, 20);
	for (const key of keys) {
		assert.match(key, /^[A-Za-z0-9_-]{43}$/);
	}
});

test("buildRecoveryFile + parseRecoveryFile hacen roundtrip", () => {
	const file = buildRecoveryFile(identity);
	assert.equal(file.kind, RECOVERY_KIND);
	assert.equal(file.version, RECOVERY_VERSION);
	const parsed = parseRecoveryFile(JSON.stringify(file, null, 2));
	assert.equal(parsed.ok, true);
	assert.deepEqual(parsed.file, file);
});

test("buildRecoveryFile rechaza identidades incompletas", () => {
	for (const broken of [
		{ ...identity, installationId: "" },
		{ ...identity, recoveryKey: undefined },
		{ ...identity, createdAt: "" },
	]) {
		assert.throws(() => buildRecoveryFile(broken), Error);
	}
});

test("parseRecoveryFile rechaza archivos que no son de recuperación", () => {
	const cases = [
		["", "El archivo está vacío."],
		["no es json", "El archivo no es JSON válido."],
		["[]", "El archivo no es un archivo de recuperación de JLA."],
		[JSON.stringify({ kind: "otra-cosa", version: 1 }), "El archivo no es un archivo de recuperación de JLA."],
		[JSON.stringify({ kind: RECOVERY_KIND, version: 99 }), "El archivo no es un archivo de recuperación de JLA."],
		[JSON.stringify({ kind: RECOVERY_KIND, version: RECOVERY_VERSION }), "El archivo de recuperación está incompleto."],
		[
			JSON.stringify({ kind: RECOVERY_KIND, version: RECOVERY_VERSION, installationId: "x" }),
			"El archivo de recuperación está incompleto.",
		],
	];
	for (const [text, error] of cases) {
		const parsed = parseRecoveryFile(text);
		assert.equal(parsed.ok, false, `debe rechazar ${text.slice(0, 40)}`);
		assert.equal(parsed.error, error);
	}
});

test("matchesRecoveryIdentity exige dispositivo y clave coincidentes", () => {
	const file = buildRecoveryFile(identity);
	assert.equal(matchesRecoveryIdentity(file, identity), true);
	assert.equal(matchesRecoveryIdentity(file, { ...identity, recoveryKey: createRecoveryKey() }), false);
	assert.equal(matchesRecoveryIdentity(file, { ...identity, installationId: "otro" }), false);
	assert.equal(matchesRecoveryIdentity(file, undefined), false);
	assert.equal(matchesRecoveryIdentity(undefined, identity), false);
});

test("recoveryFileName es estable y sin caracteres problemáticos", () => {
	assert.equal(recoveryFileName(new Date("2026-10-19T22:10:00.000Z")), "jla-recuperacion-pin-2026-10-19.json");
});
