#!/usr/bin/env node
// Verifies the bundled configuration: a browser with no data must open with the
// activities the repository ships, already published, and be able to play.
//
//   node tests/seed-smoke.mjs                      # servidor local
//   JLA_BASE_URL=https://... node tests/seed-smoke.mjs
//
// The other suite hides the seed on purpose; this one is the only place the real file is
// exercised end to end.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".json": "application/json; charset=utf-8",
};

let chromium;
try {
	({ chromium } = await import("playwright"));
} catch {
	console.error("Playwright no está disponible; es una herramienta de desarrollo opcional.");
	process.exitCode = 2;
	process.exit();
}

let server;
let baseUrl = process.env.JLA_BASE_URL;
if (!baseUrl) {
	server = createServer(async (request, response) => {
		const url = new URL(request.url, "http://127.0.0.1");
		const candidate = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
		const filePath = normalize(join(ROOT, candidate));
		if (!filePath.startsWith(ROOT + sep)) {
			response.writeHead(403).end("Forbidden");
			return;
		}
		try {
			const body = await readFile(filePath);
			response.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" }).end(body);
		} catch {
			response.writeHead(404).end("No encontrado");
		}
	});
	baseUrl = await new Promise((done) => server.listen(0, "127.0.0.1", () => done(`http://127.0.0.1:${server.address().port}`)));
}

const expected = JSON.parse(await readFile(join(ROOT, "assets", "configuracion-inicial.json"), "utf8")).activities;
const browser = await chromium.launch();
const problems = [];
const checks = [];
const step = async (name, run) => {
	await run();
	checks.push(name);
	console.log(`ok - ${name}`);
};

try {
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const page = await context.newPage();
	page.on("console", (message) => {
		if (message.type() === "error") problems.push(`console: ${message.text()}`);
	});
	page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

	await step("un navegador sin datos carga la configuración del repositorio", async () => {
		await page.goto(baseUrl);
		await page.getByRole("heading", { name: "JLA Dinámicas Bíblicas" }).waitFor();
		const stored = await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open("jla-dinamicas");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const all = db.transaction("activities", "readonly").objectStore("activities").getAll();
			const rows = await new Promise((resolve) => {
				all.onsuccess = () => resolve(all.result);
			});
			return rows.map((row) => ({ name: row.name, type: row.type, status: row.status }));
		});
		assert.equal(stored.length, expected.length, `deben cargarse ${expected.length} actividades`);
		for (const item of expected) {
			assert.ok(
				stored.some((row) => row.name === item.name && row.type === item.type && row.status === item.status),
				`falta ${item.name} (${item.type}, ${item.status})`,
			);
		}
	});

	await step("la portada ofrece jugar los dos juegos publicados", async () => {
		for (const label of ["Sopa de letras", "Palabras desordenadas"]) {
			const card = page.locator(".game-card").filter({ hasText: label });
			assert.match(await card.textContent(), /Publicada/u, `${label} debe figurar publicada`);
		}
	});

	await step("la sopa publicada abre en la introducción con su cuadrícula", async () => {
		await page.locator(".game-card").filter({ hasText: "Sopa de letras" }).getByRole("link", { name: "Jugar" }).click();
		await page.getByRole("button", { name: "Mostrar palabra" }).waitFor({ timeout: 8000 });
		assert.equal(await page.locator(".sopa-grid__cell").count(), 400);
	});

	await step("las palabras publicadas arrancan su primera ronda", async () => {
		await page.getByRole("link", { name: /ir al inicio/u }).click();
		await page.locator(".game-card").filter({ hasText: "Palabras desordenadas" }).getByRole("link", { name: "Jugar" }).click();
		await page.getByRole("button", { name: "Mostrar palabra" }).click();
		await page.getByText(/^Ronda 1 de 10/u).waitFor({ timeout: 8000 });
		assert.match(await page.locator(".play-target").textContent(), /^[A-Z]+$/u, "la palabra desordenada se proyecta");
	});

	await step("restablecer vuelve a aplicar la configuración del repositorio", async () => {
		await page.goto(new URL("#/admin", baseUrl).href);
		await page.getByRole("heading", { name: "Configurar el PIN de administración" }).waitFor({ timeout: 8000 });
		await page.locator("input[inputmode=\"numeric\"]").nth(0).fill("1234");
		await page.locator("input[inputmode=\"numeric\"]").nth(1).fill("1234");
		await page.getByRole("button", { name: "Crear PIN y continuar" }).click();
		await page.getByRole("heading", { name: "Guardá el archivo de recuperación" }).waitFor();
		await page.getByRole("button", { name: "Listo" }).click();
		await page.getByRole("button", { name: "Continuar igual" }).click();
		await page.getByRole("link", { name: "Configuración general" }).click();
		await page.getByRole("button", { name: "Restablecer", exact: true }).click();
		await page.getByLabel("Escribí RESTABLECER para confirmar").fill("RESTABLECER");
		await page.locator("dialog").getByRole("button", { name: "Restablecer", exact: true }).click();
		await page.getByText(/se restablecieron \d+ actividades/u).waitFor();
		assert.match(await page.locator("dialog").innerText(), /\([1-9]\d* publicadas\)/u, "vuelve a haber publicadas");
	});

	assert.deepEqual(problems, [], `errores en la consola del navegador: ${problems.join(" | ")}`);
	console.log(`\n${checks.length} verificaciones de la configuración inicial OK`);
} finally {
	await browser.close();
	if (server) await new Promise((done) => server.close(done));
}
