// Shared chrome for the activity editors: header, common fields, requirement check and
// the activity list. Each game supplies only its own section, so the fields, the
// autosave indicator and the list behave identically in both games.

import { ACTIVITY_STATUS, ROUND_SECONDS } from "../core/activity-model.js";
import { defaultInstructionsFor, renderInstructions } from "../core/instructions.js";
import { confirmDialog } from "./common.js";
import { clear, el, uniqueId } from "./dom.js";
import { createDraftSession } from "./draft-session.js";
import { formatDateTime } from "./format.js";

const TYPE_COPY = Object.freeze({
	sopa: {
		label: "Sopa de letras",
		listTitle: "Actividades de sopa de letras",
		listDescription: "Borradores guardados en este dispositivo. La cuadrícula se genera una vez y queda guardada.",
	},
	palabras: {
		label: "Palabras desordenadas",
		listTitle: "Actividades de palabras desordenadas",
		listDescription: "Borradores guardados en este dispositivo. Cada palabra tiene su solución y su anagrama validado.",
	},
});

function statusLabel(activity) {
	return activity.status === ACTIVITY_STATUS.PUBLISHED ? "Publicada" : "Borrador";
}

function activityName(activity) {
	return activity.name.trim().length > 0 ? activity.name : "Actividad sin nombre";
}

function saveLabel(state) {
	if (state.saveState === "saving") return "Guardando…";
	if (state.saveState === "dirty") return "Cambios sin guardar";
	if (state.saveState === "saved") return state.lastSavedAt ? `Guardado ${formatDateTime(state.lastSavedAt)}` : "Guardado";
	return "";
}

function textField({ label, value, onInput, hint, multiline = false, type = "text", attrs = {} }) {
	const id = uniqueId("campo");
	const input = multiline
		? el("textarea", { class: "input input--area", id, rows: 3, value })
		: el("input", { class: "input", id, type, value, ...attrs });
	input.addEventListener("input", () => onInput(input.value));
	return el(
		"div",
		{ class: "field" },
		el("label", { class: "field__label", for: id }, label),
		input,
		hint ? el("span", { class: "field__hint" }, hint) : undefined,
	);
}

