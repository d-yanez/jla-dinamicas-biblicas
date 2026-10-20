// Home screen: the two game cards and the invitation to play.
//
// The cards always lead to the game screen, which is the place that reports
// whether a published activity exists. A discreet badge here warns in advance
// without blocking the moderator from checking.

import { el } from "./dom.js";

const GAME_CONTENT = {
	sopa: {
		title: "Sopa de letras",
		description: "Una cuadrícula de 20 × 20 con diez palabras para buscar en parejas, ronda por ronda.",
	},
	palabras: {
		title: "Palabras desordenadas",
		description: "Diez palabras desordenadas para resolver contra el reloj, con pistas y desempates.",
	},
};

function renderGameCard(game, { published }) {
	const content = GAME_CONTENT[game];
	return el(
		"article",
		{ class: "game-card", "aria-labelledby": `card-${game}` },
		el(
			"div",
			{ class: "game-card__head" },
			el("h2", { class: "game-card__title", id: `card-${game}` }, content.title),
			published
				? el("span", { class: "badge badge--gold" }, "Publicada")
				: el("span", { class: "badge badge--muted" }, "Sin actividad publicada"),
		),
		el("p", { class: "game-card__desc" }, content.description),
		el(
			"div",
			{ class: "game-card__actions" },
			el("a", { class: "btn btn--primary", href: `#/juego/${game}` }, "Jugar"),
		),
	);
}

export function renderHome({ published = { sopa: undefined, palabras: undefined } } = {}) {
	return el(
		"div",
		{ class: "stack" },
		el(
			"section",
			{ class: "hero" },
			el("p", { class: "hero__eyebrow" }, "Dinámicas bíblicas presenciales"),
			el("h1", {}, "JLA Dinámicas Bíblicas"),
			el(
				"p",
				{ class: "hero__lead" },
				"Dos juegos para compartir en el grupo juvenil. Las parejas juegan en papel y el moderador conduce la actividad desde este dispositivo.",
			),
		),
		el(
			"div",
			{ class: "game-grid" },
			renderGameCard("sopa", { published: Boolean(published.sopa) }),
			renderGameCard("palabras", { published: Boolean(published.palabras) }),
		),
	);
}
