// Game entry screen.
//
// Phase 1 has no activity editor, so no published activity can exist yet. Rather
// than faking a table, "Jugar" reports the real state and offers the way back,
// exactly as the specification requires. The published branch is written for the
// next phase and never pretends to run a game.

import { GAME_LABELS } from "../core/router.js";
import { renderEmptyState } from "./common.js";
import { el } from "./dom.js";

export function renderGame({ game, published }) {
	const label = GAME_LABELS[game] ?? "Juego";
	if (!published) {
		return renderEmptyState({
			title: `No hay actividad publicada de ${label}`,
			description:
				"El moderador todavía no publicó una actividad para este juego. Cuando lo haga, la partida aparecerá acá.",
			actions: [el("a", { class: "btn btn--primary", href: "#/" }, "Volver al inicio")],
		});
	}
	return renderEmptyState({
		title: "La actividad está publicada",
		description: `La partida de ${label} todavía no está disponible en esta versión de la aplicación.`,
		actions: [el("a", { class: "btn btn--primary", href: "#/" }, "Volver al inicio")],
	});
}
