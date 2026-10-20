// Small identifier helper. crypto.randomUUID needs a secure context, which
// localhost and GitHub Pages both provide; the fallback keeps the app usable when it
// is served from a plain HTTP origin during local testing.

export function createId() {
	const uuid = globalThis.crypto?.randomUUID?.();
	if (typeof uuid === "string" && uuid.length > 0) return uuid;
	const random = Math.random().toString(36).slice(2, 10);
	return `${Date.now().toString(36)}-${random}`;
}
