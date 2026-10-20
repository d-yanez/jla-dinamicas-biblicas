#!/usr/bin/env node
// End-to-end check for phase 1 in a real browser.
//
// The application itself has zero dependencies. This script uses Playwright only as
// a developer tool; it is optional and never shipped to GitHub Pages.
//
//   node tests/browser-smoke.mjs
//
// It starts its own static server, drives the full phase-1 flow (home, Jugar without
// a published activity, PIN setup, recovery download, preferences, reload, wrong and
// correct PIN, lock, recovery import with a new PIN) and fails on any page error.
//
// Against the deployed site, point it at GitHub Pages instead of a local server:
//   JLA_BASE_URL=https://usuario.github.io/repo/ node tests/browser-smoke.mjs

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".json": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json",
	".png": "image/png",
	".woff2": "font/woff2",
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
};

let chromium;
try {
	({ chromium } = await import("playwright"));
} catch {
	console.error("Playwright no está disponible. Es una herramienta de desarrollo opcional; instalala con: npm i -g playwright && playwright install chromium");
	process.exitCode = 2;
	process.exit();
}

function startStaticServer() {
	const server = createServer(async (request, response) => {
		try {
			const url = new URL(request.url, "http://127.0.0.1");
			const requested = decodeURIComponent(url.pathname);
			const candidate = requested === "/" || requested === "" ? "/index.html" : requested;
			const filePath = normalize(join(ROOT, candidate));
			if (!filePath.startsWith(ROOT + sep) && filePath !== join(ROOT, "index.html")) {
				response.writeHead(403).end("Forbidden");
				return;
			}
			const body = await readFile(filePath);
			response.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
			response.end(body);
		} catch {
			response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("No encontrado");
		}
	});
	return new Promise((resolveServer) => {
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			resolveServer({ server, baseUrl: `http://127.0.0.1:${port}` });
		});
	});
}

const checks = [];
async function step(name, run) {
	await run();
	checks.push(name);
	console.log(`ok - ${name}`);
}

const { server, baseUrl } = process.env.JLA_BASE_URL
	? { server: undefined, baseUrl: process.env.JLA_BASE_URL }
	: await startStaticServer();
const browser = await chromium.launch();
const problems = [];

