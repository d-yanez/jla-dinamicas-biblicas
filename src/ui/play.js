// Play screen for both games: intro, rounds, clock, controls, review, reflection and
// closing. The round engine owns the state; this module only renders it and forwards
// clicks and keys, so every rule that matters (zero seconds, double action, going back,
// extra time) is already tested without a browser.

import { computeReveals, normalizeSolution } from "../core/anagram.js";
import { planForEvent, tensionLevel } from "../core/audio-plan.js";
import { renderInstructions } from "../core/instructions.js";
import { PLAY_EVENT, PLAY_STAGE, createRoundSession, formatClock } from "../core/rounds.js";
import { directionById, pathCells } from "../core/sopa.js";
import { createAudioEngine } from "./audio.js";
import { confirmDialog, createDialog } from "./common.js";
import { clear, el } from "./dom.js";
import { renderSopaGrid } from "./grid.js";

const GAME_LABELS = Object.freeze({ sopa: "Sopa de letras", palabras: "Palabras desordenadas" });
const CLOCK_INTERVAL_MS = 100;

export function mountPlayScreen({ game, activity, prefs, onPrefsChange }) {
	const root = el("div", { class: "play" });
	const audio = createAudioEngine({ volume: prefs?.soundVolume, muted: prefs?.muted });
	let session = createRoundSession({ roundSeconds: activity.roundSeconds });
	const words = activity.game.words ?? [];
	const variant = (activity.game.variants ?? []).find((candidate) => candidate.id === activity.game.approvedVariantId);
	const state = { pauseOverlay: false, discoveries: {} };

	let clockNode;
	let timer;
	let lastFrame = 0;

	const snapshot = () => session.snapshot();
	const nowMs = () => performance.now();
	const currentWord = (index = snapshot().roundIndex) => words[index];
	const currentAnagram = () => normalizeSolution(currentWord()?.anagram) ?? "";

	function dispose() {
		if (timer !== undefined) window.clearInterval(timer);
		timer = undefined;
		audio.dispose();
	}

	function soundEnabled(item) {
		if (item.sound === "tick") return prefs?.soundTicks !== false;
		if (item.sound === "bell") return prefs?.soundBell !== false;
		return true;
	}

	function applyEvents(events) {
		audio.play((events ?? []).flatMap((event) => planForEvent(event)).filter(soundEnabled));
	}

	function run(action) {
		const events = action() ?? [];
		applyEvents(events);
		if (events.some((event) => event.type === PLAY_EVENT.TIME_UP || event.type === PLAY_EVENT.ROUND_START)) {
			audio.stopTension();
		}
		render();
	}

	function updateClock() {
		const current = snapshot();
		if (clockNode?.isConnected) {
			clockNode.textContent = formatClock(current.remainingMs);
			clockNode.classList.toggle("play-clock--urgent", current.running && current.remainingMs > 0 && current.remainingMs <= 5000);
		}
		if (current.running && prefs?.soundTension !== false) {
			audio.startTension();
			audio.setTension(tensionLevel(current));
		} else {
			audio.stopTension();
		}
	}

	function startTimer() {
		if (timer !== undefined) return;
		lastFrame = nowMs();
		timer = window.setInterval(() => {
			if (!root.isConnected) {
				dispose();
				return;
			}
			const frame = nowMs();
			const delta = frame - lastFrame;
			lastFrame = frame;
			const events = session.tick(delta);
			if (events.length > 0) {
				applyEvents(events);
				if (events.some((event) => event.type === PLAY_EVENT.TIME_UP)) audio.stopTension();
			}
			updateClock();
		}, CLOCK_INTERVAL_MS);
	}

	// ------------------------------------------------------------------ controls

	function buildControls(current) {
		const inRound = current.stage === PLAY_STAGE.ROUND || current.stage === PLAY_STAGE.EXTRA;
		const buttons = [];
		if (inRound) {
			buttons.push(
				el(
					"button",
					{ class: "btn btn--primary", type: "button", onclick: () => run(() => session.togglePause(nowMs())) },
					current.running ? "Pausar" : "Reanudar",
				),
				el("button", { class: "btn", type: "button", onclick: () => run(() => session.next(nowMs())) }, "Siguiente palabra →"),
				el("button", { class: "btn btn--ghost", type: "button", onclick: () => run(() => session.previous()) }, "← Retroceder"),
				el("button", { class: "btn btn--ghost", type: "button", onclick: () => run(() => session.restart()) }, "Reiniciar reloj (R)"),
			);
			if (current.roundIndex === current.roundCount - 1) {
				buttons.push(
					el("button", { class: "btn btn--ghost", type: "button", onclick: () => run(() => session.startExtra(nowMs())) }, "60 segundos extra"),
				);
			}
			buttons.push(
				el(
					"button",
					{ class: "btn btn--ghost", type: "button", onclick: () => confirmAndReview() },
					"Revisar soluciones",
				),
			);
		}
		if (current.stage === PLAY_STAGE.REVIEW) {
			buttons.push(
				el("button", { class: "btn btn--primary", type: "button", onclick: () => run(() => session.revealNext(nowMs())) }, "Revelar siguiente →"),
				el("button", { class: "btn btn--ghost", type: "button", onclick: () => run(() => session.revealPrevious()) }, "← Retroceder"),
				el(
					"button",
					{ class: "btn", type: "button", onclick: () => run(() => (activity.reflection?.trim() ? session.goToReflection() : session.finish())) },
					"Cerrar la actividad",
				),
			);
		}
		buttons.push(
			el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => togglePauseOverlay(true) }, "Pausa de presentación"),
			el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => openHelp() }, "Ayuda (?)"),
			el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => void toggleFullscreen() }, "Pantalla completa (F)"),
		);
		if (current.stage !== PLAY_STAGE.THANKS) {
			buttons.push(
				el(
					"button",
					{ class: "btn btn--danger btn--small", type: "button", onclick: () => confirmAndFinish() },
					"Finalizar antes",
				),
			);
		}
		return el("div", { class: "play-controls" }, ...buttons);
	}

	async function confirmAndReview() {
		await session.pause();
		const confirmed = await confirmDialog({
			title: "¿Mostrar las soluciones al público?",
			message: "Se van a ver las respuestas en la pantalla. Se revelan de a una y podés retroceder sin borrar lo ya revelado.",
			confirmLabel: "Mostrar soluciones",
			cancelLabel: "Cancelar",
			danger: true,
		});
		if (!confirmed) {
			render();
			return;
		}
		run(() => session.beginReview());
	}

	async function confirmAndFinish() {
		const confirmed = await confirmDialog({
			title: "¿Finalizar la actividad ahora?",
			message: "Se dejan las rondas que faltan y se pasa al cierre. El contenido publicado no cambia.",
			confirmLabel: "Finalizar",
			cancelLabel: "Seguir jugando",
			danger: true,
		});
		if (!confirmed) return;
		run(() => (activity.reflection?.trim() ? session.goToReflection() : session.finish()));
	}

	function togglePauseOverlay(next) {
		state.pauseOverlay = next;
		if (next) void session.pause();
		render();
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await root.requestFullscreen?.();
		} catch {
			/* the browser can refuse; Esc and F5 still work */
		}
	}

	function setMuted(next) {
		audio.setMuted(next);
		onPrefsChange?.({ muted: next });
	}

	function openHelp() {
		session.openHelp();
		const sheet = createDialog(`Ayuda · ${GAME_LABELS[game]}`);
		const tips =
			game === "sopa"
				? "En cada ronda se muestra una palabra y el grupo la busca en su hoja. El historial queda a la vista. Al terminar las diez rondas podés dar 60 segundos extra y después revisar las soluciones."
				: "En cada ronda se muestra la palabra desordenada. Podés revelar hasta dos pistas y los descubrimientos configurados. No se muestra historial. Después de la décima ronda podés dar 60 segundos extra.";
		const volume = el("input", {
			type: "range",
			min: "0",
			max: "100",
			step: "5",
			value: String(Math.round((audio.volume() ?? 0.3) * 100)),
			"aria-label": "Volumen del sonido",
		});
		volume.addEventListener("input", () => {
			const value = Number(volume.value) / 100;
			audio.setVolume(value);
			onPrefsChange?.({ soundVolume: value });
		});
		const muteButton = el(
			"button",
			{ class: "btn btn--ghost btn--small", type: "button", onclick: () => setMuted(!audio.isMuted()) },
			audio.isMuted() ? "Activar sonido" : "Silenciar (M)",
		);
		sheet.content.append(
			el(
				"div",
				{ class: "stack" },
				el("p", {}, tips),
				el(
					"ul",
					{ class: "shortcut-list" },
					...[
						"Espacio: pausar o reanudar",
						"→: siguiente palabra",
						"←: retroceder",
						"R: reiniciar el reloj de la ronda",
						"F: pantalla completa",
						"M: activar o silenciar el sonido",
						game === "palabras" ? "1 y 2: mostrar la pista 1 o 2" : "?: esta ayuda",
						"?: abrir esta ayuda (pausa el reloj)",
					].map((line) => el("li", {}, line)),
				),
				el("div", { class: "field" }, el("label", { class: "field__label", htmlFor: "volumen" }, "Volumen"), volume),
				el("div", { class: "row" }, muteButton),
				el(
					"fieldset",
					{ class: "sound-stages" },
					el("legend", { class: "field__label" }, "Etapas del sonido"),
					...[
						["soundTension", "Tensión de fondo mientras corre el reloj"],
						["soundTicks", "Tic en los últimos cinco segundos"],
						["soundBell", "Campana al empezar y al terminar"],
					].map(([key, label]) => {
						const input = el("input", {
							type: "checkbox",
							id: `sonido-${key}`,
							checked: prefs?.[key] !== false,
						});
						input.addEventListener("change", () => onPrefsChange?.({ [key]: input.checked }));
						return el(
							"label",
							{ class: "sound-stages__row", for: `sonido-${key}` },
							input,
							el("span", {}, label),
						);
					}),
				),
				el("p", { class: "field__hint" }, "Cerrar la ayuda deja el reloj en pausa: reanudá cuando quieras."),
				el(
					"div",
					{ class: "jla-dialog__actions" },
					el("button", { class: "btn btn--primary", type: "button", onclick: () => sheet.close() }, "Cerrar"),
				),
			),
		);
		sheet.dialog.addEventListener("close", () => {
			session.closeHelp();
			render();
		});
		sheet.open();
	}

	// ---------------------------------------------------------------- shortcuts

	function onKeyDown(event) {
		const target = event.target;
		if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
		if (document.querySelector("dialog[open]")) return;
		if (state.pauseOverlay) {
			if (event.key === "Escape") togglePauseOverlay(false);
			return;
		}
		const key = event.key;
		if (key === " " || event.code === "Space") {
			event.preventDefault();
			run(() => session.togglePause(nowMs()));
			return;
		}
		if (key === "ArrowRight") {
			event.preventDefault();
			run(() => session.next(nowMs()));
			return;
		}
		if (key === "ArrowLeft") {
			event.preventDefault();
			run(() => session.previous());
			return;
		}
		if (key === "?") {
			event.preventDefault();
			openHelp();
			return;
		}
		const lower = key.toLowerCase();
		if (lower === "r") run(() => session.restart());
		else if (lower === "f") void toggleFullscreen();
		else if (lower === "m") setMuted(!audio.isMuted());
		else if ((key === "1" || key === "2") && game === "palabras") showHint(Number(key) - 1);
	}

	function showHint(index) {
		const word = currentWord();
		const hints = (word?.hints ?? []).filter((hint) => hint.trim().length > 0);
		if (index >= hints.length) return;
		const shown = snapshot().hints[snapshot().roundIndex] ?? 0;
		if (index < shown) return;
		run(() => session.showHint());
	}

	function showDiscovery() {
		const index = snapshot().roundIndex;
		const level = Math.min(activity.letterReveals ?? 0, (state.discoveries[index] ?? 0) + 1);
		state.discoveries[index] = level;
		render();
	}

	// ------------------------------------------------------------------- views

	/** Answers in round order: the moderator reviews in the same sequence as the game. */
	function reviewEntries() {
		return words.map((word, index) => {
			const placement = (variant?.placements ?? []).find((candidate) => candidate.wordId === word.id);
			return {
				index,
				word,
				placement,
				direction: placement ? (directionById(placement.direction)?.label ?? placement.direction) : "",
			};
		});
	}

	function reviewHighlights(current) {
		const highlights = new Map();
		if (!variant) return highlights;
		reviewEntries()
			.slice(0, current.review.watermark)
			.forEach((entry, order) => {
				if (!entry.placement) return;
				const cells = pathCells({
					size: variant.size,
					start: entry.placement.start,
					directionId: entry.placement.direction,
					length: entry.placement.normalized.length,
				});
				// Only the freshly revealed word sweeps in; the rest stay painted.
				const newest = order === current.review.cursor - 1;
				(cells ?? []).forEach((index, step) => {
					highlights.set(index, { order, word: entry.placement.normalized, step: newest ? step : undefined });
				});
			});
		return highlights;
	}

	function clockBlock(current) {
		const urgent = current.running && current.remainingMs > 0 && current.remainingMs <= 5000;
		clockNode = el("div", { class: `play-clock${urgent ? " play-clock--urgent" : ""}`, "aria-live": "off" }, formatClock(current.remainingMs));
		return el(
			"div",
			{ class: "play-clock-wrap" },
			clockNode,
			el("p", { class: "field__hint" }, current.running ? "En marcha" : "Reloj detenido"),
		);
	}

	function maskedSolution(word, level) {
		const normalized = normalizeSolution(word?.solution);
		if (!normalized || level < 1) return "";
		const revealed = new Set(computeReveals(word.solution, level));
		return [...normalized].map((letter, index) => (revealed.has(index) ? letter : "_")).join(" ");
	}

	function renderIntro() {
		const intro = el(
			"section",
			{ class: "play-stage" },
			el("p", { class: "play-eyebrow" }, `${GAME_LABELS[game]} · ${activity.theme}`),
			el("h1", { class: "play-title" }, activity.name),
			el("p", { class: "play-instructions" }, renderInstructions(activity)),
			el("p", { class: "field__hint" }, `${activity.roundSeconds} segundos por ronda · diez rondas`),
		);
		if (game === "sopa" && variant) {
			intro.append(el("div", { class: "grid-scroll" }, renderSopaGrid({ variant, label: "Cuadrícula sin resolver" })));
		}
		intro.append(
			el(
				"div",
				{ class: "play-controls" },
				el(
					"button",
					{ class: "btn btn--primary btn--big", type: "button", onclick: () => run(() => session.start(nowMs())) },
					"Mostrar palabra",
				),
				el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => openHelp() }, "Ayuda (?)"),
				el("a", { class: "btn btn--ghost btn--small", href: "#/" }, "Volver al inicio"),
			),
		);
		return intro;
	}

	function renderRound(current) {
		const word = currentWord(current.roundIndex);
		const target = game === "sopa" ? (word?.text ?? "") : currentAnagram();
		const stage = el(
			"section",
			{ class: "play-stage" },
			el("p", { class: "play-eyebrow" }, `Ronda ${current.roundNumber} de ${current.roundCount}${current.stage === PLAY_STAGE.EXTRA ? " · tiempo extra" : ""}`),
			el("h1", { class: "play-target" }, target || "—"),
			clockBlock(current),
		);

		if (game === "sopa") {
			const previous = current.history.filter((index) => index < current.roundIndex).map((index) => words[index]?.text).filter(Boolean);
			if (previous.length > 0) {
				stage.append(
					el(
						"div",
						{ class: "play-history" },
						el("p", { class: "field__hint" }, "Palabras anteriores"),
						el("ul", {}, ...previous.map((text) => el("li", {}, text))),
					),
				);
			}
		} else {
			const hints = (word?.hints ?? []).filter((hint) => hint.trim().length > 0);
			const shown = current.hints[current.roundIndex] ?? 0;
			if (hints.length > 0) {
				stage.append(
					el(
						"div",
						{ class: "play-hints" },
						el("p", { class: "field__hint" }, `Pistas disponibles: ${hints.length}`),
						el("ul", {}, ...hints.slice(0, shown).map((hint) => el("li", {}, hint))),
						el(
							"div",
							{ class: "play-controls" },
							...hints.map((hint, index) =>
								el(
									"button",
									{
										class: "btn btn--ghost btn--small",
										type: "button",
										disabled: index < shown,
										onclick: () => showHint(index),
									},
									`Pista ${index + 1}`,
								),
							),
						),
					),
				);
			}
			const level = state.discoveries[current.roundIndex] ?? 0;
			if ((activity.letterReveals ?? 0) > 0) {
				stage.append(
					el(
						"div",
						{ class: "play-discoveries" },
						el("p", { class: "field__hint" }, `Descubrimientos: ${level} de ${activity.letterReveals}`),
						level > 0 ? el("p", { class: "play-pattern" }, maskedSolution(word, level)) : undefined,
						el(
							"button",
							{
								class: "btn btn--ghost btn--small",
								type: "button",
								disabled: level >= (activity.letterReveals ?? 0),
								onclick: () => showDiscovery(),
							},
							"Descubrir una letra",
						),
					),
				);
			}
		}

		stage.append(buildControls(current));
		return stage;
	}

	function renderReview(current) {
		const entries = reviewEntries();
		const revealed = entries.slice(0, current.review.watermark);
		const nothingRevealed = current.review.cursor === 0;

		const visual =
			game === "sopa" && variant
				? el(
						"div",
						{ class: "grid-scroll" },
						renderSopaGrid({
							variant,
							highlights: reviewHighlights(current),
							label: "Cuadrícula con las soluciones reveladas",
						}),
					)
				: el(
						"div",
						{ class: "play-review__fallback" },
						el("p", { class: "field__hint" }, "En este juego las soluciones se revisan en la lista de la derecha."),
					);

		const answers = el(
			"ol",
			{ class: "review-list" },
			...revealed.map((entry, index) =>
				el(
					"li",
					{ class: index < current.review.cursor ? "review-item" : "review-item review-item--pending" },
					el("span", { class: "review-item__index" }, String(index + 1)),
					el("span", { class: "review-item__solution" }, entry.word?.solution ?? entry.word?.text ?? ""),
					game === "sopa"
						? el("span", { class: "review-item__detail" }, `${entry.direction} · fila ${(entry.placement?.start?.row ?? 0) + 1}, columna ${(entry.placement?.start?.col ?? 0) + 1}`)
						: el("span", { class: "review-item__detail" }, entry.word?.anagram ?? ""),
				),
			),
		);

		return el(
			"section",
			{ class: "play-stage play-review" },
			el(
				"div",
				{ class: "play-review__visual" },
				el(
					"div",
					{ class: "play-review__head" },
					el("p", { class: "play-eyebrow" }, "Revisión de soluciones"),
					el("h2", { class: "play-title play-review__counter" }, `Reveladas ${current.review.cursor} de ${current.reviewCount}`),
				),
				nothingRevealed
					? el(
							"p",
							{ class: "play-review__empty", role: "status" },
							"Todavía no hay ninguna solución a la vista. Usá «Revelar siguiente» para mostrar la primera; las respuestas se revelan de a una, a propósito.",
						)
					: undefined,
				visual,
			),
			el(
				"aside",
				{ class: "play-review__answers" },
				el("p", { class: "field__hint" }, "Soluciones reveladas"),
				revealed.length > 0 ? answers : undefined,
				buildControls(current),
			),
		);
	}

	function renderReflection() {
		return el(
			"section",
			{ class: "play-stage" },
			el("p", { class: "play-eyebrow" }, "Reflexión final"),
			el("h2", { class: "play-title" }, activity.reflection),
			activity.reflectionReference ? el("p", { class: "field__hint" }, activity.reflectionReference) : undefined,
			el(
				"div",
				{ class: "play-controls" },
				el("button", { class: "btn btn--primary btn--big", type: "button", onclick: () => run(() => session.finish()) }, "Continuar"),
			),
		);
	}

	function renderThanks() {
		return el(
			"section",
			{ class: "play-stage play-stage--center" },
			el("p", { class: "play-eyebrow" }, GAME_LABELS[game]),
			el("h1", { class: "play-title" }, "Gracias por participar"),
			el("p", { class: "field__hint" }, activity.eventName ? activity.eventName : undefined),
			el(
				"div",
				{ class: "play-controls" },
				el("a", { class: "btn btn--primary", href: "#/" }, "Volver al inicio"),
				el("button", { class: "btn btn--ghost", type: "button", onclick: () => resetSession() }, "Jugar nuevamente"),
			),
		);
	}

	function resetSession() {
		// A fresh engine, same published content: "Jugar nuevamente" must not replay state.
		session = createRoundSession({ roundSeconds: activity.roundSeconds });
		state.discoveries = {};
		state.pauseOverlay = false;
		audio.stopTension();
		render();
	}

	function pauseOverlay() {
		return el(
			"div",
			{ class: "play-pause", role: "dialog", "aria-modal": "true", "aria-label": "Pausa de presentación" },
			el("p", { class: "play-pause__brand" }, "JLA"),
			el("h2", { class: "play-pause__title" }, "Pausa"),
			el("p", { class: "field__hint" }, "El reloj está detenido."),
			el("button", { class: "btn btn--primary", type: "button", onclick: () => togglePauseOverlay(false) }, "Continuar"),
		);
	}

	function render() {
		clear(root);
		const current = snapshot();
		if (state.pauseOverlay) {
			root.append(pauseOverlay());
			return;
		}
		if (current.stage === PLAY_STAGE.INTRO) root.append(renderIntro());
		else if (current.stage === PLAY_STAGE.ROUND || current.stage === PLAY_STAGE.EXTRA) root.append(renderRound(current));
		else if (current.stage === PLAY_STAGE.REVIEW) root.append(renderReview(current));
		else if (current.stage === PLAY_STAGE.REFLECTION) root.append(renderReflection());
		else root.append(renderThanks());
	}

	window.addEventListener("keydown", onKeyDown);
	root.addEventListener(
		"pointerdown",
		() => {
			audio.unlock();
		},
		{ passive: true },
	);
	startTimer();
	render();

	return {
		element: root,
		dispose() {
			window.removeEventListener("keydown", onKeyDown);
			dispose();
		},
	};
}
