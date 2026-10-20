// PIN handling for the local admin gate.
//
// The PIN is a convenience lock, not a security boundary: anyone with access to
// this browser profile can read IndexedDB (see the spec's explicit limitation).
// It is still never stored in clear text, so a stolen database dump does not
// reveal the digits, and every record carries its own salt and cost.

export const PIN_LENGTH = 4;
export const PIN_ALGORITHM = "PBKDF2-SHA256";
export const PIN_HASH_ITERATIONS = 210_000;
// A stored record is untrusted input: an absurd cost must be rejected instead of
// being handed to PBKDF2, which would freeze the panel on every verification.
export const PIN_MAX_ITERATIONS = 1_000_000;

const PIN_PATTERN = /^\d{4}$/;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;

/** Returns the PIN when it is exactly four digits, otherwise undefined. */
export function normalizePin(value) {
	if (typeof value !== "string") return undefined;
	const pin = value.trim();
	return PIN_PATTERN.test(pin) ? pin : undefined;
}

function bytesToBase64(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToBytes(text) {
	if (typeof text !== "string" || text.length === 0) return undefined;
	try {
		const binary = atob(text);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
		return bytes;
	} catch {
		return undefined;
	}
}

function constantTimeEquals(left, right) {
	if (left.length !== right.length) return false;
	let difference = 0;
	for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
	return difference === 0;
}

async function deriveBits(pin, salt, iterations) {
	const keyMaterial = await globalThis.crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(pin),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await globalThis.crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations, hash: "SHA-256" },
		keyMaterial,
		DERIVED_BITS,
	);
	return new Uint8Array(bits);
}

/**
 * Derives a storable PIN record. `iterations` and `salt` are injectable so tests
 * can run cheap derivations and so a future migration can raise the cost.
 */
export async function createPinRecord(pin, options = {}) {
	const normalized = normalizePin(pin);
	if (normalized === undefined) throw new Error("El PIN debe tener exactamente cuatro dígitos.");
	const iterations = options.iterations ?? PIN_HASH_ITERATIONS;
	const salt = options.salt ?? globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await deriveBits(normalized, salt, iterations);
	return {
		algorithm: PIN_ALGORITHM,
		iterations,
		salt: bytesToBase64(salt),
		hash: bytesToBase64(hash),
	};
}

/** Verifies a typed PIN against a stored record. Never throws. */
export async function verifyPin(pin, record) {
	if (!isPinRecord(record)) return false;
	const normalized = normalizePin(pin);
	if (normalized === undefined) return false;
	const salt = base64ToBytes(record.salt);
	const expected = base64ToBytes(record.hash);
	if (salt === undefined || expected === undefined) return false;
	try {
		const actual = await deriveBits(normalized, salt, record.iterations);
		return constantTimeEquals(actual, expected);
	} catch {
		return false;
	}
}

export function isPinRecord(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	if (value.algorithm !== PIN_ALGORITHM) return false;
	if (!Number.isInteger(value.iterations) || value.iterations <= 0 || value.iterations > PIN_MAX_ITERATIONS) return false;
	if (typeof value.salt !== "string" || value.salt.length === 0) return false;
	if (typeof value.hash !== "string" || value.hash.length === 0) return false;
	return true;
}
