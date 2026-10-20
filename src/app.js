// Application wiring: storage bootstrap, hash routing, admin access and actions.
//
// This module owns every write to persistent state, so the UI modules stay free of
// storage knowledge and there is exactly one place that can mutate the PIN, the
// recovery identity or the preferences.

import { countPublishedActivities, ensureExampleActivities, fetchPublishedActivity } from "./core/activities.js";
import { ADMIN_ACCESS, canHonorVerification, createAdminGate, shouldOfferRecoveryFile } from "./core/admin-gate.js";
import { openDatabase, readSetting, writeSetting } from "./core/db.js";
import { createPinRecord, isPinRecord, normalizePin, verifyPin } from "./core/pin.js";
import { applyPrefsToDocument, normalizePrefs, readStoredPrefs, writeStoredPrefs } from "./core/prefs.js";
import {
	buildRecoveryFile,
	createInstallationId,
	createRecoveryKey,
	matchesRecoveryIdentity,
	parseRecoveryFile,
	recoveryFileName,
} from "./core/recovery.js";
import { parseRoute, shouldLockOnNavigation } from "./core/router.js";
import { renderAdmin } from "./ui/admin.js";
import { renderEmptyState, renderError, renderFooter, renderGear, renderHeader } from "./ui/common.js";
import { el } from "./ui/dom.js";
import { downloadJson } from "./ui/download.js";
import { renderGame } from "./ui/game.js";
import { renderPinSetup, renderPinUnlock } from "./ui/gate.js";
import { renderHome } from "./ui/home.js";
import { openChangePinDialog, openRecoveryDownloadDialog, startRecoveryImport } from "./ui/security.js";

const APP_VERSION = "0.1.0";
const SECURITY_KEY = "security";

const state = {
	db: undefined,
	gate: createAdminGate(),
	prefs: normalizePrefs(),
	security: undefined,
};

let renderToken = 0;
let lastRenderedRouteKey = "";
let lastRoute;
let firstRender = true;
// Bumped on every navigation and every explicit lock. Asynchronous PIN verification
// captures it so a completion from a previous visit can never unlock a later one.
let navigationGeneration = 0;

function appRoot() {
	return document.querySelector("[data-app-root]");
}

function hasPin() {
	return isPinRecord(state.security?.pin);
}

function recoveryDownloaded() {
	return typeof state.security?.recoveryDownloadedAt === "string" && state.security.recoveryDownloadedAt.length > 0;
}

/** True while the moderator is inside the unlocked panel right now. */
function insideUnlockedAdmin() {
	return shouldOfferRecoveryFile({ unlocked: state.gate.isUnlocked(), route: parseRoute(location.hash) });
}

async function persistSecurity(next) {
	// Write first, then adopt: a failed transaction must never leave the live session
	// believing in a PIN or recovery identity that was not stored.
	await writeSetting(state.db, SECURITY_KEY, next);
	state.security = next;
}

function persistPrefs(patch) {
	const next = normalizePrefs({ ...state.prefs, ...patch });
	state.prefs = next;
	applyPrefsToDocument(next);
	// Returns false when the browser refused the write, so the panel can say so
	// instead of pretending the preference will survive a reload.
	return writeStoredPrefs(next);
}

// --------------------------------------------------------------------- security

/**
 * Creates (or replaces) the PIN. A new PIN always gets a fresh recovery identity,
 * so the file offered right after is the only valid one for this PIN.
 */
async function setPin(pin, { startedAt } = {}) {
	const record = await createPinRecord(pin);
	const previous = state.security?.recovery;
	const next = {
		pin: record,
		recovery: {
			installationId: previous?.installationId ?? createInstallationId(),
			recoveryKey: createRecoveryKey(),
			createdAt: new Date().toISOString(),
		},
	};
	await persistSecurity(next);
	// The PIN is stored either way. Unlocking still belongs to the visit that asked for
	// it: if the moderator navigated or locked while PBKDF2 was running, they must be
	// asked again instead of being handed the panel on the way back.
	const unlocked = canHonorVerification({
		startedAt: startedAt ?? navigationGeneration,
		current: navigationGeneration,
		route: parseRoute(location.hash),
	});
	if (unlocked) state.gate.unlock();
	return unlocked;
}

