// Sopa de letras administration: the draft editor, the manual word order, the variant
// preview and the requirement check.
//
// The component owns its DOM. The app re-renders a route on navigation only, so typing
// here never rebuilds the tree: field edits mutate the draft in place, the debounce
// persists it, and only the affected sub-tree (indicator, word list, variants) is redrawn.

import {
	ACTIVITY_STATUS,
	ACTIVITY_TYPE,
	ROUND_SECONDS,
	createActivity,
	duplicateAsDraft,
	validateActivity,
} from "../core/activity-model.js";
import { getActivity, listActivities, saveActivity } from "../core/activities.js";
import { createId } from "../core/ids.js";
import { defaultInstructionsFor, renderInstructions } from "../core/instructions.js";
import { normalizeWord } from "../core/letters.js";
import { SOPA_WORD_COUNT, generateVariant } from "../core/sopa.js";
import { confirmDialog } from "./common.js";
import { clear, el, uniqueId } from "./dom.js";
import { formatDateTime } from "./format.js";
import { renderSopaGrid, solutionHighlights, solutionRows } from "./grid.js";

const SAVE_DELAY_MS = 800;
const VARIANTS_PER_GENERATION = 3;

// Survives re-mounts within the session: coming back to the section reopens the same
// activity instead of dropping the moderator into the list again.
let selectedActivityId = "";

function statusLabel(activity) {
	return activity.status === ACTIVITY_STATUS.PUBLISHED ? "Publicada" : "Borrador";
}

function activityName(activity) {
	return activity.name.trim().length > 0 ? activity.name : "Actividad sin nombre";
}

