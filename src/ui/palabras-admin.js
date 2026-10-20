// Palabras desordenadas game section: solution, anagram (editable or regenerable),
// up to two hints per word, and the three tiebreaker words.
//
// The anagram is validated live against its solution with the same multiset rule the
// engine uses, so the moderator sees "revisar" as soon as the letters stop matching.

import { ACTIVITY_TYPE, PALABRAS_WORD_COUNT } from "../core/activity-model.js";
import {
	HINT_MAX_LENGTH,
	MAX_HINTS,
	TIEBREAKER_COUNT,
	checkAnagramPair,
	generateAnagram,
	normalizeSolution,
} from "../core/anagram.js";
import { createId } from "../core/ids.js";
import { mountActivityEditor } from "./activity-editor.js";
import { clear, el } from "./dom.js";

const TIEBREAKER_LABELS = ["Principal", "Reserva 1", "Reserva 2"];

export function mountPalabrasSection({ db }) {
	return mountActivityEditor({
		db,
		type: ACTIVITY_TYPE.PALABRAS,
		renderGame: ({ session }) => createGameSection({ session }),
	});
}

function createGameSection({ session }) {
	const draft = () => session.state.draft;
	const wordsBox = el("div", { class: "stack-tight" });
	const tiesBox = el("div", { class: "stack-tight" });

	function statusOf(entry) {
		return checkAnagramPair({ solution: entry?.solution, anagram: entry?.anagram });
	}

	function applyStatus(node, entry) {
		const result = statusOf(entry);
		node.textContent = result.ok ? "Válido" : result.message;
		node.dataset.ok = result.ok ? "true" : "false";
		node.className = `word-row__status${result.ok ? "" : " word-row__status--error"}`;
	}

	function regenerate(entry, anagramInput, status, notice) {
		const generated = generateAnagram({ solution: entry.solution, seed: createId() });
		if (!generated.ok) {
			session.setNotice(generated.error);
			return;
		}
		entry.anagram = generated.anagram;
		if (anagramInput) anagramInput.value = generated.anagram;
		if (status) applyStatus(status, entry);
		session.setNotice(notice);
		session.markDirty();
	}

	// ------------------------------------------------------------------- words

	function renderWords() {
		const activity = draft();
		clear(wordsBox);
		wordsBox.append(
			el(
				"div",
				{ class: "row row--between" },
				el(
					"div",
					{},
					el("h3", { class: "settings-group__title" }, "Palabras en orden de ronda"),
					el(
						"p",
						{ class: "field__hint" },
						`${activity.game.words.length} de ${PALABRAS_WORD_COUNT}. El anagrama debe tener exactamente las mismas letras que la solución.`,
					),
				),
				el(
					"button",
					{
						class: "btn btn--ghost btn--small",
						type: "button",
						disabled: activity.game.words.length >= PALABRAS_WORD_COUNT,
						onclick: () => {
							activity.game.words.push({ id: createId(), solution: "", normalized: "", anagram: "", hints: [] });
							session.markDirty();
							renderWords();
						},
					},
					"Agregar palabra",
				),
			),
		);
		const list = el("ol", { class: "word-list" });
		activity.game.words.forEach((word, index) => {
			const status = el("span", { class: "word-row__status" });
			const solutionInput = el("input", { class: "input", type: "text", value: word.solution, "aria-label": `Solución ${index + 1}`, maxlength: "20" });
			const anagramInput = el("input", { class: "input", type: "text", value: word.anagram, "aria-label": `Anagrama ${index + 1}`, maxlength: "20" });
			applyStatus(status, word);
			solutionInput.addEventListener("input", () => {
				word.solution = solutionInput.value;
				word.normalized = normalizeSolution(solutionInput.value) ?? "";
				applyStatus(status, word);
				session.markDirty();
			});
			anagramInput.addEventListener("input", () => {
				word.anagram = anagramInput.value;
				applyStatus(status, word);
				session.markDirty();
			});

			const hints = el("div", { class: "hint-list" });
			const drawHints = () => {
				clear(hints);
				word.hints.forEach((hint, hintIndex) => {
					const hintInput = el("input", {
						class: "input",
						type: "text",
						value: hint,
						"aria-label": `Pista ${hintIndex + 1} de la palabra ${index + 1}`,
						maxlength: String(HINT_MAX_LENGTH),
					});
					hintInput.addEventListener("input", () => {
						word.hints[hintIndex] = hintInput.value;
						session.markDirty();
					});
					hints.append(
						el(
							"div",
							{ class: "hint-row" },
							el("span", { class: "hint-row__index" }, `Pista ${hintIndex + 1}`),
							hintInput,
							el(
								"button",
								{
									class: "btn btn--ghost btn--small",
									type: "button",
									"aria-label": `Quitar la pista ${hintIndex + 1} de la palabra ${index + 1}`,
									onclick: () => {
										word.hints.splice(hintIndex, 1);
										session.markDirty();
										renderWords();
									},
								},
								"Quitar",
							),
						),
					);
				});
				hints.append(
					el(
						"button",
						{
							class: "btn btn--ghost btn--small",
							type: "button",
							disabled: word.hints.length >= MAX_HINTS,
							"aria-label": `Agregar pista a la palabra ${index + 1}`,
							onclick: () => {
								word.hints.push("");
								session.markDirty();
								renderWords();
							},
						},
						"Hasta dos pistas",
					),
				);
			};
			drawHints();

			list.append(
				el(
					"li",
					{ class: "word-row word-row--palabras" },
					el("span", { class: "word-row__index" }, String(index + 1)),
					solutionInput,
					anagramInput,
					status,
					el(
						"div",
						{ class: "word-row__actions" },
						el(
							"button",
							{
								class: "btn btn--ghost btn--small",
								type: "button",
								"aria-label": `Regenerar anagrama ${index + 1}`,
								onclick: () => regenerate(word, anagramInput, status, ""),
							},
							"Regenerar",
						),
						el(
							"button",
							{
								class: "btn btn--ghost btn--small",
								type: "button",
								"aria-label": `Subir la palabra ${index + 1}`,
								disabled: index === 0,
								onclick: () => {
									swapWords(activity.game.words, index - 1, index);
									session.markDirty();
									renderWords();
								},
							},
							"↑",
						),
						el(
							"button",
							{
								class: "btn btn--ghost btn--small",
								type: "button",
								"aria-label": `Bajar la palabra ${index + 1}`,
								disabled: index === activity.game.words.length - 1,
								onclick: () => {
									swapWords(activity.game.words, index, index + 1);
									session.markDirty();
									renderWords();
								},
							},
							"↓",
						),
						el(
							"button",
							{
								class: "btn btn--danger btn--small",
								type: "button",
								"aria-label": `Eliminar la palabra ${index + 1}`,
								onclick: () => {
									activity.game.words.splice(index, 1);
									session.markDirty();
									renderWords();
								},
							},
							"Eliminar",
						),
					),
					hints,
				),
			);
		});
		wordsBox.append(list);
	}

	// ------------------------------------------------------------- tiebreakers

	function renderTiebreakers() {
		const activity = draft();
		clear(tiesBox);
		tiesBox.append(
			el(
				"div",
				{ class: "row row--between" },
				el(
					"div",
					{},
					el("h3", { class: "settings-group__title" }, "Palabras de desempate"),
					el(
						"p",
						{ class: "field__hint" },
						`${activity.game.tiebreakers.length} de ${TIEBREAKER_COUNT}: una principal y dos reservas. Se usan sin cronómetro si hay empate.`,
					),
				),
				el(
					"button",
					{
						class: "btn btn--ghost btn--small",
						type: "button",
						disabled: activity.game.tiebreakers.length >= TIEBREAKER_COUNT,
						onclick: () => {
							activity.game.tiebreakers.push({ id: createId(), solution: "", normalized: "", anagram: "" });
							session.markDirty();
							renderTiebreakers();
						},
					},
					"Agregar desempate",
				),
			),
		);
		const list = el("ol", { class: "word-list" });
		activity.game.tiebreakers.forEach((tiebreaker, index) => {
			const status = el("span", { class: "word-row__status" });
			const label = TIEBREAKER_LABELS[index] ?? `Reserva ${index}`;
			const solutionInput = el("input", {
				class: "input",
				type: "text",
				value: tiebreaker.solution,
				"aria-label": `Respuesta del desempate ${index + 1}`,
				maxlength: "20",
			});
			const anagramInput = el("input", {
				class: "input",
				type: "text",
				value: tiebreaker.anagram,
				"aria-label": `Anagrama del desempate ${index + 1}`,
				maxlength: "20",
			});
			applyStatus(status, tiebreaker);
			solutionInput.addEventListener("input", () => {
				tiebreaker.solution = solutionInput.value;
				tiebreaker.normalized = normalizeSolution(solutionInput.value) ?? "";
				applyStatus(status, tiebreaker);
				session.markDirty();
			});
			anagramInput.addEventListener("input", () => {
				tiebreaker.anagram = anagramInput.value;
				applyStatus(status, tiebreaker);
				session.markDirty();
			});
			list.append(
				el(
					"li",
					{ class: "word-row word-row--palabras" },
					el("span", { class: "word-row__index" }, label),
					solutionInput,
					anagramInput,
					status,
					el(
						"div",
						{ class: "word-row__actions" },
						el(
							"button",
							{
								class: "btn btn--ghost btn--small",
								type: "button",
								"aria-label": `Regenerar anagrama del desempate ${index + 1}`,
								onclick: () => regenerate(tiebreaker, anagramInput, status, ""),
							},
							"Regenerar",
						),
						el(
							"button",
							{
								class: "btn btn--danger btn--small",
								type: "button",
								"aria-label": `Eliminar el desempate ${index + 1}`,
								onclick: () => {
									activity.game.tiebreakers.splice(index, 1);
									session.markDirty();
									renderTiebreakers();
								},
							},
							"Eliminar",
						),
					),
				),
			);
		});
		tiesBox.append(list);
	}

	renderWords();
	renderTiebreakers();

	return {
		element: el("div", { class: "stack" }, wordsBox, tiesBox),
		onEvent(event) {
			// Nothing to rebuild: solutions, anagrams and hints are edited in place.
			void event;
		},
	};
}

function swapWords(words, left, right) {
	if (left < 0 || right < 0 || left >= words.length || right >= words.length) return;
	[words[left], words[right]] = [words[right], words[left]];
}