function buildRecoveryData() {
	const identity = state.security?.recovery;
	if (!identity) return undefined;
	return buildRecoveryFile({
		installationId: identity.installationId,
		recoveryKey: identity.recoveryKey,
		createdAt: identity.createdAt,
		appVersion: APP_VERSION,
	});
}

async function downloadRecovery() {
	const data = buildRecoveryData();
	if (!data) return { downloaded: false, marked: false };
	downloadJson(recoveryFileName(), data);
	// The file is already on disk. The marker only drives a hint, so a refused write
	// must not turn a successful download into an error. The caller still needs the
	// difference so the dialog can say what actually happened.
	try {
		await persistSecurity({ ...state.security, recoveryDownloadedAt: new Date().toISOString() });
		return { downloaded: true, marked: true };
	} catch {
		return { downloaded: true, marked: false };
	}
}

function offerRecoveryDownload() {
	openRecoveryDownloadDialog({
		onDownload: () => downloadRecovery(),
		onDone: () => {
			void render();
		},
	});
}

async function handleSetupPin(pin, options = {}) {
	const startedAt = navigationGeneration;
	const normalized = normalizePin(pin);
	if (normalized === undefined) return { ok: false, error: "El PIN debe tener exactamente cuatro dígitos." };
	let unlocked = false;
	try {
		unlocked = await setPin(normalized, { startedAt });
	} catch (error) {
		return { ok: false, error: `No se pudo guardar el PIN: ${error?.message ?? "error local"}` };
	}
	await render();
	if (insideUnlockedAdmin() && options.offerDownload !== false) offerRecoveryDownload();
	return { ok: true, unlocked };
}

async function handleVerifyPin(pin) {
	const normalized = normalizePin(pin);
	if (normalized === undefined) return { ok: false, error: "El PIN debe tener exactamente cuatro dígitos." };
	if (!hasPin()) return { ok: false, error: "Este dispositivo todavía no tiene un PIN configurado." };
	const generation = navigationGeneration;
	const valid = await verifyPin(normalized, state.security.pin);
	if (!valid) return { ok: false, error: "PIN incorrecto. Probá de nuevo." };
	if (!canHonorVerification({ startedAt: generation, current: navigationGeneration, route: parseRoute(location.hash) })) {
		return { ok: false, error: "Saliste del panel durante la verificación. Volvé a ingresar el PIN." };
	}
	state.gate.unlock();
	await render();
	return { ok: true };
}

async function handleChangePin(currentPin, nextPin) {
	const startedAt = navigationGeneration;
	if (!hasPin()) return { ok: false, error: "Este dispositivo todavía no tiene un PIN configurado." };
	const valid = await verifyPin(currentPin, state.security.pin);
	if (!valid) return { ok: false, error: "El PIN actual no es correcto." };
	const normalized = normalizePin(nextPin);
	if (normalized === undefined) return { ok: false, error: "El PIN nuevo debe tener exactamente cuatro dígitos." };
	let unlocked = false;
	try {
		unlocked = await setPin(normalized, { startedAt });
	} catch (error) {
		return { ok: false, error: `No se pudo guardar el PIN: ${error?.message ?? "error local"}` };
	}
	return { ok: true, unlocked };
}

/** Validation only: a recovery file from another device is rejected here. */
function validateRecoveryText(text) {
	const parsed = parseRecoveryFile(text);
	if (!parsed.ok) return { ok: false, error: parsed.error };
	if (!matchesRecoveryIdentity(parsed.file, state.security?.recovery)) {
		return { ok: false, error: "Este archivo no corresponde a este dispositivo." };
	}
	return { ok: true };
}

async function handleLock() {
	navigationGeneration += 1;
	state.gate.lock();
	if (parseRoute(location.hash).name === "admin") location.hash = "#/";
	else await render();
}

function handleUseRecovery() {
	startRecoveryImport({
		onImportText: validateRecoveryText,
		onSetPin: (pin) => handleSetupPin(pin, { offerDownload: false }),
		onDone: () => {
			void render();
			if (insideUnlockedAdmin()) offerRecoveryDownload();
		},
	});
}

// ---------------------------------------------------------------------- routing

