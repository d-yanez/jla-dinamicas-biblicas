// Hash router.
//
// GitHub Pages serves this app from a repository subdirectory and cannot rewrite
// unknown paths, so every route lives after "#". That keeps deep links working on
// reload, on a subpath deployment and offline, with no server configuration.

export const GAMES = Object.freeze(["sopa", "palabras"]);
export const ADMIN_SECTIONS = Object.freeze(["sopa", "palabras", "config"]);

const DEFAULT_ADMIN_SECTION = "sopa";

export const GAME_LABELS = Object.freeze({
	sopa: "Sopa de letras",
	palabras: "Palabras desordenadas",
});

export const SECTION_LABELS = Object.freeze({
	sopa: "Sopa de letras",
	palabras: "Palabras desordenadas",
	config: "Configuración general",
});

const ADMIN_HASH = "#/admin";

function rawHash(hash) {
	if (typeof hash !== "string") return "";
	return hash.trim();
}

/** Parses a location hash into a route. Unknown shapes become "notFound". */
export function parseRoute(hash) {
	const raw = rawHash(hash);
	const path = raw.replace(/^#/, "").split("?")[0];
	const segments = path.split("/").filter((segment) => segment.length > 0);
	if (segments.length === 0) return { name: "home", params: {} };
	if (segments[0] === "juego" && segments.length === 2 && GAMES.includes(segments[1])) {
		return { name: "game", params: { game: segments[1] } };
	}
	if (segments[0] === "admin" && segments.length <= 2) {
		const section = segments[1] ?? DEFAULT_ADMIN_SECTION;
		if (ADMIN_SECTIONS.includes(section)) return { name: "admin", params: { section } };
	}
	return { name: "notFound", params: { raw } };
}

/** Serializes a route back to its canonical hash. */
export function toHash(route) {
	if (!route || route.name === "home") return "#/";
	if (route.name === "game") return `#/juego/${route.params?.game ?? GAMES[0]}`;
	if (route.name === "admin") {
		const section = route.params?.section ?? DEFAULT_ADMIN_SECTION;
		return section === DEFAULT_ADMIN_SECTION ? ADMIN_HASH : `${ADMIN_HASH}/${section}`;
	}
	return "#/";
}

export function isAdminRoute(route) {
	return route?.name === "admin";
}

/**
 * The admin unlock lives in memory, so leaving the administration area must
 * forget it: coming back from the home screen asks for the PIN again, while
 * moving between admin sections does not.
 */
export function shouldLockOnNavigation(from, to) {
	return isAdminRoute(from) && !isAdminRoute(to);
}
