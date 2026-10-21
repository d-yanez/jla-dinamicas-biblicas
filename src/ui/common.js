// Shared chrome: header, footer, the discreet admin gear, dialogs and notices.

import { el, uniqueId } from "./dom.js";
import { formatVersion } from "../core/version.js";
import { renderIcon } from "./icons.js";

export function renderHeader() {
	return el(
		"header",
		{ class: "site-header" },
		el(
			"div",
			{ class: "site-header__inner" },
			el(
				"a",
				{ class: "brand-mark", href: "#/", "aria-label": "JLA Dinámicas Bíblicas, ir al inicio" },
				renderIcon("flame", "flame"),
				el("span", { class: "brand-mark__name" }, "JLA"),
				el("span", { class: "brand-mark__divider", "aria-hidden": "true" }),
				el("span", { class: "brand-mark__tagline" }, "Dinámicas Bíblicas"),
			),
		),
	);
}

export function renderFooter(version = "") {
	const label = formatVersion(version);
	return el(
		"footer",
		{ class: "site-footer" },
		el(
			"div",
			{ class: "site-footer__inner" },
			el("p", {}, "JLA · Dinámicas Bíblicas"),
			el("p", {}, [label ? `${label} · ` : "", "Los datos se guardan solo en este dispositivo."].join("")),
		),
	);
}

/** Discreet admin entry point, bottom corner of every public screen. */
export function renderGear() {
	return el(
		"a",
		{ class: "gear", href: "#/admin", title: "Administrar", "aria-label": "Administrar" },
		renderIcon("gear"),
	);
}

export function renderEmptyState({ title, description, actions = [] }) {
	return el(
		"section",
		{ class: "empty-state" },
		renderIcon("inbox", "empty-state__icon"),
		el("h2", { class: "empty-state__title" }, title),
		description ? el("p", { class: "empty-state__desc" }, description) : null,
		actions.length > 0 ? el("div", { class: "row row--center" }, ...actions) : null,
	);
}

export function renderError(message) {
	return el(
		"div",
		{ class: "panel panel--warning stack", role: "alert" },
		el("h2", { class: "panel__title" }, "No se pudo continuar"),
		el("p", {}, message),
		el(
			"div",
			{ class: "form-actions" },
			el("a", { class: "btn btn--primary", href: "#/" }, "Volver al inicio"),
			el("button", { class: "btn btn--ghost", type: "button", onclick: () => location.reload() }, "Recargar la aplicación"),
		),
	);
}

/** Creates a native modal dialog; Esc and backdrop behavior come from the browser. */
export function createDialog(title) {
	const dialog = el("dialog", { class: "jla-dialog" });
	const titleId = uniqueId("dialog-title");
	const content = el("div", { class: "jla-dialog__content" });
	const body = el(
		"div",
		{ class: "jla-dialog__body" },
		el("h2", { id: titleId, class: "jla-dialog__title" }, title),
		content,
	);
	dialog.setAttribute("aria-labelledby", titleId);
	dialog.append(body);
	dialog.addEventListener("close", () => dialog.remove());
	return {
		dialog,
		body,
		content,
		open() {
			if (dialog.isConnected) return;
			document.body.append(dialog);
			if (typeof dialog.showModal === "function") dialog.showModal();
			else dialog.setAttribute("open", "");
		},
		close() {
			if (typeof dialog.close === "function" && dialog.open) dialog.close();
			else dialog.remove();
		},
	};
}

/** Resolves true only when the moderator explicitly confirms. */
export function confirmDialog({ title, message, confirmLabel = "Continuar", cancelLabel = "Cancelar", danger = false }) {
	return new Promise((resolve) => {
		const sheet = createDialog(title);
		let answered = false;
		const finish = (value) => {
			if (answered) return;
			answered = true;
			sheet.close();
			resolve(value);
		};
		sheet.content.append(
			el("p", {}, message),
			el(
				"div",
				{ class: "jla-dialog__actions" },
				el("button", { class: "btn btn--ghost", type: "button", onclick: () => finish(false) }, cancelLabel),
				el(
					"button",
					{ class: `btn ${danger ? "btn--danger" : "btn--primary"}`, type: "button", onclick: () => finish(true) },
					confirmLabel,
				),
			),
		);
		sheet.dialog.addEventListener("cancel", (event) => {
			event.preventDefault();
			finish(false);
		});
		sheet.dialog.addEventListener("close", () => finish(false));
		sheet.open();
	});
}
