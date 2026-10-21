// Admin security actions: change PIN, download the recovery file, import a
// recovery file, and lock the session. All of them are UI only; the app owns the
// storage writes so there is exactly one place that persists security state.

import { confirmDialog, createDialog } from "./common.js";
import { readFileText } from "./download.js";
import { el, uniqueId } from "./dom.js";
import { errorLine, hideError, pinField, showError } from "./fields.js";

export function renderSecurityGroup({ downloaded, actions }) {
	const hint = downloaded
		? "El PIN protege este panel en este dispositivo. Al cambiarlo se genera un archivo de recuperación nuevo."
		: "Todavía no descargaste el archivo de recuperación de este dispositivo. Sin él, un PIN olvidado deja el panel inaccesible.";
	return el(
		"section",
		{ class: "settings-group", "aria-labelledby": "group-security" },
		el("h2", { class: "settings-group__title", id: "group-security" }, "Seguridad"),
		el("p", { class: "settings-group__desc" }, hint),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "PIN de administración"),
				el("span", { class: "setting-row__hint" }, "Se pide al volver desde la portada, no entre las secciones del panel."),
			),
			el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: actions.changePin }, "Cambiar PIN"),
		),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "Archivo de recuperación"),
				el("span", { class: "setting-row__hint" }, "Guardalo fuera del navegador. Es propio de este dispositivo."),
			),
			el(
				"button",
				{ class: "btn btn--ghost btn--small", type: "button", onclick: actions.downloadRecovery },
				"Descargar",
			),
		),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "Usar un archivo de recuperación"),
				el("span", { class: "setting-row__hint" }, "Define un PIN nuevo sin tocar las actividades guardadas."),
			),
			el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: actions.useRecovery }, "Usar archivo"),
		),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "Cerrar sesión de administrador"),
				el("span", { class: "setting-row__hint" }, "Vuelve a la portada y pide el PIN en el próximo ingreso."),
			),
			el("button", { class: "btn btn--danger btn--small", type: "button", onclick: actions.lock }, "Cerrar sesión"),
		),
	);
}

/** Dialog to change the PIN. Resolves through onChangePin(current, next). */
export function openChangePinDialog({ onChangePin, onChanged }) {
	const sheet = createDialog("Cambiar el PIN");
	const current = pinField({ label: "PIN actual", autofocus: true });
	const next = pinField({ label: "PIN nuevo" });
	const repeat = pinField({ label: "Repetí el PIN nuevo" });
	const error = errorLine();
	const submit = el("button", { class: "btn btn--primary", type: "submit" }, "Guardar PIN");

	const form = el(
		"form",
		{ class: "stack", novalidate: true },
		current.field,
		next.field,
		repeat.field,
		error,
		el(
			"div",
			{ class: "jla-dialog__actions" },
			el("button", { class: "btn btn--ghost", type: "button", onclick: () => sheet.close() }, "Cancelar"),
			submit,
		),
	);

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		hideError(error);
		if (next.input.value.trim() !== repeat.input.value.trim()) {
			showError(error, "Los dos PIN nuevos no coinciden.");
			repeat.input.value = "";
			repeat.input.focus();
			return;
		}
		submit.disabled = true;
		submit.textContent = "Guardando…";
		try {
			const result = await onChangePin(current.input.value, next.input.value);
			if (!result?.ok) {
				showError(error, result?.error ?? "No se pudo cambiar el PIN.");
				return;
			}
			sheet.close();
			onChanged?.(result);
		} finally {
			submit.disabled = false;
			submit.textContent = "Guardar PIN";
		}
	});

	sheet.content.append(form);
	sheet.open();
	return sheet;
}

/**
 * Two-phase recovery import: pick and validate the file, then set a new PIN.
 * A file from another device is rejected before the moderator types anything.
 */
