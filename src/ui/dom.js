// Tiny DOM helpers. No framework, no build step: everything here is plain DOM so
// the published site stays a set of static files.

let idCounter = 0;

export function uniqueId(prefix = "jla") {
	idCounter += 1;
	return `${prefix}-${idCounter}`;
}

function appendChildren(target, children) {
	for (const child of children) {
		if (child === null || child === undefined || child === false) continue;
		if (Array.isArray(child)) {
			appendChildren(target, child);
			continue;
		}
		if (child instanceof Node) {
			target.append(child);
			continue;
		}
		target.append(document.createTextNode(String(child)));
	}
}

/**
 * Creates an element. Props are applied in a predictable order:
 * class/text/dataset are special, on* become listeners, dashed, aria and role
 * attributes use setAttribute, real DOM properties are assigned, the rest fall back
 * to attributes. Nullish and false values are skipped so conditional props stay easy.
 *
 * The app never assigns HTML strings: every node is built from data, so there is no
 * injection surface even if a future activity name contains markup.
 */
export function el(tag, props = {}, ...children) {
	const node = document.createElement(tag);
	for (const [key, value] of Object.entries(props ?? {})) {
		if (value === undefined || value === null || value === false) continue;
		if (key === "class") {
			node.className = value;
			continue;
		}
		if (key === "text") {
			node.textContent = String(value);
			continue;
		}
		if (key === "dataset") {
			Object.assign(node.dataset, value);
			continue;
		}
		if (key.startsWith("on") && typeof value === "function") {
			node.addEventListener(key.slice(2).toLowerCase(), value);
			continue;
		}
		if (key.includes("-") || key.startsWith("aria") || key === "role") {
			node.setAttribute(key, value === true ? "" : String(value));
			continue;
		}
		if (key in node) {
			node[key] = value;
			continue;
		}
		node.setAttribute(key, String(value));
	}
	appendChildren(node, children);
	return node;
}

export function clear(node) {
	node.replaceChildren();
	return node;
}

export function append(target, ...children) {
	appendChildren(target, children);
	return target;
}
