#!/usr/bin/env node
// Tells which version is actually published and whether it matches this working copy.
//
//   node scripts/check-deployed.mjs
//
// Without a build step there are two facts to check, and they are not the same: the
// commit GitHub Pages built (the builds API) and the files it currently serves. The build
// can take a minute after the push, so "deployment exists" does not mean "the site already
// serves it". version.json, shown in the app footer, confirms it from the other side.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { formatVersion } from "../src/core/version.js";

const REPO = process.env.JLA_REPO ?? "d-yanez/jla-dinamicas-biblicas";

function run(file, args) {
	try {
		return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
	} catch {
		return undefined;
	}
}

async function readVersion() {
	let text;
	try {
		text = await readFile("version.json", "utf8");
	} catch {
		return undefined;
	}
	try {
		const parsed = JSON.parse(text);
		return typeof parsed?.version === "string" ? parsed.version : undefined;
	} catch {
		return undefined;
	}
}

const version = await readVersion();
const local = run("git", ["rev-parse", "--short", "HEAD"]);
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
const dirty = (run("git", ["status", "--porcelain"]) ?? "").length > 0;
let exitCode = 0;

console.log(`Versión en el árbol: ${formatVersion(version) || version || "desconocida"}`);

if (!local) {
	console.log("No se pudo leer git: ¿este directorio es un repositorio?");
	process.exit(1);
}
console.log(`Rama: ${branch} · HEAD: ${local}${dirty ? " (con cambios sin commitear)" : ""}`);

if (dirty) {
	console.log("");
	console.log("Hay cambios sin commitear: lo que se juega en la sala no los incluye.");
	exitCode = 1;
}

const latestBuild = run("gh", ["api", `/repos/${REPO}/pages/builds`, "--jq", '.[0] | .status + " " + .commit']);
if (!latestBuild) {
	console.log("No se pudo consultar GitHub (¿gh sin sesión?). Se informa solo el estado local.");
	process.exit(exitCode);
}

const [status, builtCommit] = latestBuild.split(" ");
const builtSha = (builtCommit ?? "").slice(0, 7);
console.log(`Último build de Pages: ${status} · ${builtSha}`);

if (status === "building") {
	console.log("");
	console.log("El build está en curso: el sitio todavía sirve el commit anterior. Esperá un minuto y volvé a correr.");
	exitCode = 1;
} else if (status === "errored") {
	console.log("");
	console.log("El build de Pages falló. Revisá el detalle en gh api /repos/" + REPO + "/pages/builds");
	exitCode = 1;
} else if (builtSha !== local) {
	console.log("");
	console.log("ATENCIÓN: lo publicado no es este commit. Hacé commit y push, esperá el build y volvé a correr.");
	exitCode = 1;
}

process.exit(exitCode);
