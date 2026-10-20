// Form primitives shared by the PIN screens so validation copy stays identical.

import { uniqueId } from "./dom.js";
import { el } from "./dom.js";

/** Four-digit PIN field: numeric keypad on touch, never autocompleted. */
export function pinField({ label, hint, autofocus = false }) {
	const id = uniqueId("pin");
	const input = el("input", {
		class: "input input--pin",
		id,
		name: id,
		type: "password",
		inputmode: "numeric",
		pattern: "\\d{4}",
		maxlength: 4,
		autocomplete: "off",
		required: true,
		"aria-describedby": hint ? `${id}-hint` : undefined,
	});
	const field = el(
		"div",
		{ class: "field" },
		el("label", { class: "field__label", for: id }, label),
		input,
		hint ? el("span", { class: "field__hint", id: `${id}-hint` }, hint) : undefined,
	);
	if (autofocus) queueMicrotask(() => input.focus());
	return { field, input };
}

export function errorLine() {
	return el("p", { class: "form-error", role: "alert", hidden: true });
}

export function showError(node, message) {
	node.textContent = message;
	node.hidden = false;
}

export function hideError(node) {
	node.hidden = true;
	node.textContent = "";
}
