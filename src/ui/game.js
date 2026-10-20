// Game entry screen.
//
// Phase 1 has no activity editor, so no published activity can exist yet. Rather
// than faking a table, "Jugar" reports the real state and offers the way back,
// exactly as the specification requires. The published branch is written for the
// next phase and never pretends to run a game.

import { GAME_LABELS } from "../core/router.js";
import { renderEmptyState } from "./common.js";
import { el } from "./dom.js";
import { mountPlayScreen } from "./play.js";

export function renderGame({ game, published, prefs, onPrefsChange }) {
	const label = GAME_LABELS[game] ?? "Juego";
	if (!published) {
		return renderEmptyState({
			title: `No hay actividad publicada de ${label}`,
			description:
				"El moderador todavía no publicó una actividad para este juego. Cuando lo haga, la partida aparecerá acá.",
			actions: [el("a", { class: "btn btn--primary", href: "#/" }, "Volver al inicio")],
		});
	}
	const playable = game === "sopa" ? Boolean(published.game?.approvedVariantId) : (published.game?.words?.length ?? 0) > 0;
	if (!playable) {
		return renderEmptyState({
			title: "La actividad publicada está incompleta",
			description: `Falta completar la actividad de ${label} en el panel de administración: ${game === "sopa" ? "aprobar una variante de la cuadrícula" : "cargar las diez palabras y los tres desempates"}.`,
			actions: [el("a", { class: "btn btn--primary", href: "#/admin" }, "Ir a administración"), el("a", { class: "btn btn--ghost", href: "#/" }, "Volver al inicio")],
		});
	}
	return mountPlayScreen({ game, activity: published, prefs, onPrefsChange }).element;
}
