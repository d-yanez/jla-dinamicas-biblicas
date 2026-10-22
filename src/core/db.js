// Local persistence on IndexedDB.
//
// One database, one versioned schema, one migration list. Every later phase adds
// a migration instead of editing an existing one, so an already-installed browser
// upgrades in place and never loses activities. Tests exercise applyMigrations
// with a fake database, so the upgrade logic is verifiable without a browser.

export const DB_NAME = "jla-dinamicas";
export const DB_VERSION = 1;

export const STORES = Object.freeze({
	settings: Object.freeze({ keyPath: "key" }),
	activities: Object.freeze({ keyPath: "id" }),
	trash: Object.freeze({ keyPath: "id" }),
	sessions: Object.freeze({ keyPath: "id" }),
});

// Append-only. A new phase adds `{ version: n, stores: [...] }`; never rewrite an
// entry that already shipped, because installed browsers only run the steps above
// their own oldVersion.
const MIGRATIONS = Object.freeze([
	{ version: 1, stores: ["settings", "activities", "trash", "sessions"] },
]);

/** Names of the object stores the schema holds at a given version. */
export function plannedStoreNames(version = DB_VERSION) {
	const names = new Set();
	for (const migration of MIGRATIONS) {
		if (migration.version > version) continue;
		for (const name of migration.stores) names.add(name);
	}
	return [...names].sort();
}

/**
 * Applies every pending migration step. Returns the stores it created. Idempotent:
 * an existing store is never recreated, so an interrupted upgrade can be retried.
 */
export function applyMigrations(db, oldVersion = 0, newVersion = DB_VERSION) {
	const created = [];
	for (const migration of MIGRATIONS) {
		if (migration.version <= oldVersion || migration.version > newVersion) continue;
		for (const name of migration.stores) {
			if (db.objectStoreNames.contains(name)) continue;
			db.createObjectStore(name, { ...STORES[name] });
			created.push(name);
		}
	}
	return created;
}

export function openDatabase(factory = globalThis.indexedDB) {
	return new Promise((resolve, reject) => {
		if (!factory) {
			reject(new Error("Este navegador no admite IndexedDB, así que no se pueden guardar datos."));
			return;
		}
		let request;
		try {
			request = factory.open(DB_NAME, DB_VERSION);
		} catch (error) {
			reject(error);
			return;
		}
		request.onupgradeneeded = (event) => {
			applyMigrations(request.result, event.oldVersion ?? 0, DB_VERSION);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("No se pudo abrir el almacenamiento local."));
		request.onblocked = () =>
			reject(new Error("Otra pestaña de la aplicación está usando una versión anterior. Cerrá las demás pestañas y volvé a intentar."));
	});
}

function runTransaction(db, storeName, mode, operation) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, mode);
		const store = transaction.objectStore(storeName);
		let result;
		try {
			result = operation(store);
		} catch (error) {
			reject(error);
			return;
		}
		transaction.oncomplete = () => resolve(result?.result ?? result);
		transaction.onerror = () => reject(transaction.error ?? new Error("La operación local falló."));
		transaction.onabort = () => reject(transaction.error ?? new Error("La operación local se canceló."));
	});
}

/** Reads one settings row, returning `fallback` when it does not exist. */
export async function readSetting(db, key, fallback = undefined) {
	const row = await runTransaction(db, "settings", "readonly", (store) => store.get(key));
	if (row === undefined) return fallback;
	return row && "value" in row ? row.value : fallback;
}

export async function writeSetting(db, key, value) {
	await runTransaction(db, "settings", "readwrite", (store) => store.put({ key, value }));
	return value;
}

export async function deleteSetting(db, key) {
	await runTransaction(db, "settings", "readwrite", (store) => store.delete(key));
}

/** Inserts or replaces one row of any store, returning the stored value. */
export async function putRow(db, storeName, value) {
	await runTransaction(db, storeName, "readwrite", (store) => store.put(value));
	return value;
}

/** Reads one row by key, or undefined when it does not exist. */
export function getRow(db, storeName, key) {
	return runTransaction(db, storeName, "readonly", (store) => store.get(key));
}

/** Deletes one row by key. */
export async function removeRow(db, storeName, key) {
	await runTransaction(db, storeName, "readwrite", (store) => store.delete(key));
}

/** Removes every row of a store. */
export function clearStore(db, storeName) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, "readwrite");
		transaction.objectStore(storeName).clear();
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error ?? new Error("No se pudo vaciar el almacenamiento local."));
	});
}

/** All rows of a store, as an array. */
export function getAll(db, storeName) {
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(storeName, "readonly");
		const request = transaction.objectStore(storeName).getAll();
		request.onsuccess = () => resolve(request.result ?? []);
		request.onerror = () => reject(request.error ?? new Error("No se pudieron leer los datos locales."));
	});
}