function routeKey(route) {
	return `${route.name}:${JSON.stringify(route.params)}`;
}

async function buildAdmin(route) {
	const access = state.gate.step(hasPin());
	if (access === ADMIN_ACCESS.SETUP) return renderPinSetup({ onSubmit: handleSetupPin });
	if (access === ADMIN_ACCESS.UNLOCK) return renderPinUnlock({ onSubmit: handleVerifyPin, onUseRecovery: handleUseRecovery });

	const section = route.params.section;
	const publishedCount = section === "config" ? 0 : await countPublishedActivities(state.db);
	return renderAdmin({
		section,
		db: state.db,
		prefs: state.prefs,
		publishedCount,
		downloaded: recoveryDownloaded(),
		actions: {
			lock: () => {
				void handleLock();
			},
			changePrefs: (patch) => persistPrefs(patch),
			changePin: () =>
				openChangePinDialog({
					onChangePin: handleChangePin,
					onChanged: () => {
						void render();
						if (insideUnlockedAdmin()) offerRecoveryDownload();
					},
				}),
			downloadRecovery: () => {
				void downloadRecovery().then(() => render());
			},
			useRecovery: handleUseRecovery,
		},
	});
}

async function buildMain(route) {
	if (route.name === "home") {
		const [sopa, palabras] = await Promise.all([
			fetchPublishedActivity(state.db, "sopa"),
			fetchPublishedActivity(state.db, "palabras"),
		]);
		return el("main", { class: "page", id: "contenido", tabindex: "-1" }, renderHome({ published: { sopa, palabras } }));
	}
	if (route.name === "game") {
		const published = await fetchPublishedActivity(state.db, route.params.game);
		return el(
			"main",
			{ class: "page", id: "contenido", tabindex: "-1" },
			renderGame({ game: route.params.game, published }),
		);
	}
	if (route.name === "admin") return buildAdmin(route);
	return el(
		"main",
		{ class: "page", id: "contenido", tabindex: "-1" },
		renderEmptyState({
			title: "Página no encontrada",
			description: "La dirección que abriste no existe en esta aplicación.",
			actions: [el("a", { class: "btn btn--primary", href: "#/" }, "Volver al inicio")],
		}),
	);
}

export async function render() {
	const token = (renderToken += 1);
	const route = parseRoute(location.hash);
	const key = routeKey(route);
	let main;
	try {
		main = await buildMain(route);
	} catch (error) {
		main = el("main", { class: "page", id: "contenido", tabindex: "-1" }, renderError(error?.message ?? "Ocurrió un error inesperado."));
	}
	if (token !== renderToken) return;
	const root = appRoot();
	if (!root) return;
	const nodes = [renderHeader(), main, renderFooter()];
	if (route.name !== "admin") nodes.push(renderGear());
	root.replaceChildren(...nodes);
	if (!firstRender && key !== lastRenderedRouteKey) main.focus({ preventScroll: true });
	lastRenderedRouteKey = key;
	firstRender = false;
}

function onHashChange() {
	navigationGeneration += 1;
	const next = parseRoute(location.hash);
	if (shouldLockOnNavigation(lastRoute, next)) state.gate.lock();
	lastRoute = next;
	void render();
}

export async function bootstrap() {
	if (typeof document === "undefined") return;
	const root = appRoot();
	if (!root) return;
	root.replaceChildren(el("p", { class: "loading" }, "Cargando…"));

	try {
		state.db = await openDatabase();
		state.prefs = readStoredPrefs();
		state.security = await readSetting(state.db, SECURITY_KEY);
		// Seeding is a convenience, not a requirement: a failure here must not keep the
		// moderator out of the app, so it is reported by the absence of the example.
		try {
			await ensureExampleActivities(state.db);
		} catch {
			/* the editor can still create activities from scratch */
		}
	} catch (error) {
		applyPrefsToDocument(state.prefs);
		root.replaceChildren(
			renderHeader(),
			el("main", { class: "page", id: "contenido" }, renderError(error?.message ?? "No se pudo abrir el almacenamiento local.")),
			renderFooter(),
		);
		return;
	}

	applyPrefsToDocument(state.prefs);
	lastRoute = parseRoute(location.hash);
	window.addEventListener("hashchange", onHashChange);
	await render();
}
