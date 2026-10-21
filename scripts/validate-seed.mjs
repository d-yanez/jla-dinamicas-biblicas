#!/usr/bin/env node
// Validates the optional bundled configuration before a deploy.
//
//   node scripts/validate-seed.mjs [ruta]
//
// There is no server, so a command line cannot write a browser's IndexedDB: the import
// itself happens in the app. What this script can do is prove the file is a real backup,
// that every activity passes the same validation the editor uses, and that at most one
// activity per game is published.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateActivity } from "../src/core/activity-model.js";
import { parseBackup } from "../src/core/backup.js";

const path = resolve(process.argv[2] ?? "assets/configuracion-inicial.json");

let text;
try {
	text = await readFile(path, "utf8");
} catch {
	console.log(`Sin configuración inicial en ${path}: la app usará los ejemplos de demostración.`);
	process.exit(0);
}

const parsed = parseBackup(text);
if (!parsed.ok) {
	console.error(`Inválido: ${parsed.error}`);
	process.exit(1);
}

const problems = [];
const publishedPerGame = new Map();
for (const raw of parsed.backup.activities) {
	const result = validateActivity(raw);
	const name = typeof raw?.name === "string" && raw.name.length > 0 ? raw.name : "(sin nombre)";
	if (!result.ok) {
		problems.push(`${name}: ${result.errors.map((error) => error.message).join(" · ")}`);
		continue;
	}
	if (raw.status === "published") publishedPerGame.set(raw.type, (publishedPerGame.get(raw.type) ?? 0) + 1);
}
for (const [game, count] of publishedPerGame) {
	if (count > 1) problems.push(`${game}: hay ${count} actividades publicadas y solo puede haber una por juego.`);
}

if (problems.length > 0) {
	console.error(`La configuración inicial tiene ${problems.length} problema(s):`);
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}

console.log(`Configuración inicial válida: ${parsed.backup.activities.length} actividades.`);
for (const raw of parsed.backup.activities) {
	console.log(`  - ${raw.name} (${raw.type}, ${raw.status})`);
}
for (const [game, count] of publishedPerGame) console.log(`  publicada de ${game}: ${count}`);
console.log(`Exportada el ${parsed.backup.exportedAt ?? "(sin fecha)"}; se aplica solo a un navegador sin datos.`);
