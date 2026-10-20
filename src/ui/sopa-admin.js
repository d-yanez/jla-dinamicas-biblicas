// Sopa de letras game section: the word list, the variant strip, the grid preview and
// the approval action. The editor chrome (fields, autosave, requirements) is shared and
// lives in activity-editor.js.

import { ACTIVITY_TYPE } from "../core/activity-model.js";
import { createId } from "../core/ids.js";
import { normalizeWord } from "../core/letters.js";
import { SOPA_WORD_COUNT, generateVariant, variantCoversWords } from "../core/sopa.js";
import { mountActivityEditor } from "./activity-editor.js";
import { confirmDialog } from "./common.js";
import { clear, el } from "./dom.js";
import { renderSopaGrid, solutionHighlights, solutionRows } from "./grid.js";

const VARIANTS_PER_GENERATION = 3;

export function mountSopaSection({ db }) {
	return mountActivityEditor({
		db,
		type: ACTIVITY_TYPE.SOPA,
		renderGame: ({ session }) => createGameSection({ session }),
	});
}

function createGameSection({ session }) {
	const draft = () => session.state.draft;
	const state = {
		showSolution: false,
		variantId: draft().game.approvedVariantId || draft().game.variants[0]?.id || "",
	};
	const nodes = {};
	const wordsBox = el("div", { class: "stack-tight" });
	const variantsBox = el("div", { class: "stack" });
	nodes.variants = variantsBox;

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
					el("h3", { class: "settings-group__title" }, "Palabras, en orden de ronda"),
					el(
						"p",
						{ class: "field__hint" },
						`${activity.game.words.length} de ${SOPA_WORD_COUNT}. El orden es el orden en que se muestran las rondas.`,
					),
				),
				el(
					"button",
					{
						class: "btn btn--ghost btn--small",
						type: "button",
						disabled: activity.game.words.length >= SOPA_WORD_COUNT,
						onclick: () => {
							activity.game.words.push({ id: createId(), text: "" });
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
			const normalizedHint = el("span", { class: "word-row__normalized" }, normalizeWord(word.text) ?? "—");
			const input = el("input", {
				class: "input",
				type: "text",
				value: word.text,
				"aria-label": `Palabra ${index + 1}`,
				maxlength: "20",
			});
			input.addEventListener("input", () => {
				word.text = input.value;
				// Keep the cache equal to the text at every keystroke: a stale normalized
				// made the engine place the previous word when generating before the save.
				word.normalized = normalizeWord(input.value) ?? "";
				normalizedHint.textContent = word.normalized.length > 0 ? word.normalized : "—";
				refreshVariantStaleness();
				session.markDirty();
			});
			list.append(
				el(
					"li",
					{ class: "word-row" },
					el("span", { class: "word-row__index" }, String(index + 1)),
					input,
					normalizedHint,
					el(
						"div",
						{ class: "word-row__actions" },
						el(
							"button",
							{
								class: "btn btn--ghost btn--small",
								type: "button",
								"aria-label": `Subir la palabra ${index + 1}`,
								disabled: index === 0,
								onclick: () => {
									swapWords(activity, index - 1, index);
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
									swapWords(activity, index, index + 1);
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
				),
			);
		});
		wordsBox.append(list);
	}

	// ---------------------------------------------------------------- variants

	function staleness() {
		const variants = draft().game.variants;
		return variants.length > 0 && variants.some((variant) => !variantCoversWords(variant, draft().game.words));
	}

	/** Light update used while typing: never rebuilds the 400-cell grid. */
	function refreshVariantStaleness() {
		const stale = staleness();
		if (nodes.variantWarning) nodes.variantWarning.hidden = !stale;
		if (nodes.generateButton) nodes.generateButton.textContent = stale ? "Actualizar la cuadrícula" : "Generar variantes";
		if (nodes.approveButton) nodes.approveButton.disabled = stale;
		if (nodes.approvedBadge) nodes.approvedBadge.textContent = stale ? "Aprobada, pero desactualizada" : "Variante aprobada";
	}

	function renderVariants() {
		// No isConnected guard here: on mount the section is built before it is attached,
		// and rendering into a detached box is harmless.
		clear(variantsBox);
		nodes.approvedBadge = undefined;
		nodes.approveButton = undefined;
		const activity = draft();
		const variants = activity.game.variants;
		const stale = staleness();
		nodes.variantWarning = el(
			"p",
			{ class: "notice notice--warn", role: "status", hidden: !stale },
			"La cuadrícula no coincide con las palabras actuales. Actualizá la cuadrícula para que las ubicaciones sean las nuevas.",
		);
		nodes.generateButton = el(
			"button",
			{ class: "btn btn--primary btn--small", type: "button", onclick: () => void generateVariants() },
			stale ? "Actualizar la cuadrícula" : "Generar variantes",
		);
		variantsBox.append(
			el(
				"div",
				{ class: "row row--between" },
				el(
					"div",
					{},
					el("h3", { class: "settings-group__title" }, "Cuadrícula"),
					el(
						"p",
						{ class: "field__hint" },
						variants.length === 0
							? "Todavía no hay variantes generadas."
							: `${variants.length} ${variants.length === 1 ? "variante" : "variantes"}. La aprobada es la que se usa al jugar e imprimir.`,
					),
				),
				nodes.generateButton,
			),
			nodes.variantWarning,
		);
		if (variants.length === 0) {
			variantsBox.append(
				el(
					"p",
					{ class: "field__hint" },
					"Generá variantes y aprobá una. La cuadrícula queda guardada: no se regenera al jugar, imprimir, recargar ni restaurar.",
				),
			);
			return;
		}
		const strip = el("div", { class: "variant-strip", role: "group", "aria-label": "Variantes de la cuadrícula" });
		variants.forEach((variant, index) => {
			const chip = el(
				"button",
				{
					class: `variant-chip${variant.id === state.variantId ? " variant-chip--selected" : ""}`,
					type: "button",
					"aria-pressed": variant.id === state.variantId,
					onclick: () => {
						state.variantId = variant.id;
						renderVariants();
					},
				},
				`Variante ${index + 1}`,
			);
			if (variant.id === activity.game.approvedVariantId) chip.append(el("span", { class: "badge badge--gold" }, "Aprobada"));
			strip.append(chip);
		});
		variantsBox.append(strip);

		const variant = variants.find((candidate) => candidate.id === state.variantId) ?? variants[0];
		if (!variant) return;
		const approved = variant.id === activity.game.approvedVariantId;
		const approveControl = approved
			? el("span", { class: "badge badge--gold" }, stale ? "Aprobada, pero desactualizada" : "Variante aprobada")
			: el(
					"button",
					{ class: "btn btn--primary btn--small", type: "button", disabled: stale, onclick: () => void approve(variant) },
					"Aprobar esta variante",
				);
		if (approved) nodes.approvedBadge = approveControl;
		else nodes.approveButton = approveControl;
		variantsBox.append(
			el(
				"div",
				{ class: "row" },
				el(
					"button",
					{
						class: "btn btn--ghost btn--small",
						type: "button",
						"aria-pressed": state.showSolution,
						onclick: () => {
							state.showSolution = !state.showSolution;
							renderVariants();
						},
					},
					state.showSolution ? "Ocultar solución" : "Ver solución",
				),
				approveControl,
			),
		);
		variantsBox.append(
			el(
				"div",
				{ class: "grid-scroll" },
				renderSopaGrid({
					variant,
					highlights: state.showSolution ? solutionHighlights(variant) : new Map(),
					label: `Variante ${variants.indexOf(variant) + 1} de la cuadrícula`,
				}),
			),
		);
		if (state.showSolution) {
			const rows = solutionRows(variant, activity.game.words);
			variantsBox.append(
				el(
					"div",
					{ class: "table-scroll" },
					el(
						"table",
						{ class: "solution-table" },
						el("thead", {}, el("tr", {}, ...["#", "Palabra", "Dirección", "Inicio", "Fin"].map((heading) => el("th", { scope: "col" }, heading)))),
						el(
							"tbody",
							{},
							...rows.map((row) =>
								el("tr", {}, el("td", {}, String(row.index + 1)), el("td", {}, row.text), el("td", {}, row.direction), el("td", {}, row.start), el("td", {}, row.end)),
							),
						),
					),
				),
			);
		}
	}

	async function approve(variant) {
		const activity = draft();
		if (activity.game.approvedVariantId.length > 0 && activity.game.approvedVariantId !== variant.id) {
			const confirmed = await confirmDialog({
				title: "¿Cambiar la variante aprobada?",
				message: "La variante aprobada es la que se usa al jugar e imprimir. Se reemplaza por la que elegiste.",
				confirmLabel: "Aprobar esta",
				cancelLabel: "Cancelar",
			});
			if (!confirmed) return;
		}
		activity.game.approvedVariantId = variant.id;
		state.variantId = variant.id;
		session.setNotice("");
		session.markDirty();
		await session.flush();
		renderVariants();
	}

	async function generateVariants() {
		const activity = draft();
		if (activity.game.approvedVariantId.length > 0) {
			const confirmed = await confirmDialog({
				title: "¿Generar variantes nuevas?",
				message: "Ya hay una variante aprobada. Al generar variantes nuevas se descarta la aprobación y hay que aprobar otra.",
				confirmLabel: "Generar",
				cancelLabel: "Cancelar",
				danger: true,
			});
			if (!confirmed) return;
		}
		const generated = [];
		for (let index = 0; index < VARIANTS_PER_GENERATION; index += 1) {
			const result = generateVariant({ words: activity.game.words, seed: `${activity.id}-${createId()}` });
			if (!result.ok) {
				session.setNotice(result.error);
				return;
			}
			generated.push(result.variant);
		}
		activity.game.variants = generated;
		activity.game.approvedVariantId = "";
		state.variantId = generated[0].id;
		state.showSolution = false;
		session.setNotice("");
		session.markDirty();
		await session.flush();
		renderVariants();
	}

	renderWords();
	renderVariants();

	return {
		element: el("div", { class: "stack" }, wordsBox, variantsBox),
		onEvent(event) {
			if (event === "saved") {
				const activity = draft();
				if (!activity.game.variants.some((variant) => variant.id === state.variantId)) {
					state.variantId = activity.game.approvedVariantId || activity.game.variants[0]?.id || "";
				}
				renderVariants();
			}
		},
	};
}

function swapWords(activity, left, right) {
	const words = activity.game.words;
	if (left < 0 || right < 0 || left >= words.length || right >= words.length) return;
	[words[left], words[right]] = [words[right], words[left]];
}