export function mountSopaSection({ db }) {
	const root = el("div", { class: "stack" });
	const state = {
		activities: [],
		draft: undefined,
		loading: true,
		saveState: "idle",
		lastSavedAt: "",
		showSolution: false,
		variantId: "",
		notice: "",
		requirements: undefined,
	};
	let saveTimer;
	let nodes = {};

	const disposed = () => !root.isConnected;

	function saveLabel() {
		if (state.saveState === "saving") return "Guardando…";
		if (state.saveState === "dirty") return "Cambios sin guardar";
		if (state.saveState === "saved") return state.lastSavedAt ? `Guardado ${formatDateTime(state.lastSavedAt)}` : "Guardado";
		return "";
	}

	function updateSaveIndicator() {
		if (nodes.indicator?.isConnected) nodes.indicator.textContent = saveLabel();
	}

	async function refreshList() {
		state.activities = await listActivities(db, { type: ACTIVITY_TYPE.SOPA });
		if (selectedActivityId && !state.activities.some((activity) => activity.id === selectedActivityId)) {
			selectedActivityId = "";
			state.draft = undefined;
		}
	}

	function markDirty() {
		state.saveState = "dirty";
		updateSaveIndicator();
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(() => {
			void flush();
		}, SAVE_DELAY_MS);
	}

	async function flush() {
		window.clearTimeout(saveTimer);
		if (!state.draft) return;
		state.saveState = "saving";
		updateSaveIndicator();
		const hadVariants = state.draft.game.variants.length;
		const saved = await saveActivity(db, state.draft);
		const dropped = hadVariants > 0 && saved.game.variants.length === 0;
		state.draft = saved;
		state.saveState = "saved";
		state.lastSavedAt = saved.updatedAt;
		if (!saved.game.variants.some((variant) => variant.id === state.variantId)) {
			state.variantId = saved.game.approvedVariantId || saved.game.variants[0]?.id || "";
		}
		await refreshList();
		if (disposed()) return;
		if (dropped) state.notice = "Las palabras cambiaron: las variantes anteriores se descartaron. Generá variantes nuevas.";
		updateSaveIndicator();
		if (nodes.title) nodes.title.textContent = activityName(saved);
		if (nodes.notice) {
			nodes.notice.textContent = state.notice;
			nodes.notice.hidden = state.notice.length === 0;
		}
		renderVariants();
	}

	async function open(id) {
		selectedActivityId = id;
		const activity = await getActivity(db, id);
		if (!activity) {
			await refreshList();
			render();
			return;
		}
		state.draft = activity;
		state.variantId = activity.game.approvedVariantId || activity.game.variants[0]?.id || "";
		state.showSolution = false;
		state.requirements = undefined;
		state.notice = "";
		state.saveState = "saved";
		state.lastSavedAt = activity.updatedAt;
		render();
	}

	async function createNew() {
		const draft = await saveActivity(db, createActivity({ type: ACTIVITY_TYPE.SOPA, name: "" }));
		selectedActivityId = draft.id;
		state.draft = draft;
		state.variantId = "";
		state.requirements = undefined;
		state.notice = "";
		state.saveState = "saved";
		state.lastSavedAt = draft.updatedAt;
		await refreshList();
		render();
	}

	async function duplicate(activity) {
		const copy = await saveActivity(db, duplicateAsDraft(activity));
		await refreshList();
		await open(copy.id);
	}

	async function backToList() {
		await flush();
		selectedActivityId = "";
		state.draft = undefined;
		state.requirements = undefined;
		state.notice = "";
		await refreshList();
		render();
	}

	// ------------------------------------------------------------------ variants

	function renderVariants() {
		const box = nodes.variants;
		if (!box?.isConnected || !state.draft) return;
		clear(box);
		const draft = state.draft;
		const variants = draft.game.variants;
		box.append(
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
				el("button", { class: "btn btn--primary btn--small", type: "button", onclick: () => void generateVariants() }, "Generar variantes"),
			),
		);
		if (variants.length === 0) {
			box.append(
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
			if (variant.id === draft.game.approvedVariantId) chip.append(el("span", { class: "badge badge--gold" }, "Aprobada"));
			strip.append(chip);
		});
		box.append(strip);

		const variant = variants.find((candidate) => candidate.id === state.variantId) ?? variants[0];
		if (!variant) return;
		const approved = variant.id === draft.game.approvedVariantId;
		box.append(
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
				approved
					? el("span", { class: "badge badge--gold" }, "Variante aprobada")
					: el("button", { class: "btn btn--primary btn--small", type: "button", onclick: () => void approve(variant) }, "Aprobar esta variante"),
			),
		);
		box.append(
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
			const rows = solutionRows(variant, draft.game.words);
			box.append(
				el(
					"div",
					{ class: "table-scroll" },
					el(
						"table",
						{ class: "solution-table" },
						el(
							"thead",
							{},
							el("tr", {}, ...["#", "Palabra", "Dirección", "Inicio", "Fin"].map((heading) => el("th", { scope: "col" }, heading))),
						),
						el(
							"tbody",
							{},
							...rows.map((row) =>
								el(
									"tr",
									{},
									el("td", {}, String(row.index + 1)),
									el("td", {}, row.text),
									el("td", {}, row.direction),
									el("td", {}, row.start),
									el("td", {}, row.end),
								),
							),
						),
					),
				),
			);
		}
	}

	async function approve(variant) {
		if (!state.draft) return;
		const hadApproved = state.draft.game.approvedVariantId.length > 0;
		if (hadApproved && state.draft.game.approvedVariantId !== variant.id) {
			const confirmed = await confirmDialog({
				title: "¿Cambiar la variante aprobada?",
				message: "La variante aprobada es la que se usa al jugar e imprimir. Se reemplaza por la que elegiste.",
				confirmLabel: "Aprobar esta",
				cancelLabel: "Cancelar",
			});
			if (!confirmed) return;
		}
		state.draft.game.approvedVariantId = variant.id;
		state.variantId = variant.id;
		state.notice = "";
		state.requirements = undefined;
		markDirty();
		await flush();
		renderVariants();
	}

	async function generateVariants() {
		if (!state.draft) return;
		if (state.draft.game.approvedVariantId.length > 0) {
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
			const result = generateVariant({ words: state.draft.game.words, seed: `${state.draft.id}-${createId()}` });
			if (!result.ok) {
				state.notice = result.error;
				if (nodes.notice) {
					nodes.notice.textContent = state.notice;
					nodes.notice.hidden = false;
				}
				return;
			}
			generated.push(result.variant);
		}
		state.draft.game.variants = generated;
		state.draft.game.approvedVariantId = "";
		state.variantId = generated[0].id;
		state.showSolution = false;
		state.notice = "";
		state.requirements = undefined;
		markDirty();
		await flush();
		renderVariants();
	}

	async function verifyRequirements() {
		if (!state.draft) return;
		const published = state.activities.filter(
			(activity) => activity.type === ACTIVITY_TYPE.SOPA && activity.status === ACTIVITY_STATUS.PUBLISHED,
		);
		state.requirements = validateActivity(state.draft, { publishedOfType: published });
		renderRequirements();
	}

	function renderRequirements() {
		const box = nodes.requirements;
		if (!box?.isConnected) return;
		clear(box);
		const result = state.requirements;
		if (!result) return;
		if (result.ok) {
			box.append(
				el(
					"p",
					{ class: "notice", role: "status" },
					"La actividad cumple todos los requisitos. Falta publicarla: la publicación llega en la fase de biblioteca.",
				),
			);
			return;
		}
		box.append(
			el(
				"div",
				{ class: "notice notice--warn", role: "status" },
				el("p", {}, `Faltan ${result.errors.length} ${result.errors.length === 1 ? "requisito" : "requisitos"}:`),
				el("ul", {}, ...result.errors.map((error) => el("li", {}, error.message))),
			),
		);
	}

	// -------------------------------------------------------------------- fields

	function textField({ label, value, onInput, hint, multiline = false, type = "text", attrs = {} }) {
		const id = uniqueId("campo");
		const input = multiline
			? el("textarea", { class: "input input--area", id, rows: 3, value })
			: el("input", { class: "input", id, type, value, ...attrs });
		input.addEventListener("input", () => {
			onInput(input.value);
			markDirty();
		});
		return el(
			"div",
			{ class: "field" },
			el("label", { class: "field__label", for: id }, label),
			input,
			hint ? el("span", { class: "field__hint" }, hint) : undefined,
		);
	}

	function renderFields() {
		const draft = state.draft;
		const instructionsPreview = el("p", { class: "field__hint" }, `Vista previa: ${renderInstructions(draft)}`);
		const grid = el("div", { class: "field-grid" });

		grid.append(
			textField({ label: "Nombre de la actividad", value: draft.name, onInput: (value) => {
				draft.name = value;
				if (nodes.title) nodes.title.textContent = activityName(draft);
			} }),
			textField({ label: "Tema bíblico", value: draft.theme, onInput: (value) => { draft.theme = value; } }),
			textField({ label: "Referencia bíblica", value: draft.reference, hint: "Opcional. Solo la referencia, sin transcribir el texto.", onInput: (value) => { draft.reference = value; } }),
			textField({ label: "Enseñanza", value: draft.teaching, multiline: true, hint: "Opcional.", onInput: (value) => { draft.teaching = value; } }),
			textField({
				label: "Duración por ronda (segundos)",
				value: String(draft.roundSeconds),
				type: "number",
				attrs: { min: String(ROUND_SECONDS.min), max: String(ROUND_SECONDS.max), step: "1", inputmode: "numeric" },
				hint: `Entre ${ROUND_SECONDS.min} y ${ROUND_SECONDS.max}. Se usa en las diez rondas.`,
				onInput: (value) => {
					const seconds = Number.parseInt(value, 10);
					if (Number.isInteger(seconds)) draft.roundSeconds = seconds;
				},
			}),
			el(
				"div",
				{ class: "field" },
				el("label", { class: "field__label", for: "campo-instrucciones" }, "Instrucciones introductorias"),
				el("textarea", { class: "input input--area", id: "campo-instrucciones", rows: 4, value: draft.instructions }),
				el("p", { class: "field__hint" }, "Se muestra antes de empezar. Escribí {{duracion}} para insertar el reloj de cada ronda."),
				el(
					"button",
					{
						class: "btn btn--ghost btn--small",
						type: "button",
						onclick: () => {
							const textarea = grid.querySelector("#campo-instrucciones");
							draft.instructions = defaultInstructionsFor(ACTIVITY_TYPE.SOPA);
							if (textarea) textarea.value = draft.instructions;
							instructionsPreview.textContent = `Vista previa: ${renderInstructions(draft)}`;
							markDirty();
						},
					},
					"Usar la plantilla del juego",
				),
				instructionsPreview,
			),
			textField({ label: "Reflexión final", value: draft.reflection, multiline: true, hint: "Opcional. Se muestra en una pantalla aparte al terminar.", onInput: (value) => { draft.reflection = value; } }),
			textField({ label: "Referencia de la reflexión", value: draft.reflectionReference, hint: "Opcional.", onInput: (value) => { draft.reflectionReference = value; } }),
			textField({ label: "Nombre del evento", value: draft.eventName, hint: "Opcional. Aparece en el PDF solo si está configurado.", onInput: (value) => { draft.eventName = value; } }),
			textField({ label: "Fecha del evento", value: draft.eventDate, type: "date", onInput: (value) => { draft.eventDate = value; } }),
		);

		// The instructions textarea is wired here because it needs the live preview node.
		const instructionsInput = grid.querySelector("#campo-instrucciones");
		instructionsInput?.addEventListener("input", () => {
			draft.instructions = instructionsInput.value;
			instructionsPreview.textContent = `Vista previa: ${renderInstructions(draft)}`;
			markDirty();
		});
		return grid;
	}

	function renderWords() {
		const draft = state.draft;
		const box = el("div", { class: "stack-tight" });
		const rebuild = () => {
			clear(box);
			box.append(
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
							`${draft.game.words.length} de ${SOPA_WORD_COUNT}. El orden es el orden en que se muestran las rondas.`,
						),
					),
					el(
						"button",
						{
							class: "btn btn--ghost btn--small",
							type: "button",
							disabled: draft.game.words.length >= SOPA_WORD_COUNT,
							onclick: () => {
								draft.game.words.push({ id: createId(), text: "", normalized: "" });
								markDirty();
								rebuild();
							},
						},
						"Agregar palabra",
					),
				),
			);
			const list = el("ol", { class: "word-list" });
			draft.game.words.forEach((word, index) => {
				const normalizedHint = el("span", { class: "word-row__normalized" }, normalizeWord(word.text) ?? "—");
				const input = el("input", {
					class: "input",
					type: "text",
					value: word.text,
					"aria-label": `Palabra ${index + 1}`,
					maxlength: "20",
				});
				input.addEventListener("input", () => {
					draft.game.words[index].text = input.value;
					normalizedHint.textContent = normalizeWord(input.value) ?? "—";
					markDirty();
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
										swapWords(draft, index - 1, index);
										markDirty();
										rebuild();
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
									disabled: index === draft.game.words.length - 1,
									onclick: () => {
										swapWords(draft, index, index + 1);
										markDirty();
										rebuild();
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
										draft.game.words.splice(index, 1);
										markDirty();
										rebuild();
									},
								},
								"Eliminar",
							),
						),
					),
				);
			});
			box.append(list);
		};
		rebuild();
		return box;
	}

	function renderEditor() {
		const draft = state.draft;
		clear(root);
		const indicator = el("span", { class: "save-indicator", role: "status" }, saveLabel());
		const title = el("h2", { class: "settings-group__title" }, activityName(draft));
		const notice = el("p", { class: "notice notice--info", hidden: state.notice.length === 0 }, state.notice);
		const variants = el("div", { class: "stack" });
		const requirements = el("div", { class: "stack" });
		nodes = { indicator, title, notice, variants, requirements };

		root.append(
			el(
				"section",
				{ class: "panel stack" },
				el(
					"div",
					{ class: "row row--between" },
					el(
						"div",
						{},
						el("p", { class: "hero__eyebrow" }, `${statusLabel(draft)} · Sopa de letras`),
						title,
					),
					el(
						"div",
						{ class: "row" },
						indicator,
						el(
							"button",
							{
								class: "btn btn--primary btn--small",
								type: "button",
								onclick: () => {
									void flush();
								},
							},
							"Guardar ahora",
						),
						el(
							"button",
							{
								class: "btn btn--ghost btn--small",
								type: "button",
								onclick: () => {
									void backToList();
								},
							},
							"Volver a la lista",
						),
					),
				),
				notice,
				renderFields(),
				el("hr", { class: "divider" }),
				renderWords(),
				el("hr", { class: "divider" }),
				variants,
				el(
					"div",
					{ class: "row" },
					el(
						"button",
						{
							class: "btn btn--small",
							type: "button",
							onclick: () => {
								void verifyRequirements();
							},
						},
						"Verificar requisitos",
					),
				),
				requirements,
				el("p", { class: "field__hint" }, "Los borradores se guardan solos. Nunca se publican automáticamente."),
			),
		);
		renderVariants();
		if (state.requirements) renderRequirements();
	}

	function renderList() {
		clear(root);
		nodes = {};
		root.append(
			el(
				"section",
				{ class: "panel stack" },
				el(
					"div",
					{ class: "row row--between" },
					el(
						"div",
						{},
						el("h2", { class: "settings-group__title" }, "Actividades de sopa de letras"),
						el(
							"p",
							{ class: "settings-group__desc" },
							"Borradores guardados en este dispositivo. La cuadrícula se genera una vez y queda guardada.",
						),
					),
					el(
						"button",
						{
							class: "btn btn--primary btn--small",
							type: "button",
							onclick: () => {
								void createNew();
							},
						},
						"Nueva actividad",
					),
				),
				state.activities.length === 0
					? el("p", { class: "field__hint" }, "Todavía no hay actividades. Creá la primera con «Nueva actividad».")
					: el(
							"ul",
							{ class: "activity-list" },
							...state.activities.map((activity) =>
								el(
									"li",
									{ class: "activity-row" },
									el(
										"div",
										{ class: "activity-row__text" },
										el("span", { class: "activity-row__name" }, activityName(activity)),
										el(
											"span",
											{ class: "field__hint" },
											[
												statusLabel(activity),
												`actualizada ${formatDateTime(activity.updatedAt)}`,
												`${activity.game.words.length} palabras`,
												activity.game.approvedVariantId ? "cuadrícula aprobada" : "sin cuadrícula aprobada",
											].join(" · "),
										),
									),
									el(
										"div",
										{ class: "row" },
										el(
											"button",
											{
												class: "btn btn--ghost btn--small",
												type: "button",
												onclick: () => {
													void open(activity.id);
												},
											},
											"Abrir",
										),
										el(
											"button",
											{
												class: "btn btn--ghost btn--small",
												type: "button",
												onclick: () => {
													void duplicate(activity);
												},
											},
											"Duplicar",
										),
									),
								),
							),
						),
			),
		);
	}

	function render() {
		if (state.loading) {
			clear(root);
			root.append(el("p", { class: "field__hint" }, "Cargando actividades…"));
			return;
		}
		if (state.draft) renderEditor();
		else renderList();
	}

	void (async () => {
		await refreshList();
		state.loading = false;
		if (selectedActivityId) {
			state.draft = await getActivity(db, selectedActivityId);
			if (state.draft) {
				state.variantId = state.draft.game.approvedVariantId || state.draft.game.variants[0]?.id || "";
				state.saveState = "saved";
				state.lastSavedAt = state.draft.updatedAt;
			}
		}
		render();
	})();

	return { element: root };
}

function swapWords(activity, left, right) {
	const words = activity.game.words;
	if (left < 0 || right < 0 || left >= words.length || right >= words.length) return;
	[words[left], words[right]] = [words[right], words[left]];
}
