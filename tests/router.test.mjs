import assert from "node:assert/strict";
import { test } from "node:test";

import {
	ADMIN_SECTIONS,
	GAMES,
	isAdminRoute,
	parseRoute,
	shouldLockOnNavigation,
	toHash,
} from "../src/core/router.js";

test("parseRoute reconoce la portada en todas sus formas", () => {
	for (const hash of ["", "#", "#/", "#//", null, undefined]) {
		assert.deepEqual(parseRoute(hash), { name: "home", params: {} }, `hash ${JSON.stringify(hash)}`);
	}
});

test("parseRoute reconoce las rutas de juego", () => {
	assert.deepEqual(GAMES, ["sopa", "palabras"]);
	assert.deepEqual(parseRoute("#/juego/sopa"), { name: "game", params: { game: "sopa" } });
	assert.deepEqual(parseRoute("#/juego/palabras/"), { name: "game", params: { game: "palabras" } });
	assert.deepEqual(parseRoute("#/juego/ajedrez"), { name: "notFound", params: { raw: "#/juego/ajedrez" } });
	assert.deepEqual(parseRoute("#/juego"), { name: "notFound", params: { raw: "#/juego" } });
});

test("parseRoute reconoce el administrador y sus secciones", () => {
	assert.deepEqual(ADMIN_SECTIONS, ["sopa", "palabras", "config"]);
	assert.deepEqual(parseRoute("#/admin"), { name: "admin", params: { section: "sopa" } });
	assert.deepEqual(parseRoute("#/admin/"), { name: "admin", params: { section: "sopa" } });
	assert.deepEqual(parseRoute("#/admin/palabras"), { name: "admin", params: { section: "palabras" } });
	assert.deepEqual(parseRoute("#/admin/config"), { name: "admin", params: { section: "config" } });
	assert.deepEqual(parseRoute("#/admin/inventada"), { name: "notFound", params: { raw: "#/admin/inventada" } });
});

test("parseRoute ignora query y espacios sobrantes", () => {
	assert.deepEqual(parseRoute("  #/admin/config?x=1  "), { name: "admin", params: { section: "config" } });
	assert.deepEqual(parseRoute("#/desconocido"), { name: "notFound", params: { raw: "#/desconocido" } });
});

test("toHash y parseRoute son inversos para rutas conocidas", () => {
	const routes = [
		{ name: "home", params: {} },
		{ name: "game", params: { game: "sopa" } },
		{ name: "admin", params: { section: "config" } },
	];
	for (const route of routes) {
		assert.deepEqual(parseRoute(toHash(route)), route);
	}
});

test("isAdminRoute distingue administración del resto", () => {
	assert.equal(isAdminRoute({ name: "admin", params: { section: "sopa" } }), true);
	assert.equal(isAdminRoute({ name: "home", params: {} }), false);
	assert.equal(isAdminRoute({ name: "game", params: { game: "sopa" } }), false);
});

test("shouldLockOnNavigation cierra la sesión solo al salir de administración", () => {
	const admin = { name: "admin", params: { section: "sopa" } };
	const adminConfig = { name: "admin", params: { section: "config" } };
	const home = { name: "home", params: {} };
	const game = { name: "game", params: { game: "sopa" } };
	assert.equal(shouldLockOnNavigation(admin, adminConfig), false, "navegar dentro de admin no pide PIN");
	assert.equal(shouldLockOnNavigation(admin, home), true);
	assert.equal(shouldLockOnNavigation(admin, game), true);
	assert.equal(shouldLockOnNavigation(home, admin), false);
	assert.equal(shouldLockOnNavigation(game, game), false);
});
