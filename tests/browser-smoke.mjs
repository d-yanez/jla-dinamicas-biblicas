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

	await step("al cambiar una palabra se descartan las variantes y se avisa", async () => {
		await page.locator('input[aria-label="Palabra 1"]').fill("Ayunos");
		// Only the settled state is asserted here. The transient warning shown while typing
		// lasts until the 800 ms autosave lands, so asserting it would race the save; the
		// rule behind it (a grid that does not cover the words is stale) is unit-tested.
		await page
			.getByText("Las palabras cambiaron: las variantes anteriores se descartaron", { exact: false })
			.waitFor({ timeout: 8000 });
		assert.equal(await page.locator(".variant-strip").count(), 0);
		assert.equal(
			await page.getByText("cumple todos los requisitos", { exact: false }).count(),
			0,
			"un resultado viejo no debe quedar a la vista",
		);
	});

	await step("generar variantes produce tres cuadrículas y se puede aprobar una", async () => {
		await page.getByRole("button", { name: "Generar variantes" }).click();
		await page.getByRole("button", { name: /Variante 3/u }).waitFor();
		assert.equal(await page.locator(".sopa-grid__cell").count(), 400);
		await page.getByRole("button", { name: "Aprobar esta variante" }).click();
		await page.locator(".variant-strip").getByText("Aprobada", { exact: true }).waitFor();
	});

	await step("la cuadrícula regenerada ubica la palabra editada, no la anterior", async () => {
		await page.getByRole("button", { name: "Ver solución" }).click();
		await page.locator(".sopa-grid__cell--solved").first().waitFor();
		assert.ok(
			(await page.locator('.sopa-grid__cell[data-word="AYUNOS"]').count()) > 0,
			"la cuadrícula debe ubicar AYUNOS, la palabra editada",
		);
		assert.equal(
			await page.locator('.sopa-grid__cell[data-word="AYUNO"]').count(),
			0,
			"no debe quedar ubicada la palabra reemplazada",
		);
		await page.getByRole("button", { name: "Ocultar solución" }).click();
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

	await step("editar una palabra después de un autoguardado no se pierde", async () => {
		// Every save replaces the draft object; a handler bound to the old one writes into a
		// dead copy, so the second edit would silently disappear from the database.
		const savedAfter = async (previous) =>
			page.waitForFunction(
				(before) => {
					const node = document.querySelector(".save-indicator");
					return Boolean(node) && node.textContent.startsWith("Guardado") && node.textContent !== before;
				},
				previous,
				{ timeout: 8000 },
			);
		const input = page.locator('input[aria-label="Palabra 2"]');
		await input.fill("Oraciones");
		await savedAfter(await page.locator(".save-indicator").textContent());
		await input.fill("Oración");
		await savedAfter(await page.locator(".save-indicator").textContent());
		const stored = await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open("jla-dinamicas");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const tx = db.transaction("activities", "readonly");
			const all = tx.objectStore("activities").getAll();
			const rows = await new Promise((resolve) => {
				all.onsuccess = () => resolve(all.result);
			});
			return rows.find((row) => row.type === "sopa")?.game.words.map((word) => word.text) ?? [];
		});
		assert.deepEqual(stored.slice(0, 2), ["Ayunos", "Oración"], "la segunda edición debe persistir");
	});

	await step("el ejemplo de palabras desordenadas aparece como borrador con desempates", async () => {
		await page.getByRole("link", { name: "Palabras desordenadas", exact: true }).click();
		const row = page.locator(".activity-row").filter({ hasText: "Palabras desordenadas: Ayuno y oración" });
		await row.waitFor();
		const text = await row.textContent();
		assert.match(text, /Borrador/u);
		assert.match(text, /10 palabras/u);
		assert.match(text, /3 desempates/u);
	});

	await step("el editor muestra soluciones, anagramas, pistas y desempates válidos", async () => {
		await page.getByRole("button", { name: "Abrir" }).first().click();
		await page.getByRole("heading", { name: "Palabras desordenadas: Ayuno y oración" }).waitFor();
		assert.equal(await page.getByLabel(/^Solución \d+$/u).count(), 10);
		assert.equal(await page.getByLabel(/^Anagrama \d+$/u).count(), 10);
		assert.equal(await page.getByLabel(/^Respuesta del desempate \d+$/u).count(), 3);
		assert.ok((await page.locator('input[aria-label^="Pista "]').count()) >= 2, "el ejemplo trae pistas");
		assert.equal(await page.locator('.word-row__status[data-ok="true"]').count(), 13, "diez palabras y tres desempates válidos");
	});

	await step("un anagrama con letras de más se marca y se regenera", async () => {
		await page.locator('input[aria-label="Anagrama 1"]').fill("ORACIONX");
		await page.locator('.word-row__status[data-ok="false"]').first().waitFor();
		assert.match(await page.locator(".word-row__status--error").first().textContent(), /mismas letras/u);
		await page.getByRole("button", { name: "Regenerar anagrama 1", exact: true }).click();
		await page.locator('.word-row__status[data-ok="false"]').first().waitFor({ state: "detached" });
		assert.equal(await page.locator('.word-row__status[data-ok="true"]').count(), 13);
	});

	await step("los requisitos de palabras desordenadas se verifican", async () => {
		await page.getByRole("button", { name: "Verificar requisitos" }).click();
		await page.getByText("La actividad cumple todos los requisitos", { exact: false }).waitFor();
	});

	await step("el borrador de palabras desordenadas persiste tras recargar", async () => {
		await page.locator('input[aria-label="Pista 1 de la palabra 3"]').fill("Pista editada en la prueba");
		await page.getByText(/^Guardado/u).waitFor({ timeout: 5000 });
		await page.reload();
		await page.getByRole("heading", { name: "Panel de administración" }).waitFor();
		await page.locator('input[inputmode="numeric"]').first().fill("5678");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("link", { name: "Palabras desordenadas", exact: true }).click();
		await page.getByRole("button", { name: "Abrir" }).first().click();
		await page.getByRole("heading", { name: "Palabras desordenadas: Ayuno y oración" }).waitFor();
		assert.equal(await page.locator('input[aria-label="Pista 1 de la palabra 3"]').inputValue(), "Pista editada en la prueba");
	});

	await step("agregar una pista vacía la deja visible y se puede completar", async () => {
		await page.getByRole("button", { name: "Agregar pista a la palabra 1", exact: true }).click();
		const hint = page.locator('input[aria-label="Pista 1 de la palabra 1"]');
		await hint.waitFor({ timeout: 3000 });
		await hint.fill("Se hace con el corazón atento");
	});

	await step("editar una pista después de un autoguardado no se pierde", async () => {
		const savedAfter = async (previous) =>
			page.waitForFunction(
				(before) => {
					const node = document.querySelector(".save-indicator");
					return Boolean(node) && node.textContent.startsWith("Guardado") && node.textContent !== before;
				},
				previous,
				{ timeout: 8000 },
			);
		await savedAfter(await page.locator(".save-indicator").textContent());
		await page.locator('input[aria-label="Pista 1 de la palabra 1"]').fill("Se hace con el corazón atento y en silencio");
		await savedAfter(await page.locator(".save-indicator").textContent());
		await page.reload();
		await page.getByRole("heading", { name: "Panel de administración" }).waitFor();
		await page.locator('input[inputmode="numeric"]').first().fill("5678");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("link", { name: "Palabras desordenadas", exact: true }).click();
		await page.getByRole("button", { name: "Abrir" }).first().click();
		await page.getByRole("heading", { name: "Palabras desordenadas: Ayuno y oración" }).waitFor();
		assert.equal(
			await page.locator('input[aria-label="Pista 1 de la palabra 1"]').inputValue(),
			"Se hace con el corazón atento y en silencio",
			"la pista agregada y editada debe persistir",
		);
	});

	await step("los descubrimientos se configuran por actividad y muestran la vista previa", async () => {
		const select = page.getByLabel("Descubrimientos por palabra");
		await select.selectOption("2");
		const preview = page.locator(".word-row__preview").first();
		await preview.waitFor({ timeout: 3000 });
		const masked = await preview.textContent();
		assert.match(masked, /^Descubrimiento 2: /u);
		assert.match(masked, /_/u, "la vista previa muestra las posiciones ocultas");
		assert.match(masked, /[A-Z]/u, "y las letras reveladas");
		await page.getByText(/^Guardado/u).waitFor({ timeout: 8000 });
	});

	await step("el nivel y las posiciones reveladas quedan guardados", async () => {
		const stored = await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open("jla-dinamicas");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const tx = db.transaction("activities", "readonly");
			const all = tx.objectStore("activities").getAll();
			const rows = await new Promise((resolve) => {
				all.onsuccess = () => resolve(all.result);
			});
			const row = rows.find((candidate) => candidate.type === "palabras");
			return row ? { level: row.letterReveals, reveals: row.game.words[0]?.reveals ?? [] } : undefined;
		});
		assert.equal(stored?.level, 2, "el nivel se guarda en la actividad");
		assert.ok(Array.isArray(stored?.reveals) && stored.reveals.length > 0, "las posiciones se guardan con la palabra");
		await page.reload();
		await page.getByRole("heading", { name: "Panel de administración" }).waitFor();
		await page.locator('input[inputmode="numeric"]').first().fill("5678");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("link", { name: "Palabras desordenadas", exact: true }).click();
		await page.getByRole("button", { name: "Abrir" }).first().click();
		await page.getByRole("heading", { name: "Palabras desordenadas: Ayuno y oración" }).waitFor();
		assert.equal(await page.getByLabel("Descubrimientos por palabra").inputValue(), "2");
		await page.locator(".word-row__preview").first().waitFor({ timeout: 3000 });
	});

	await step("los desempates también admiten pistas", async () => {
		await page.getByRole("button", { name: "Agregar pista al desempate 1", exact: true }).click();
		const hint = page.locator('input[aria-label="Pista 1 del desempate 1"]');
		await hint.waitFor({ timeout: 3000 });
		const before = await page.locator(".save-indicator").textContent();
		await hint.fill("Perdona de corazón");
		await page.waitForFunction(
			(previous) => {
				const node = document.querySelector(".save-indicator");
				return Boolean(node) && node.textContent.startsWith("Guardado") && node.textContent !== previous;
			},
			before,
			{ timeout: 8000 },
		);
		const stored = await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open("jla-dinamicas");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const tx = db.transaction("activities", "readonly");
			const all = tx.objectStore("activities").getAll();
			const rows = await new Promise((resolve) => {
				all.onsuccess = () => resolve(all.result);
			});
			const row = rows.find((candidate) => candidate.type === "palabras");
			return row?.game.tiebreakers?.[0]?.hints ?? [];
		});
		assert.deepEqual(stored, ["Perdona de corazón"], "la pista del desempate debe quedar guardada");
	});

	await step("la dificultad del anagrama se configura por actividad", async () => {
		const savedAfter = async (previous) =>
			page.waitForFunction(
				(before) => {
					const node = document.querySelector(".save-indicator");
					return Boolean(node) && node.textContent.startsWith("Guardado") && node.textContent !== before;
				},
				previous,
				{ timeout: 8000 },
			);
		await page.getByLabel("Dificultad del anagrama").selectOption("dificil");
		await savedAfter(await page.locator(".save-indicator").textContent());
		await page.getByRole("button", { name: "Regenerar anagrama 1", exact: true }).click();
		await savedAfter(await page.locator(".save-indicator").textContent());
		const stored = await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open("jla-dinamicas");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			const tx = db.transaction("activities", "readonly");
			const all = tx.objectStore("activities").getAll();
			const rows = await new Promise((resolve) => {
				all.onsuccess = () => resolve(all.result);
			});
			return rows.find((row) => row.type === "palabras")?.anagramDifficulty;
		});
		assert.equal(stored, "dificil", "la dificultad se guarda con la actividad");
		assert.equal(
			await page.locator('.word-row__status[data-ok="true"]').count(),
			13,
			"regenerar con otro nivel no invalida ningún anagrama",
		);
	});

	await step("un navegador con la marca de siembra antigua recibe el ejemplo nuevo", async () => {
		// Reproduce the reported state: the phase-2 global marker and only the sopa example.
		await page.evaluate(async () => {
			const db = await new Promise((resolve, reject) => {
				const request = indexedDB.open("jla-dinamicas");
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
			await new Promise((resolve, reject) => {
				const tx = db.transaction(["activities", "settings"], "readwrite");
				const activities = tx.objectStore("activities");
				const settings = tx.objectStore("settings");
				const getAll = activities.getAll();
				getAll.onsuccess = () => {
					for (const row of getAll.result) if (row.type === "palabras") activities.delete(row.id);
					settings.delete("examplesSeeded");
					settings.put({ key: "examplesSeededAt", value: new Date().toISOString() });
				};
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			});
		});
		await page.reload();
		await page.getByRole("heading", { name: "Panel de administración" }).waitFor();
		await page.locator('input[inputmode="numeric"]').first().fill("5678");
		await page.getByRole("button", { name: "Entrar" }).click();
		await page.getByRole("link", { name: "Palabras desordenadas", exact: true }).click();
		await page.locator(".activity-row").filter({ hasText: "Palabras desordenadas: Ayuno y oración" }).waitFor({ timeout: 8000 });
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
