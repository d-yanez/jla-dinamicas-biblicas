// PIN screens for the administration area: first-time setup and unlock.
//
// Both screens are thin: they validate what the moderator typed and delegate the
// real work (hashing, storage, unlock) to the callbacks the app passes in.

import { normalizePin } from "../core/pin.js";
import { el } from "./dom.js";
import { errorLine, hideError, pinField, showError } from "./fields.js";

export function renderPinSetup({ onSubmit }) {
	const first = pinField({ label: "PIN de cuatro dígitos", autofocus: true });
	const second = pinField({ label: "Repetí el PIN" });
	const error = errorLine();
	const submit = el("button", { class: "btn btn--primary btn--block", type: "submit" }, "Crear PIN y continuar");

	const form = el(
		"form",
		{ class: "panel panel--narrow stack", novalidate: true },
		el("h1", { class: "panel__title" }, "Configurar el PIN de administración"),
		el("p", {}, "El PIN protege el acceso al panel de administración. Tiene cuatro dígitos y se guarda solo en este dispositivo."),
		first.field,
		second.field,
		error,
		submit,
		el("p", { class: "field__hint" }, "Al crearlo vas a poder descargar un archivo de recuperación para no quedar fuera del panel."),
	);

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		hideError(error);
		const pin = normalizePin(first.input.value);
		if (pin === undefined) {
			showError(error, "El PIN debe tener exactamente cuatro dígitos.");
			first.input.focus();
			return;
		}
		if (pin !== normalizePin(second.input.value)) {
			showError(error, "Los dos PIN no coinciden.");
			second.input.value = "";
			second.input.focus();
			return;
		}
		submit.disabled = true;
		submit.textContent = "Creando…";
		try {
			const result = await onSubmit(pin);
			if (!result?.ok) showError(error, result?.error ?? "No se pudo crear el PIN.");
		} finally {
			submit.disabled = false;
			submit.textContent = "Crear PIN y continuar";
		}
	});

	return el("main", { class: "page", id: "contenido", tabindex: "-1" }, form);
}

export function renderPinUnlock({ onSubmit, onUseRecovery }) {
	const field = pinField({ label: "PIN de administración", autofocus: true });
	const error = errorLine();
	const submit = el("button", { class: "btn btn--primary btn--block", type: "submit" }, "Entrar");

	const form = el(
		"form",
		{ class: "panel panel--narrow stack", novalidate: true },
		el("h1", { class: "panel__title" }, "Panel de administración"),
		el("p", {}, "Ingresá el PIN para administrar las actividades de este dispositivo."),
		field.field,
		error,
		submit,
	);

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		hideError(error);
		const pin = normalizePin(field.input.value);
		if (pin === undefined) {
			showError(error, "El PIN debe tener exactamente cuatro dígitos.");
			field.input.focus();
			return;
		}
		submit.disabled = true;
		submit.textContent = "Verificando…";
		try {
			const result = await onSubmit(pin);
			if (!result?.ok) {
				showError(error, result?.error ?? "PIN incorrecto. Probá de nuevo.");
				field.input.value = "";
				field.input.focus();
			}
		} finally {
			submit.disabled = false;
			submit.textContent = "Entrar";
		}
	});

	return el(
		"main",
		{ class: "page", id: "contenido", tabindex: "-1" },
		form,
		el(
			"div",
			{ class: "panel panel--narrow stack", style: "margin-top:1.5rem" },
			el("p", { class: "setting-row__label" }, "¿No recordás el PIN?"),
			el(
				"p",
				{ class: "setting-row__hint" },
				"Usá el archivo de recuperación que descargaste al configurarlo. Permite definir un PIN nuevo sin perder las actividades.",
			),
			el("button", { class: "btn btn--ghost", type: "button", onclick: () => onUseRecovery?.() }, "Usar archivo de recuperación"),
		),
		el("div", { class: "row row--center", style: "margin-top:1.5rem" }, el("a", { class: "btn btn--ghost btn--small", href: "#/" }, "Volver al inicio")),
	);
}
