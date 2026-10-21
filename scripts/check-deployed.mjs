#!/usr/bin/env node
// Tells which version is actually published and whether it matches this working copy.
//
//   node scripts/check-deployed.mjs
//
// Without a build step the only honest marker of "what is deployed" is the commit that
// GitHub Pages built, compared with HEAD. version.json, shown inside the app, confirms it
// from the other side: if the footer says v0.6.0 and this says 0.6.0, they match.

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

console.log(`Versión en el árbol: ${formatVersion(version) || version || "desconocida"}`);

if (!local) {
	console.log("No se pudo leer git: ¿este directorio es un repositorio?");
	process.exitCode = 1;
} else {
	console.log(`Rama: ${branch} · HEAD: ${local}${dirty ? " (con cambios sin commitear)" : ""}`);
	const deployedRaw = run("gh", ["api", `/repos/${REPO}/deployments`, "--jq", ".[0].sha"]);
	const deployed = deployedRaw ? deployedRaw.slice(0, 7) : undefined;
	if (!deployed) {
		console.log("No se pudo consultar GitHub (¿gh sin sesión?). Se informa solo el estado local.");
		if (dirty) process.exitCode = 1;
	} else {
		console.log(`Publicado en Pages: ${deployed}`);
		if (deployed !== local) {
			console.log("");
			console.log("ATENCIÓN: lo publicado no es este commit. Hacé commit y push, esperá el deploy y volvé a correr este script.");
			process.exitCode = 1;
		} else if (dirty) {
			console.log("");
			console.log("Hay cambios sin commitear: lo que se juega en la sala no los incluye.");
			process.exitCode = 1;
		}
	}
}
