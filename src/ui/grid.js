// Renders a stored sopa variant as a table with numbered rows and columns.
//
// A table (not a canvas and not CSS-positioned divs) keeps the grid readable, selectable
// and printable, which phase 6 needs, and gives every cell a real position for anyone
// using a screen reader. Highlighting a solution paints the cells of one word so the
// moderator can check an answer at a glance.

import { directionById, pathCells } from "../core/sopa.js";
import { el } from "./dom.js";

// Ten hues with different lightness, so they stay distinguishable on a projector and
// still separate in grayscale for the black-and-white printout.
export const SOLUTION_COLORS = Object.freeze([
	"#f6d365",
	"#f4a261",
	"#a7d08c",
	"#8ecae6",
	"#c8b6e2",
	"#f4a6c0",
	"#bfe0b0",
	"#efc98b",
	"#9dc6d8",
	"#e3a6a6",
]);

export function renderSopaGrid({ variant, highlights = new Map(), label = "Cuadrícula de la sopa de letras" }) {
	const size = variant.size;
	const table = el("table", { class: "sopa-grid", "aria-label": label });
	const headRow = el("tr", {}, el("th", { class: "sopa-grid__corner", scope: "col" }, ""));
	for (let col = 1; col <= size; col += 1) {
		headRow.append(el("th", { class: "sopa-grid__head", scope: "col" }, String(col)));
	}
	table.append(el("thead", {}, headRow));

	const body = el("tbody");
	for (let row = 0; row < size; row += 1) {
		const tr = el("tr", {});
		tr.append(el("th", { class: "sopa-grid__head", scope: "row" }, String(row + 1)));
		for (let col = 0; col < size; col += 1) {
			const index = row * size + col;
			const colorIndex = highlights.get(index);
			const cell = el(
				"td",
				{ class: colorIndex === undefined ? "sopa-grid__cell" : "sopa-grid__cell sopa-grid__cell--solved" },
				variant.grid[index] ?? "",
			);
			if (colorIndex !== undefined) cell.style.setProperty("--cell-color", SOLUTION_COLORS[colorIndex % SOLUTION_COLORS.length]);
			tr.append(cell);
		}
		body.append(tr);
	}
	table.append(body);
	return table;
}

/** Cell index → color slot, for every word of the variant. */
export function solutionHighlights(variant) {
	const highlights = new Map();
	(variant?.placements ?? []).forEach((placement, order) => {
		const cells = pathCells({
			size: variant.size,
			start: placement.start,
			directionId: placement.direction,
			length: placement.normalized.length,
		});
		for (const index of cells ?? []) highlights.set(index, order);
	});
	return highlights;
}

/** The moderator's answer key: word, direction and start/end coordinates (1-based). */
export function solutionRows(variant, words = []) {
	const byId = new Map(words.map((word) => [word.id, word]));
	return (variant?.placements ?? []).map((placement, order) => ({
		index: order,
		text: byId.get(placement.wordId)?.text ?? placement.normalized,
		normalized: placement.normalized,
		direction: directionById(placement.direction)?.label ?? placement.direction,
		start: `fila ${placement.start.row + 1}, columna ${placement.start.col + 1}`,
		end: `fila ${placement.end.row + 1}, columna ${placement.end.col + 1}`,
	}));
}
