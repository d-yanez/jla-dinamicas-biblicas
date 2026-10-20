import assert from "node:assert/strict";
import { test } from "node:test";

import { DB_VERSION, STORES, applyMigrations, plannedStoreNames } from "../src/core/db.js";

function fakeDatabase(existing = []) {
	const created = [];
	return {
		created,
		db: {
			objectStoreNames: { contains: (name) => existing.includes(name) },
			createObjectStore(name, options) {
				created.push({ name, options });
			},
		},
	};
}

test("el esquema declara las cuatro tiendas de datos", () => {
	assert.equal(DB_VERSION, 1);
	assert.deepEqual(plannedStoreNames(DB_VERSION), ["activities", "sessions", "settings", "trash"]);
	assert.equal(STORES.settings.keyPath, "key");
	assert.equal(STORES.activities.keyPath, "id");
	assert.equal(STORES.trash.keyPath, "id");
	assert.equal(STORES.sessions.keyPath, "id");
});

test("applyMigrations crea las tiendas faltantes al abrir una base nueva", () => {
	const { db, created } = fakeDatabase();
	const migrated = applyMigrations(db, 0, 1);
	assert.deepEqual(migrated, ["settings", "activities", "trash", "sessions"]);
	assert.deepEqual(created.map((entry) => entry.name), ["settings", "activities", "trash", "sessions"]);
	assert.deepEqual(created[0].options, { keyPath: "key" });
	assert.deepEqual(created[1].options, { keyPath: "id" });
});

test("applyMigrations es idempotente y no recrea tiendas existentes", () => {
	const { db, created } = fakeDatabase(["settings"]);
	const migrated = applyMigrations(db, 0, 1);
	assert.deepEqual(migrated, ["activities", "trash", "sessions"]);
	assert.equal(created.length, 3);

	const again = fakeDatabase(["settings", "activities", "trash", "sessions"]);
	assert.deepEqual(applyMigrations(again.db, 1, 1), []);
	assert.equal(again.created.length, 0);
});

test("applyMigrations solo aplica pasos entre la versión anterior y la nueva", () => {
	const { db, created } = fakeDatabase();
	assert.deepEqual(applyMigrations(db, 0, 0), []);
	assert.equal(created.length, 0);
});