try {
	const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
	const page = await context.newPage();
	page.on("console", (message) => {
		if (message.type() === "error") problems.push(`console: ${message.text()}`);
	});
	page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

	const pinInputs = () => page.locator('input[inputmode="numeric"]');
	const enterAdmin = async () => page.getByRole("link", { name: "Administrar" }).click();

	await step("la portada muestra dos tarjetas Jugar y el engranaje discreto", async () => {
		await page.goto(baseUrl);
		await page.getByRole("heading", { name: "JLA Dinámicas Bíblicas" }).waitFor();
		assert.equal(await page.locator(".game-card").count(), 2);
		assert.equal(await page.getByRole("link", { name: "Jugar" }).count(), 2);
		assert.equal(await page.getByText("Sin actividad publicada").count(), 2);
		assert.equal(await page.getByRole("link", { name: "Administrar" }).isVisible(), true);
	});

	await step("Jugar sin actividad publicada informa y ofrece volver al inicio", async () => {
		await page.getByRole("link", { name: "Jugar" }).first().click();
		await page.getByRole("heading", { name: "No hay actividad publicada de Sopa de letras" }).waitFor();
		assert.equal(new URL(page.url()).hash, "#/juego/sopa");
		await page.getByRole("link", { name: "Volver al inicio" }).click();
		await page.getByRole("heading", { name: "JLA Dinámicas Bíblicas" }).waitFor();
	});

	await step("el primer acceso al panel pide crear y confirmar el PIN", async () => {
		await enterAdmin();
		await page.getByRole("heading", { name: "Configurar el PIN de administración" }).waitFor();
		assert.equal(await pinInputs().count(), 2);
	});

	await step("el PIN se rechaza si los dos campos no coinciden", async () => {
		await pinInputs().nth(0).fill("1234");
		await pinInputs().nth(1).fill("1235");
		await page.getByRole("button", { name: "Crear PIN y continuar" }).click();
		await page.getByRole("alert").waitFor();
		assert.match(await page.getByRole("alert").textContent(), /no coinciden/u);
	});

	await step("crear el PIN abre el panel y ofrece el archivo de recuperación", async () => {
		await pinInputs().nth(1).fill("1234");
		await page.getByRole("button", { name: "Crear PIN y continuar" }).click();
		await page.getByRole("heading", { name: "Guardá el archivo de recuperación" }).waitFor();
	});

	let recoveryPath;
	let recoveryFile;
	await step("el archivo de recuperación se descarga y tiene el formato esperado", async () => {
		const downloadPromise = page.waitForEvent("download");
		await page.getByRole("button", { name: "Descargar archivo" }).click();
		const download = await downloadPromise;
		assert.match(download.suggestedFilename(), /^jla-recuperacion-pin-\d{4}-\d{2}-\d{2}\.json$/u);
		recoveryPath = await download.path();
		recoveryFile = JSON.parse(await readFile(recoveryPath, "utf8"));
		assert.equal(recoveryFile.kind, "jla.pin-recovery");
		assert.equal(recoveryFile.version, 1);
		assert.match(recoveryFile.installationId, /^[0-9a-f-]{36}$/u);
		assert.match(recoveryFile.recoveryKey, /^[A-Za-z0-9_-]{43}$/u);
		assert.equal("pin" in recoveryFile, false, "el archivo no debe contener el PIN");
		await page.getByRole("button", { name: "Listo" }).click();
		await page.getByRole("heading", { name: "Guardá el archivo de recuperación" }).waitFor({ state: "hidden" });
	});

	await step("el panel tiene las tres secciones y abre Configuración general", async () => {
		await page.getByRole("heading", { name: "Sopa de letras", exact: true }).waitFor();
		assert.equal(await page.locator(".admin-nav__link").count(), 3);
		await page.getByRole("link", { name: "Configuración general" }).click();
		await page.getByRole("heading", { name: "Apariencia", exact: true }).waitFor();
		await page.getByRole("heading", { name: "Seguridad", exact: true }).waitFor();
		await page.getByRole("heading", { name: "Datos y respaldo" }).waitFor();
		assert.match(await page.locator(".notice--warn").textContent(), /Los datos viven en este navegador/u);
	});

	await step("las preferencias de tamaño y contraste se aplican al documento", async () => {
		await page.getByRole("radio", { name: "Normal" }).check();
		await page.locator("#toggle-contrast").check();
		assert.equal(await page.locator("html").getAttribute("data-size"), "normal");
		assert.equal(await page.locator("html").getAttribute("data-contrast"), "alto");
	});

	await step("tras recargar se conservan las preferencias y se vuelve a pedir el PIN", async () => {
		await page.reload();
		await page.getByRole("heading", { name: "Panel de administración" }).waitFor();
		assert.equal(await page.locator("html").getAttribute("data-size"), "normal");
		assert.equal(await page.locator("html").getAttribute("data-contrast"), "alto");
	});

	await step("un PIN incorrecto se rechaza y el correcto abre el panel", async () => {
		await pinInputs().first().fill("9999");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("alert").waitFor();
		assert.match(await page.getByRole("alert").textContent(), /PIN incorrecto/u);
		await pinInputs().first().fill("1234");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("heading", { name: "Configuración general" }).waitFor();
	});

	await step("cerrar sesión vuelve a la portada y el próximo ingreso pide el PIN", async () => {
		await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
		await page.getByRole("heading", { name: "JLA Dinámicas Bíblicas" }).waitFor();
		assert.equal(new URL(page.url()).hash, "#/");
		await enterAdmin();
		await page.getByRole("heading", { name: "Panel de administración" }).waitFor();
		assert.equal(await pinInputs().count(), 1, "debe pedir el PIN, no la configuración inicial");
	});

	await step("el archivo de recuperación permite definir un PIN nuevo", async () => {
		await pinInputs().first().fill("1234");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("heading", { name: "Sopa de letras", exact: true }).waitFor();
		await page.getByRole("link", { name: "Configuración general" }).click();
		await page.getByRole("button", { name: "Importar" }).click();
		await page.getByRole("heading", { name: "Archivo de recuperación de PIN" }).waitFor();
		await page.setInputFiles('dialog input[type="file"]', recoveryPath);
		await page.getByRole("button", { name: "Verificar archivo" }).click();
		const dialogPins = page.locator('dialog input[inputmode="numeric"]');
		await dialogPins.nth(0).waitFor();
		await dialogPins.nth(0).fill("5678");
		await dialogPins.nth(1).fill("5678");
		await page.getByRole("button", { name: "Guardar PIN nuevo" }).click();
		await page.getByRole("heading", { name: "Guardá el archivo de recuperación" }).waitFor();
		await page.getByRole("button", { name: "Listo" }).click();
		await page.getByRole("button", { name: "Continuar igual" }).click();
		await page.getByRole("heading", { name: "Guardá el archivo de recuperación" }).waitFor({ state: "hidden" });
	});

	await step("el PIN viejo deja de servir y el nuevo abre el panel", async () => {
		await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
		await page.getByRole("heading", { name: "JLA Dinámicas Bíblicas" }).waitFor();
		await enterAdmin();
		await pinInputs().first().fill("1234");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("alert").waitFor();
		assert.match(await page.getByRole("alert").textContent(), /PIN incorrecto/u);
		await pinInputs().first().fill("5678");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("heading", { name: "Sopa de letras", exact: true }).waitFor();
	});

	await step("un archivo de recuperación de otro dispositivo se rechaza", async () => {
		const foreign = { ...recoveryFile, recoveryKey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" };
		const foreignPath = join(ROOT, "tests", ".foreign-recovery.json");
		const { writeFile, unlink } = await import("node:fs/promises");
		await writeFile(foreignPath, JSON.stringify(foreign), "utf8");
		try {
			await page.getByRole("link", { name: "Configuración general" }).click();
			await page.getByRole("button", { name: "Importar" }).click();
			await page.getByRole("heading", { name: "Archivo de recuperación de PIN" }).waitFor();
			await page.setInputFiles('dialog input[type="file"]', foreignPath);
			await page.getByRole("button", { name: "Verificar archivo" }).click();
			const alert = page.locator("dialog .form-error");
			await alert.waitFor();
			assert.match(await alert.textContent(), /no corresponde a este dispositivo/u);
			await page.getByRole("button", { name: "Cancelar" }).click();
		} finally {
			await unlink(foreignPath).catch(() => {});
		}
	});

	await step("el ejemplo de sopa aparece como borrador con cuadrícula aprobada", async () => {
		await page.getByRole("link", { name: "Sopa de letras", exact: true }).click();
		await page.getByRole("heading", { name: "Actividades de sopa de letras" }).waitFor();
		const row = page.locator(".activity-row").filter({ hasText: "Sopa de letras: Ayuno y oración" });
		await row.waitFor();
		const rowText = await row.textContent();
		assert.match(rowText, /Borrador/u);
		assert.match(rowText, /10 palabras/u);
		assert.match(rowText, /· cuadrícula aprobada/u, "el ejemplo debe traer una cuadrícula aprobada");
	});

	await step("el editor muestra diez palabras y una cuadrícula de 400 celdas", async () => {
		await page.getByRole("button", { name: "Abrir" }).first().click();
		await page.getByRole("heading", { name: "Sopa de letras: Ayuno y oración" }).waitFor();
		assert.equal(await page.locator('input[aria-label^="Palabra "]').count(), 10);
		assert.equal(await page.locator(".sopa-grid__cell").count(), 400);
		assert.equal(await page.getByRole("button", { name: /Variante 1/u }).count(), 1);
		assert.match(await page.locator(".variant-strip").textContent(), /Aprobada/u);
	});

	await step("ver la solución colorea las palabras y lista sus coordenadas", async () => {
		await page.getByRole("button", { name: "Ver solución" }).click();
		assert.ok((await page.locator(".sopa-grid__cell--solved").count()) >= 10, "debe colorear las celdas de las diez palabras");
		assert.equal(await page.locator(".solution-table tbody tr").count(), 10);
		assert.match(await page.locator(".solution-table tbody").textContent(), /(horizontal|vertical|diagonal)/u);
		await page.getByRole("button", { name: "Ocultar solución" }).click();
		assert.equal(await page.locator(".sopa-grid__cell--solved").count(), 0);
	});

	await step("los requisitos de publicación se verifican con mensajes concretos", async () => {
		await page.getByRole("button", { name: "Verificar requisitos" }).click();
		await page.getByText("La actividad cumple todos los requisitos", { exact: false }).waitFor();
	});

	await step("cambiar una palabra descarta las variantes y lo avisa", async () => {
		await page.locator('input[aria-label="Palabra 1"]').fill("Ayunos");
		await page.getByText("Las palabras cambiaron", { exact: false }).waitFor({ timeout: 5000 });
		assert.equal(await page.locator(".variant-strip").count(), 0);
	});

	await step("generar variantes produce tres cuadrículas y se puede aprobar una", async () => {
		await page.getByRole("button", { name: "Generar variantes" }).click();
		await page.getByRole("button", { name: /Variante 3/u }).waitFor();
		assert.equal(await page.locator(".sopa-grid__cell").count(), 400);
		await page.getByRole("button", { name: "Aprobar esta variante" }).click();
		await page.locator(".variant-strip").getByText("Aprobada", { exact: true }).waitFor();
	});

	await step("el borrador persiste tras recargar con su palabra y su variante aprobada", async () => {
		await page.reload();
		await page.getByRole("heading", { name: "Panel de administración" }).waitFor();
		await page.locator('input[inputmode="numeric"]').first().fill("5678");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("button", { name: "Abrir" }).first().click();
		await page.getByRole("heading", { name: "Sopa de letras: Ayuno y oración" }).waitFor();
		assert.equal(await page.locator('input[aria-label="Palabra 1"]').inputValue(), "Ayunos");
		assert.match(await page.locator(".variant-strip").textContent(), /Aprobada/u);
		assert.equal(await page.locator(".sopa-grid__cell").count(), 400);
	});

	await step("en móvil no hay desborde horizontal y las tarjetas se apilan", async () => {
		const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
		const mobilePage = await mobileContext.newPage();
		await mobilePage.goto(baseUrl);
		await mobilePage.getByRole("heading", { name: "JLA Dinámicas Bíblicas" }).waitFor();
		const overflow = await mobilePage.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		assert.ok(overflow <= 0, `desborde horizontal de ${overflow}px`);
		const tops = await mobilePage.locator(".game-card").evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().top));
		assert.ok(tops[1] > tops[0], "las tarjetas deben apilarse en vertical");
		await mobileContext.close();
	});

	assert.deepEqual(problems, [], `la consola del navegador reportó errores: ${problems.join(" | ")}`);
	console.log(`\n${checks.length} verificaciones de navegador OK`);
} finally {
	await browser.close();
	if (server) await new Promise((done) => server.close(done));
}