export function mountActivityEditor({ db, type, renderGame }) {
	const copy = TYPE_COPY[type] ?? TYPE_COPY.sopa;
	const root = el("div", { class: "stack" });
	const session = createDraftSession({ db, type });
	const nodes = {};
	let game = undefined;

	const markDirty = () => session.markDirty();

	function renderFields(draft) {
		const grid = el("div", { class: "field-grid" });
		const instructionsPreview = el("p", { class: "field__hint" }, `Vista previa: ${renderInstructions(draft)}`);
		const instructionsId = "campo-instrucciones";
		const instructions = el("textarea", {
			class: "input input--area",
			id: instructionsId,
			rows: 4,
			value: draft.instructions,
		});
		instructions.addEventListener("input", () => {
			draft.instructions = instructions.value;
			instructionsPreview.textContent = `Vista previa: ${renderInstructions(draft)}`;
			markDirty();
		});

		grid.append(
			textField({
				label: "Nombre de la actividad",
				value: draft.name,
				onInput: (value) => {
					draft.name = value;
					if (nodes.title) nodes.title.textContent = activityName(draft);
					markDirty();
				},
			}),
			textField({ label: "Tema bíblico", value: draft.theme, onInput: (value) => { draft.theme = value; markDirty(); } }),
			textField({
				label: "Referencia bíblica",
				value: draft.reference,
				hint: "Opcional. Solo la referencia, sin transcribir el texto.",
				onInput: (value) => { draft.reference = value; markDirty(); },
			}),
			textField({ label: "Enseñanza", value: draft.teaching, multiline: true, hint: "Opcional.", onInput: (value) => { draft.teaching = value; markDirty(); } }),
			textField({
				label: "Duración por ronda (segundos)",
				value: String(draft.roundSeconds),
				type: "number",
				attrs: { min: String(ROUND_SECONDS.min), max: String(ROUND_SECONDS.max), step: "1", inputmode: "numeric" },
				hint: `Entre ${ROUND_SECONDS.min} y ${ROUND_SECONDS.max}. Se usa en las diez rondas.`,
				onInput: (value) => {
					const seconds = Number.parseInt(value, 10);
					if (Number.isInteger(seconds)) draft.roundSeconds = seconds;
					markDirty();
				},
			}),
			el(
				"div",
				{ class: "field" },
				el("label", { class: "field__label", for: instructionsId }, "Instrucciones introductorias"),
				instructions,
				el(
					"p",
					{ class: "field__hint" },
					"Se muestra antes de empezar. Escribí {{duracion}} para insertar el reloj de cada ronda.",
				),
				el(
					"button",
					{
						class: "btn btn--ghost btn--small",
						type: "button",
						onclick: () => {
							draft.instructions = defaultInstructionsFor(type);
							instructions.value = draft.instructions;
							instructionsPreview.textContent = `Vista previa: ${renderInstructions(draft)}`;
							markDirty();
						},
					},
					"Usar la plantilla del juego",
				),
				instructionsPreview,
			),
			textField({
				label: "Reflexión final",
				value: draft.reflection,
				multiline: true,
				hint: "Opcional. Se muestra en una pantalla aparte al terminar.",
				onInput: (value) => { draft.reflection = value; markDirty(); },
			}),
			textField({ label: "Referencia de la reflexión", value: draft.reflectionReference, hint: "Opcional.", onInput: (value) => { draft.reflectionReference = value; markDirty(); } }),
			textField({ label: "Nombre del evento", value: draft.eventName, hint: "Opcional. Aparece en el PDF solo si está configurado.", onInput: (value) => { draft.eventName = value; markDirty(); } }),
			textField({ label: "Fecha del evento", value: draft.eventDate, type: "date", onInput: (value) => { draft.eventDate = value; markDirty(); } }),
		);
		return grid;
	}

	function renderNotice() {
		if (!nodes.notice?.isConnected) return;
		nodes.notice.textContent = session.state.notice;
		nodes.notice.hidden = session.state.notice.length === 0;
	}

	function renderRequirements() {
		const box = nodes.requirements;
		if (!box?.isConnected) return;
		clear(box);
		const result = session.state.requirements;
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

	async function publish() {
		const confirmed = await confirmDialog({
			title: "Publicar esta actividad",
			message:
				"El público va a jugar esta actividad desde la portada. Si hay otra publicada de este juego, deja de estarlo. El contenido se valida antes de publicar.",
			confirmLabel: "Publicar",
			cancelLabel: "Cancelar",
		});
		if (!confirmed) return;
		await session.publish();
	}

	async function unpublish() {
		const confirmed = await confirmDialog({
			title: "Despublicar",
			message: "Deja de estar disponible para jugar. El contenido y sus datos se conservan.",
			confirmLabel: "Despublicar",
			cancelLabel: "Cancelar",
		});
		if (confirmed) await session.unpublish();
	}

	function renderEditor() {
		const draft = session.state.draft;
		clear(root);
		nodes.indicator = el("span", { class: "save-indicator", role: "status" }, saveLabel(session.state));
		nodes.title = el("h2", { class: "settings-group__title" }, activityName(draft));
		nodes.notice = el("p", { class: "notice notice--info", hidden: session.state.notice.length === 0 }, session.state.notice);
		nodes.requirements = el("div", { class: "stack" });

		game = renderGame({ session, nodes });

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
						el(
							"p",
							{ class: "hero__eyebrow" },
							`${statusLabel(draft)}${draft.originId ? " de la publicada" : ""} · ${copy.label}`,
							draft.status === ACTIVITY_STATUS.PUBLISHED ? el("span", { class: "badge badge--gold", style: "margin-left:.5rem" }, "Publicada") : undefined,
						),
						nodes.title,
					),
					el(
						"div",
						{ class: "row" },
						nodes.indicator,
						draft.status === ACTIVITY_STATUS.PUBLISHED
							? el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => void unpublish() }, "Despublicar")
							: el("button", { class: "btn btn--primary btn--small", type: "button", onclick: () => void publish() }, "Publicar"),
						el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => void session.flush() }, "Guardar ahora"),
						el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => void session.backToList() }, "Volver a la lista"),
					),
				),
				nodes.notice,
				renderFields(draft),
				el("hr", { class: "divider" }),
				game.element,
				el("hr", { class: "divider" }),
				el("div", { class: "row" }, el("button", { class: "btn btn--small", type: "button", onclick: () => void session.verifyRequirements() }, "Verificar requisitos")),
				nodes.requirements,
				el("p", { class: "field__hint" }, "Los borradores se guardan solos. Nunca se publican automáticamente."),
			),
		);
		if (session.state.requirements) renderRequirements();
	}

	function renderList() {
		clear(root);
		game = undefined;
		root.append(
			el(
				"section",
				{ class: "panel stack" },
				el(
					"div",
					{ class: "row row--between" },
					el("div", {}, el("h2", { class: "settings-group__title" }, copy.listTitle), el("p", { class: "settings-group__desc" }, copy.listDescription)),
					el("button", { class: "btn btn--primary btn--small", type: "button", onclick: () => void session.createNew() }, "Nueva actividad"),
				),
				session.state.activities.length === 0
					? el("p", { class: "field__hint" }, "Todavía no hay actividades. Creá la primera con «Nueva actividad».")
					: el(
							"ul",
							{ class: "activity-list" },
							...session.state.activities.map((activity) =>
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
											[statusLabel(activity), `actualizada ${formatDateTime(activity.updatedAt)}`, ...describeGame(activity)].join(" · "),
										),
									),
									el(
										"div",
										{ class: "row" },
										el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => void session.open(activity.id) }, "Abrir"),
										el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => void session.duplicate(activity) }, "Duplicar"),
									),
								),
							),
						),
			),
		);
	}

	function render() {
		if (session.state.loading) {
			clear(root);
			root.append(el("p", { class: "field__hint" }, "Cargando actividades…"));
			return;
		}
		if (session.state.draft) renderEditor();
		else renderList();
	}

	session.subscribe((event, payload) => {
		if (event === "save-state") {
			if (nodes.indicator?.isConnected) nodes.indicator.textContent = saveLabel(session.state);
			return;
		}
		if (event === "title") {
			if (nodes.title?.isConnected && session.state.draft) nodes.title.textContent = activityName(session.state.draft);
			return;
		}
		if (event === "notice") {
			renderNotice();
			return;
		}
		if (event === "requirements") {
			renderRequirements();
			return;
		}
		if (event === "saved") {
			if (payload?.approvalWithdrawn) session.setNotice("Las palabras cambiaron: la aprobación se retiró porque la cuadrícula ya no coincide. Podés aprobarla de nuevo o generar otra.");
			game?.onEvent?.("saved", payload);
			return;
		}
		if (event === "open") render();
	});

	void (async () => {
		await session.restore();
		session.state.loading = false;
		render();
	})();

	return { element: root, dispose: () => session.dispose() };
}

function describeGame(activity) {
	if (activity.type === "palabras") {
		const ties = activity.game.tiebreakers.length;
		return [`${activity.game.words.length} palabras`, `${ties} desempates`];
	}
	return [`${activity.game.words.length} palabras`, activity.game.approvedVariantId ? "cuadrícula aprobada" : "sin cuadrícula aprobada"];
}
