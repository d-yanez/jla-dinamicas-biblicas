// Introductory instructions as a per-game template with the round clock interpolated.
// The wording lives here so the editor, the future projection screen and the printout
// all show the same text for the same activity.

// Local copy of the round default: importing it from the activity model would create a
// cycle (the model imports this module for its defaults).
const FALLBACK_ROUND_SECONDS = 30;

export const INSTRUCTION_TEMPLATES = Object.freeze({
	sopa:
		"Vamos a jugar a la sopa de letras. Trabajen en parejas: en cada ronda se muestra una palabra y tienen {{duracion}} para encontrarla y marcarla en la hoja. Son diez rondas; al final revisamos juntos las soluciones.",
	palabras:
		"Vamos a jugar a las palabras desordenadas. En cada ronda se muestra una palabra con las letras mezcladas y tienen {{duracion}} para escribir la solución. Son diez rondas y cada palabra tiene hasta dos pistas.",
});

export function defaultInstructionsFor(type) {
	return typeof INSTRUCTION_TEMPLATES[type] === "string" ? INSTRUCTION_TEMPLATES[type] : "";
}

/** Replaces {{duracion}} with the activity's round clock, in seconds. */
export function renderInstructions(activity) {
	const instructions = typeof activity?.instructions === "string" ? activity.instructions : "";
	if (instructions.length === 0) return "";
	const seconds = Number.isInteger(activity?.roundSeconds) && activity.roundSeconds > 0 ? activity.roundSeconds : FALLBACK_ROUND_SECONDS;
	return instructions.replaceAll("{{duracion}}", `${seconds} segundos`);
}
