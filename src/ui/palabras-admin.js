// Palabras desordenadas game section: solution, anagram (editable or regenerable),
// up to two hints per word, and the three tiebreaker words.
//
// Every handler resolves its entity from the current draft by index. An autosave replaces
// session.state.draft, so a handler that captured a word object would write into a dead
// copy: the edit would look applied and then vanish on the next save.

import { ACTIVITY_TYPE, PALABRAS_WORD_COUNT } from "../core/activity-model.js";
import {
	ANAGRAM_DIFFICULTIES,
	DEFAULT_ANAGRAM_DIFFICULTY,
	HINT_MAX_LENGTH,
	MAX_HINTS,
	MAX_REVEALS,
	TIEBREAKER_COUNT,
	checkAnagramPair,
	computeReveals,
	generateAnagram,
	normalizeSolution,
} from "../core/anagram.js";
import { createId } from "../core/ids.js";
import { mountActivityEditor } from "./activity-editor.js";
import { clear, el } from "./dom.js";

const TIEBREAKER_LABELS = ["Principal", "Reserva 1", "Reserva 2"];

/** The word with its revealed positions, for the editor preview. */
function maskOf(solution, level) {
	const normalized = normalizeSolution(solution);
	if (normalized === undefined || level < 1) return "";
	const revealed = new Set(computeReveals(solution, level));
	return [...normalized].map((letter, index) => (revealed.has(index) ? letter : "_")).join(" ");
}

export function mountPalabrasSection({ db }) {
	return mountActivityEditor({
		db,
		type: ACTIVITY_TYPE.PALABRAS,
		renderGame: ({ session }) => createGameSection({ session }),
	});
}

