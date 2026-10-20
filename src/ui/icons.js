// Inline SVG icons.
//
// Built with createElementNS from data (viewBox, tag names, path `d` strings), so
// the app never parses markup. The glyphs are internal constants, not user input.

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const FLAME_PATH =
	"M16 5c1.9 3.1 1.1 5.2-.4 7.1-1.6 2.1-1.9 4-.5 5.6 1.3-1.1 1.9-2.6 2-4.3 2.6 2.6 4 5 4 7.3 0 3.6-2.4 6.3-5.8 6.3-3.6 0-6-2.5-6-6.1 0-2.6 1.1-4.6 3.1-6.6C14.6 12.1 15.9 9 16 5z";

const GEAR_PATH =
	"M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z";

const STROKE = { fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round" };

const ICONS = {
	flame: {
		viewBox: "0 0 32 32",
		parts: [{ tag: "path", attrs: { d: FLAME_PATH, fill: "currentColor" } }],
	},
	gear: {
		viewBox: "0 0 24 24",
		parts: [
			{ tag: "circle", attrs: { cx: "12", cy: "12", r: "3.2", ...STROKE, "stroke-width": "1.8" } },
			{ tag: "path", attrs: { d: GEAR_PATH, ...STROKE, "stroke-width": "1.8" } },
		],
	},
	inbox: {
		viewBox: "0 0 24 24",
		parts: [
			{ tag: "path", attrs: { d: "M3 12h4l1.5 3h7L17 12h4", ...STROKE } },
			{ tag: "path", attrs: { d: "M5.5 5h13l2.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z", ...STROKE } },
		],
	},
};

function svgNode(tag, attrs) {
	const node = document.createElementNS(SVG_NAMESPACE, tag);
	for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
	return node;
}

/** Returns an icon element, decorative by default (aria-hidden). */
export function renderIcon(name, className = "") {
	const spec = ICONS[name];
	if (!spec) throw new Error(`Icono desconocido: ${name}`);
	const svg = svgNode("svg", { viewBox: spec.viewBox, "aria-hidden": "true", focusable: "false" });
	if (className) svg.setAttribute("class", className);
	for (const part of spec.parts) svg.append(svgNode(part.tag, part.attrs));
	return svg;
}
