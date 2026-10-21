#!/usr/bin/env node
// Bumps the app version in version.json.
//
//   node scripts/bump-version.mjs            # patch: 0.6.0 -> 0.6.1
//   node scripts/bump-version.mjs minor      # 0.6.1 -> 0.7.0
//   node scripts/bump-version.mjs major      # 0.7.0 -> 1.0.0
//
// A change that breaks the data format (backups, the bundled seed) bumps minor at least.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseVersion } from "../src/core/version.js";

function fail(message) {
	console.error(message);
	process.exit(1);
}

async function readVersionFile(path) {
	let text;
	try {
		text = await readFile(path, "utf8");
	} catch {
		fail(`No se pudo leer ${path}.`);
	}
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		fail(`${path} no es JSON válido.`);
	}
	if (typeof value !== "object" || value === null || parseVersion(value.version) === undefined) {
		fail(`${path} no tiene una versión semántica en "version".`);
	}
	return value;
}

const path = resolve("version.json");
const raw = await readVersionFile(path);
const [major, minor, patch] = raw.version.split(".").map(Number);
const kind = process.argv[2] ?? "patch";

const next =
	kind === "major"
		? `${major + 1}.0.0`
		: kind === "minor"
			? `${major}.${minor + 1}.0`
			: kind === "patch"
				? `${major}.${minor}.${patch + 1}`
				: undefined;

if (!next) fail(`Tipo desconocido: ${kind}. Usá patch, minor o major.`);

const updated = { ...raw, version: next, date: new Date().toISOString().slice(0, 10) };
try {
	await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
} catch {
	fail(`No se pudo escribir ${path}.`);
}
console.log(`Versión: ${raw.version} → ${next} (${updated.date})`);
console.log("Commit y push para publicarla; después: node scripts/check-deployed.mjs");