function createGameSection({ session }) {
	const currentDraft = () => session.state.draft;
	const wordsBox = el("div", { class: "stack-tight" });
	const tiesBox = el("div", { class: "stack-tight" });

	function applyStatus(node, entry) {
		const result = checkAnagramPair({ solution: entry?.solution, anagram: entry?.anagram });
		node.textContent = result.ok ? "Válido" : result.message;
		node.dataset.ok = result.ok ? "true" : "false";
		node.className = `word-row__status${result.ok ? "" : " word-row__status--error"}`;
	}

	/** Regenerates the anagram of one entry, addressed by index in its store. */
	function regenerate(store, index, anagramInput, status) {
		const entry = currentDraft().game[store][index];
		if (!entry) return;
		const generated = generateAnagram({
			solution: entry.solution,
			seed: createId(),
			difficulty: currentDraft().anagramDifficulty ?? DEFAULT_ANAGRAM_DIFFICULTY,
		});
		if (!generated.ok) {
			session.setNotice(generated.error);
			return;
		}
		entry.anagram = generated.anagram;
		if (anagramInput) anagramInput.value = generated.anagram;
		if (status) applyStatus(status, entry);
		session.setNotice("");
		session.markDirty();
	}

	// ------------------------------------------------------------------- words

	function renderRevealsField() {
		const draft = currentDraft();
		const id = "campo-descubrimientos";
		const select = el(
			"select",
			{ class: "input", id },
			...[0, 1, 2].map((value) =>
				el(
					"option",
					{ value: String(value), selected: (draft.letterReveals ?? 0) === value },
					value === 0 ? "Sin descubrimientos" : `${value} ${value === 1 ? "descubrimiento" : "descubrimientos"}`,
				),
			),
		);
		select.addEventListener("change", () => {
			const current = currentDraft();
			const parsed = Number.parseInt(select.value, 10);
			current.letterReveals = Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_REVEALS ? parsed : 0;
			session.markDirty();
			renderWords();
		});
		return el(
			"div",
			{ class: "field" },
			el("label", { class: "field__label", for: id }, "Descubrimientos por palabra"),
			select,
			el(
				"p",
				{ class: "field__hint" },
				"Cada descubrimiento revela letras en su posición durante la ronda: primero las vocales, después la última consonante. Se activa a mano, ronda por ronda.",
			),
		);
	}

	/** Hint editor shared by words and tiebreakers. */
	function buildHints({ store, index, rerender }) {
		const entryOf = () => currentDraft().game[store]?.[index];
		const scope =
			store === "words"
				? { of: `de la palabra ${index + 1}`, add: `a la palabra ${index + 1}` }
				: { of: `del desempate ${index + 1}`, add: `al desempate ${index + 1}` };
		const box = el("div", { class: "hint-list" });
		const entry = entryOf();
		(entry?.hints ?? []).forEach((hint, hintIndex) => {
			const hintInput = el("input", {
				class: "input",
				type: "text",
				value: hint,
				"aria-label": `Pista ${hintIndex + 1} ${scope.of}`,
				maxlength: String(HINT_MAX_LENGTH),
			});
			hintInput.addEventListener("input", () => {
				const current = entryOf();
				if (!current || !Array.isArray(current.hints)) return;
				current.hints[hintIndex] = hintInput.value;
				session.markDirty();
			});
			box.append(
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
							"aria-label": `Quitar la pista ${hintIndex + 1} ${scope.of}`,
							onclick: () => {
								const current = entryOf();
								if (!current) return;
								current.hints.splice(hintIndex, 1);
								session.markDirty();
								rerender();
							},
						},
						"Quitar",
					),
				),
			);
		});
		box.append(
			el(
				"button",
				{
					class: "btn btn--ghost btn--small",
					type: "button",
					disabled: (entry?.hints ?? []).length >= MAX_HINTS,
					"aria-label": `Agregar pista ${scope.add}`,
					onclick: () => {
						const current = entryOf();
						if (!current) return;
						current.hints = Array.isArray(current.hints) ? current.hints : [];
						if (current.hints.length >= MAX_HINTS) return;
						current.hints.push("");
						session.markDirty();
						rerender();
					},
				},
				"Agregar pista",
			),
		);
		return box;
	}

	function renderDifficultyField() {
		const draft = currentDraft();
		const id = "campo-dificultad";
		const labels = { facil: "Fácil", media: "Media (recomendada)", dificil: "Difícil" };
		const select = el(
			"select",
			{ class: "input", id },
			...ANAGRAM_DIFFICULTIES.map((value) =>
				el("option", { value, selected: (draft.anagramDifficulty ?? DEFAULT_ANAGRAM_DIFFICULTY) === value }, labels[value] ?? value),
			),
		);
		select.addEventListener("change", () => {
			const current = currentDraft();
			current.anagramDifficulty = ANAGRAM_DIFFICULTIES.includes(select.value) ? select.value : DEFAULT_ANAGRAM_DIFFICULTY;
			session.markDirty();
			renderWords();
		});
		return el(
			"div",
			{ class: "field" },
			el("label", { class: "field__label", for: id }, "Dificultad del anagrama"),
			select,
			el(
				"p",
				{ class: "field__hint" },
				"Fácil ancla la primera letra y otra más; Media ancla solo la primera; Difícil no ancla ninguna. Se aplica al regenerar.",
			),
		);
	}

	function renderWords() {
		const activity = currentDraft();
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
							const draft = currentDraft();
							if (draft.game.words.length >= PALABRAS_WORD_COUNT) return;
							draft.game.words.push({ id: createId(), solution: "", normalized: "", anagram: "", hints: [] });
							session.markDirty();
							renderWords();
						},
					},
					"Agregar palabra",
				),
			),
			el("div", { class: "field-grid" }, renderRevealsField(), renderDifficultyField()),
		);
		const list = el("ol", { class: "word-list" });
		activity.game.words.forEach((word, index) => {
			const status = el("span", { class: "word-row__status" });
			const solutionInput = el("input", { class: "input", type: "text", value: word.solution, "aria-label": `Solución ${index + 1}`, maxlength: "20" });
			const anagramInput = el("input", { class: "input", type: "text", value: word.anagram, "aria-label": `Anagrama ${index + 1}`, maxlength: "20" });
			applyStatus(status, word);
			solutionInput.addEventListener("input", () => {
				const entry = currentDraft().game.words[index];
				if (!entry) return;
				entry.solution = solutionInput.value;
				entry.normalized = normalizeSolution(solutionInput.value) ?? "";
				applyStatus(status, entry);
				updatePreview();
				session.markDirty();
			});
			anagramInput.addEventListener("input", () => {
				const entry = currentDraft().game.words[index];
				if (!entry) return;
				entry.anagram = anagramInput.value;
				applyStatus(status, entry);
				session.markDirty();
			});

			const preview = el("p", { class: "field__hint word-row__preview" });
			const updatePreview = () => {
				const entry = currentDraft().game.words[index];
				const level = currentDraft().letterReveals ?? 0;
				if (!entry) return;
				const masked = maskOf(entry.solution, level);
				preview.hidden = masked.length === 0;
				preview.textContent = masked.length === 0 ? "" : `Descubrimiento ${level}: ${masked}`;
			};
			updatePreview();

			const hints = buildHints({ store: "words", index, rerender: renderWords });

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
								onclick: () => regenerate("words", index, anagramInput, status),
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
									swap(currentDraft().game.words, index - 1, index);
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
								disabled: index === currentDraft().game.words.length - 1,
								onclick: () => {
									swap(currentDraft().game.words, index, index + 1);
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
									currentDraft().game.words.splice(index, 1);
									session.markDirty();
									renderWords();
								},
							},
							"Eliminar",
						),
					),
					hints,
					preview,
				),
			);
		});
		wordsBox.append(list);
	}

	// ------------------------------------------------------------- tiebreakers

	function renderTiebreakers() {
		const activity = currentDraft();
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
							const draft = currentDraft();
							if (draft.game.tiebreakers.length >= TIEBREAKER_COUNT) return;
							draft.game.tiebreakers.push({ id: createId(), solution: "", normalized: "", anagram: "" });
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
				const entry = currentDraft().game.tiebreakers[index];
				if (!entry) return;
				entry.solution = solutionInput.value;
				entry.normalized = normalizeSolution(solutionInput.value) ?? "";
				applyStatus(status, entry);
				session.markDirty();
			});
			anagramInput.addEventListener("input", () => {
				const entry = currentDraft().game.tiebreakers[index];
				if (!entry) return;
				entry.anagram = anagramInput.value;
				applyStatus(status, entry);
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
								onclick: () => regenerate("tiebreakers", index, anagramInput, status),
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
									currentDraft().game.tiebreakers.splice(index, 1);
									session.markDirty();
									renderTiebreakers();
								},
							},
							"Eliminar",
						),
					),
					buildHints({ store: "tiebreakers", index, rerender: renderTiebreakers }),
				),
			);
		});
		tiesBox.append(list);
	}

	renderWords();
	renderTiebreakers();

	return {
		element: el("div", { class: "stack" }, wordsBox, tiesBox),
		onEvent() {
			// Solutions, anagrams and hints are edited in place against the current draft.
		},
	};
}

function swap(list, left, right) {
	if (left < 0 || right < 0 || left >= list.length || right >= list.length) return;
	[list[left], list[right]] = [list[right], list[left]];
}