export function startRecoveryImport({ onImportText, onSetPin, onDone }) {
	const sheet = createDialog("Archivo de recuperación de PIN");

	const renderPick = () => {
		const error = errorLine();
		const inputId = uniqueId("recovery-file");
		const input = el("input", { class: "input", id: inputId, type: "file", accept: ".json,application/json" });
		const verify = el("button", { class: "btn btn--primary", type: "button" }, "Verificar archivo");

		verify.addEventListener("click", async () => {
			hideError(error);
			const file = input.files?.[0];
			if (!file) {
				showError(error, "Elegí el archivo de recuperación (.json).");
				return;
			}
			verify.disabled = true;
			verify.textContent = "Verificando…";
			try {
				let text;
				try {
					text = await readFileText(file);
				} catch {
					showError(error, "No se pudo leer el archivo. Probá de nuevo.");
					return;
				}
				const result = onImportText(text);
				if (!result?.ok) {
					showError(error, result?.error ?? "El archivo no es válido.");
					return;
				}
				renderNewPin();
			} finally {
				verify.disabled = false;
				verify.textContent = "Verificar archivo";
			}
		});

		sheet.content.replaceChildren(
			el(
				"div",
				{ class: "stack" },
				el("p", {}, "Elegí el archivo .json que descargaste al configurar el PIN en este dispositivo."),
				el("div", { class: "field" }, el("label", { class: "field__label", for: inputId }, "Archivo de recuperación"), input),
				error,
				el(
					"div",
					{ class: "jla-dialog__actions" },
					el("button", { class: "btn btn--ghost", type: "button", onclick: () => sheet.close() }, "Cancelar"),
					verify,
				),
			),
		);
	};

	const renderNewPin = () => {
		const error = errorLine();
		const first = pinField({ label: "PIN nuevo", autofocus: true });
		const second = pinField({ label: "Repetí el PIN nuevo" });
		const submit = el("button", { class: "btn btn--primary", type: "submit" }, "Guardar PIN nuevo");

		const form = el(
			"form",
			{ class: "stack", novalidate: true },
			el("p", {}, "El archivo corresponde a este dispositivo. Definí un PIN nuevo: las actividades no se modifican."),
			first.field,
			second.field,
			error,
			el(
				"div",
				{ class: "jla-dialog__actions" },
				el("button", { class: "btn btn--ghost", type: "button", onclick: () => sheet.close() }, "Cancelar"),
				submit,
			),
		);

		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			hideError(error);
			if (first.input.value.trim() !== second.input.value.trim()) {
				showError(error, "Los dos PIN no coinciden.");
				second.input.value = "";
				second.input.focus();
				return;
			}
			submit.disabled = true;
			submit.textContent = "Guardando…";
			try {
				const result = await onSetPin(first.input.value);
				if (!result?.ok) {
					showError(error, result?.error ?? "No se pudo guardar el PIN.");
					return;
				}
				sheet.close();
				onDone?.(result);
			} finally {
				submit.disabled = false;
				submit.textContent = "Guardar PIN nuevo";
			}
		});

		sheet.content.replaceChildren(form);
	};

	renderPick();
	sheet.open();
	return sheet;
}

/** Shown right after the PIN is created: the recovery file is the safety net. */
export function openRecoveryDownloadDialog({ onDownload, onDone }) {
	const sheet = createDialog("Guardá el archivo de recuperación");
	let downloaded = false;
	const status = el("p", { class: "field__hint", role: "status" }, "");

	const download = el(
		"button",
		{
			class: "btn btn--primary",
			type: "button",
			onclick: async () => {
				download.disabled = true;
				try {
					// Await the write so "downloaded" is only claimed once the record is stored.
					const result = await onDownload();
					downloaded = result?.downloaded ?? true;
					status.textContent =
						result?.marked === false
							? "El archivo se descargó, pero no se pudo registrar el aviso en este dispositivo."
							: "Archivo descargado. Guardalo fuera del navegador.";
				} catch {
					status.textContent = "No se pudo confirmar la descarga. Revisá la carpeta de descargas.";
				} finally {
					download.disabled = false;
				}
			},
		},
		"Descargar archivo",
	);

	const done = el(
		"button",
		{
			class: "btn btn--ghost",
			type: "button",
			onclick: async () => {
				if (!downloaded) {
					const confirmed = await confirmDialog({
						title: "Continuar sin descargar",
						message:
							"Sin este archivo no vas a poder definir un PIN nuevo si olvidás el actual. Podés descargarlo más adelante desde Configuración general, en el panel.",
						confirmLabel: "Continuar igual",
						cancelLabel: "Volver",
						danger: true,
					});
					if (!confirmed) return;
				}
				sheet.close();
				onDone?.();
			},
		},
		"Listo",
	);

	sheet.content.append(
		el(
			"div",
			{ class: "stack" },
			el(
				"p",
				{},
				"El archivo de recuperación permite definir un PIN nuevo si olvidás el actual. Es propio de este dispositivo y queda fuera de todos los respaldos.",
			),
			el("p", {}, "Guardalo en un lugar seguro, por ejemplo en una carpeta del grupo o impreso junto al material."),
			status,
			el("div", { class: "jla-dialog__actions" }, done, download),
		),
	);
	sheet.open();
	return sheet;
}
