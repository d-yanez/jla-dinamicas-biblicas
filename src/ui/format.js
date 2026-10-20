// Human-readable dates for the admin panel. es-CL, because the group reads them.

const DATE_TIME = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" });
const DATE_ONLY = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

function parse(value) {
	if (typeof value !== "string" || value.length === 0) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDateTime(value) {
	const date = parse(value);
	return date ? DATE_TIME.format(date) : "";
}

export function formatDate(value) {
	const date = parse(value);
	return date ? DATE_ONLY.format(date) : "";
}

/** A `YYYY-MM-DD` value from a date input, without timezone surprises. */
export function toDateInputValue(value) {
	const date = parse(value);
	if (!date) return "";
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}
