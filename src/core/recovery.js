// PIN recovery file.
//
// The file proves possession of this device's installation: it carries a random
// recovery key that is also stored locally. Importing a matching file lets the
// moderator set a new PIN without touching activities. A file copied from another
// device is rejected. Like the PIN itself, this is a local convenience, not a
// cryptographic identity, and it is excluded from every JSON backup.

export const RECOVERY_KIND = "jla.pin-recovery";
export const RECOVERY_VERSION = 1;

const KEY_BYTES = 32;

const EMPTY_FILE = "El archivo está vacío.";
const INVALID_JSON = "El archivo no es JSON válido.";
const WRONG_KIND = "El archivo no es un archivo de recuperación de JLA.";
const INCOMPLETE = "El archivo de recuperación está incompleto.";

function bytesToBase64Url(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function nonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0;
}

/** A fresh 32-byte recovery key, base64url encoded (43 chars, no padding). */
export function createRecoveryKey() {
	return bytesToBase64Url(globalThis.crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

/** A random installation id, so a recovery file is bound to one browser store. */
export function createInstallationId() {
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildRecoveryFile(input) {
	const installationId = input?.installationId;
	const recoveryKey = input?.recoveryKey;
	const createdAt = input?.createdAt;
	if (!nonEmptyString(installationId)) throw new Error("El archivo de recuperación necesita un identificador de instalación.");
	if (!nonEmptyString(recoveryKey)) throw new Error("El archivo de recuperación necesita una clave de recuperación.");
	if (!nonEmptyString(createdAt)) throw new Error("El archivo de recuperación necesita una fecha de creación.");
	const file = {
		kind: RECOVERY_KIND,
		version: RECOVERY_VERSION,
		app: "JLA Dinámicas Bíblicas",
		installationId: installationId.trim(),
		recoveryKey: recoveryKey.trim(),
		createdAt,
	};
	if (nonEmptyString(input?.appVersion)) file.appVersion = input.appVersion;
	return file;
}

/** Parses recovery file text, returning either the file or a Spanish error. */
export function parseRecoveryFile(text) {
	if (typeof text !== "string" || text.trim().length === 0) return { ok: false, error: EMPTY_FILE };
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		return { ok: false, error: INVALID_JSON };
	}
	if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, error: WRONG_KIND };
	if (value.kind !== RECOVERY_KIND || value.version !== RECOVERY_VERSION) return { ok: false, error: WRONG_KIND };
	if (!nonEmptyString(value.installationId) || !nonEmptyString(value.recoveryKey) || !nonEmptyString(value.createdAt)) {
		return { ok: false, error: INCOMPLETE };
	}
	const file = {
		kind: RECOVERY_KIND,
		version: RECOVERY_VERSION,
		app: typeof value.app === "string" ? value.app : "JLA Dinámicas Bíblicas",
		installationId: value.installationId.trim(),
		recoveryKey: value.recoveryKey.trim(),
		createdAt: value.createdAt,
	};
	if (nonEmptyString(value.appVersion)) file.appVersion = value.appVersion;
	return { ok: true, file };
}

/** True only when the file belongs to this store. */
export function matchesRecoveryIdentity(file, stored) {
	if (!file || !stored) return false;
	if (!nonEmptyString(file.installationId) || !nonEmptyString(stored.installationId)) return false;
	if (!nonEmptyString(file.recoveryKey) || !nonEmptyString(stored.recoveryKey)) return false;
	return file.installationId === stored.installationId && file.recoveryKey === stored.recoveryKey;
}

export function recoveryFileName(date = new Date()) {
	const day = date.toISOString().slice(0, 10);
	return `jla-recuperacion-pin-${day}.json`;
}
