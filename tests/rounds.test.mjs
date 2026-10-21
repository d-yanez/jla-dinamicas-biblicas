import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DOUBLE_ACTION_MS,
	EXTRA_SECONDS,
	PLAY_EVENT,
	PLAY_STAGE,
	ROUND_COUNT,
	createRoundSession,
	formatClock,
} from "../src/core/rounds.js";

function session(roundSeconds = 30) {
	return createRoundSession({ roundSeconds, extraSeconds: EXTRA_SECONDS });
}

test("arranca en la introducción con el reloj detenido", () => {
	const play = session(30);
	const state = play.snapshot();
	assert.equal(state.stage, PLAY_STAGE.INTRO);
	assert.equal(state.running, false);
	assert.equal(state.remainingMs, 30_000);
	assert.equal(state.roundCount, ROUND_COUNT);
	assert.equal(state.roundNumber, 1);
});

test("empezar abre la primera ronda con el reloj corriendo", () => {
	const play = session(30);
	const events = play.start(0);
	assert.deepEqual(events, [{ type: PLAY_EVENT.ROUND_START, roundIndex: 0 }]);
	assert.equal(play.snapshot().stage, PLAY_STAGE.ROUND);
	assert.equal(play.snapshot().running, true);
	assert.deepEqual(play.snapshot().history, [0]);
});

test("siguiente avanza y reinicia el reloj en la misma acción", () => {
	const play = session(30);
	play.start(0);
	play.tick(10_000);
	assert.equal(play.snapshot().remainingMs, 20_000);
	const events = play.next(DOUBLE_ACTION_MS + 1);
	assert.deepEqual(events, [{ type: PLAY_EVENT.ROUND_START, roundIndex: 1 }]);
	const state = play.snapshot();
	assert.equal(state.roundIndex, 1);
	assert.equal(state.remainingMs, 30_000);
	assert.equal(state.running, true);
	assert.deepEqual(state.history, [0, 1]);
});

test("no hay ronda once", () => {
	const play = session(10);
	play.start(0);
	for (let index = 0; index < 12; index += 1) play.next(DOUBLE_ACTION_MS * (index + 2));
	assert.equal(play.snapshot().roundIndex, ROUND_COUNT - 1);
	assert.deepEqual(play.next(99_999), []);
});

test("el doble clic no avanza dos veces", () => {
	const play = session(30);
	play.start(0);
	const first = play.next(1_000);
	const second = play.next(1_000 + DOUBLE_ACTION_MS - 50);
	assert.equal(first.length, 1);
	assert.deepEqual(second, [], "el segundo avance dentro de la ventana se ignora");
	assert.equal(play.snapshot().roundIndex, 1);
});

test("llegar a cero detiene sin avanzar", () => {
	const play = session(10);
	play.start(0);
	const events = play.tick(10_000);
	assert.deepEqual(
		events.filter((event) => event.type === PLAY_EVENT.TIME_UP),
		[{ type: PLAY_EVENT.TIME_UP }],
	);
	const state = play.snapshot();
	assert.equal(state.remainingMs, 0);
	assert.equal(state.running, false);
	assert.equal(state.roundIndex, 0, "jamás avanza solo");
});

test("tic en los últimos cinco segundos, uno por segundo y no antes", () => {
	const play = session(10);
	play.start(0);
	const early = play.tick(4_000);
	assert.equal(early.filter((event) => event.type === PLAY_EVENT.TICK).length, 0, "arriba de 5 s no hay tic");
	const late = play.tick(5_000);
	const ticks = late.filter((event) => event.type === PLAY_EVENT.TICK);
	assert.deepEqual(
		ticks.map((event) => event.secondsLeft),
		[5, 4, 3, 2, 1],
	);
});

test("pausar y reanudar no consume tiempo", () => {
	const play = session(30);
	play.start(0);
	play.tick(5_000);
	play.pause();
	assert.equal(play.snapshot().running, false);
	assert.equal(play.tick(5_000).length, 0, "en pausa el reloj no corre");
	assert.equal(play.snapshot().remainingMs, 25_000);
	play.resume(10_000);
	assert.equal(play.snapshot().running, true);
	assert.equal(play.snapshot().remainingMs, 25_000);
});

test("reiniciar devuelve el tiempo completo de la ronda", () => {
	const play = session(20);
	play.start(0);
	play.tick(15_000);
	play.restart();
	assert.equal(play.snapshot().remainingMs, 20_000);
	assert.equal(play.snapshot().running, true);
});

test("retroceder vuelve a la ronda anterior con el reloj pausado y conserva pistas", () => {
	const play = session(30);
	play.start(0);
	play.next(DOUBLE_ACTION_MS + 1);
	play.showHint(1);
	assert.deepEqual(play.previous(), []);
	const state = play.snapshot();
	assert.equal(state.roundIndex, 0);
	assert.equal(state.running, false, "al retroceder el cronómetro queda pausado");
	assert.equal(state.remainingMs, 30_000);
	assert.equal(state.hints[1], 1, "las pistas mostradas no se pierden");
	assert.deepEqual(state.history, [0]);
});

test("el extra de 60 segundos es manual y solo tras la décima ronda", () => {
	const play = session(10);
	play.start(0);
	assert.deepEqual(play.startExtra(1_000), [], "no se puede pedir en la primera ronda");
	for (let index = 0; index < 9; index += 1) play.next(DOUBLE_ACTION_MS * (index + 2));
	assert.equal(play.snapshot().roundIndex, 9);
	const events = play.startExtra(99_999);
	assert.deepEqual(events, [{ type: PLAY_EVENT.EXTRA_START, seconds: EXTRA_SECONDS }]);
	const state = play.snapshot();
	assert.equal(state.stage, PLAY_STAGE.EXTRA);
	assert.equal(state.remainingMs, 60_000);
	assert.equal(state.running, true);
	play.tick(60_000);
	assert.equal(play.snapshot().remainingMs, 0);
	assert.equal(play.snapshot().running, false);
});

test("la revisión revela de a una y el retroceso no borra lo revelado", () => {
	const play = session(30);
	play.start(0);
	play.beginReview();
	assert.equal(play.snapshot().stage, PLAY_STAGE.REVIEW);
	assert.deepEqual(play.snapshot().review, { cursor: 0, watermark: 0 });
	const first = play.revealNext(1_000);
	const second = play.revealNext(2_000);
	assert.deepEqual(
		first.map((event) => event.revealed),
		[1],
	);
	assert.deepEqual(
		second.map((event) => event.revealed),
		[2],
	);
	play.revealPrevious();
	const state = play.snapshot();
	assert.equal(state.review.cursor, 1, "el cursor vuelve");
	assert.equal(state.review.watermark, 2, "lo revelado sigue pintado");
});

test("revelar dos veces en el mismo instante cuenta como una", () => {
	const play = session(30);
	play.start(0);
	play.beginReview();
	play.revealNext(1_000);
	play.revealNext(1_050);
	assert.equal(play.snapshot().review.cursor, 1);
});

test("la revisión no revela más respuestas que rondas hay", () => {
	const play = session(10);
	play.start(0);
	play.beginReview();
	for (let index = 0; index < 15; index += 1) play.revealNext(1_000 + index * DOUBLE_ACTION_MS * 2);
	assert.equal(play.snapshot().review.cursor, ROUND_COUNT);
});

test("la revisión solo empieza desde una partida en curso", () => {
	const play = session(10);
	assert.deepEqual(play.beginReview(), []);
	assert.equal(play.snapshot().stage, PLAY_STAGE.INTRO);
});

test("reflexión y cierre por separado", () => {
	const play = session(10);
	play.start(0);
	play.beginReview();
	play.goToReflection();
	assert.equal(play.snapshot().stage, PLAY_STAGE.REFLECTION);
	play.finish();
	assert.equal(play.snapshot().stage, PLAY_STAGE.THANKS);
});

test("la ayuda pausa y al cerrarla sigue en pausa", () => {
	const play = session(30);
	play.start(0);
	play.openHelp();
	assert.equal(play.snapshot().running, false);
	play.closeHelp();
	assert.equal(play.snapshot().running, false, "cerrar la ayuda no reanuda el reloj");
	assert.equal(play.tick(5_000).length, 0);
});

test("el reloj se muestra en mm:ss", () => {
	assert.equal(formatClock(30_000), "00:30");
	assert.equal(formatClock(61_000), "01:01");
	assert.equal(formatClock(0), "00:00");
	assert.equal(formatClock(999), "00:01");
	assert.equal(formatClock(-500), "00:00");
	assert.equal(formatClock(undefined), "00:00");
});

test("el snapshot es una copia y no deja mutar la sesión", () => {
	const play = session(30);
	play.start(0);
	const snapshot = play.snapshot();
	snapshot.roundIndex = 7;
	snapshot.history.push(5);
	assert.equal(play.snapshot().roundIndex, 0);
	assert.deepEqual(play.snapshot().history, [0]);
});

test("el desempate se abre solo desde la revisión y sin cronómetro", () => {
	const play = session(30);
	assert.deepEqual(play.startTiebreak(1_000), [], "no se puede abrir antes de revisar");
	play.start(0);
	play.beginReview();
	const events = play.startTiebreak(2_000);
	assert.equal(events.length, 1);
	const state = play.snapshot();
	assert.equal(state.stage, PLAY_STAGE.TIEBREAKER);
	assert.equal(state.tiebreak.index, 0);
	assert.equal(state.tiebreak.anagramShown, false);
	assert.equal(state.tiebreak.answerShown, false);
	assert.equal(state.running, false, "sin cronómetro");
	assert.equal(state.tiebreakCount, 3);
});

test("el anagrama y la respuesta del desempate se revelan a mano", () => {
	const play = session(30);
	play.start(0);
	play.beginReview();
	play.startTiebreak(1_000);
	assert.deepEqual(play.showTiebreakAnagram(), []);
	assert.equal(play.snapshot().tiebreak.anagramShown, true);
	assert.equal(play.snapshot().tiebreak.answerShown, false, "mostrar la palabra no revela la respuesta");
	const reveal = play.revealTiebreakAnswer();
	assert.equal(reveal[0].kind, "tiebreak-answer");
	assert.equal(play.snapshot().tiebreak.answerShown, true);
});

test("hay tres desempates y cada uno reinicia sus revelaciones", () => {
	const play = session(10);
	play.start(0);
	play.beginReview();
	play.startTiebreak(1_000);
	play.showTiebreakAnagram();
	play.revealTiebreakAnswer();
	play.nextTiebreak(2_000);
	const second = play.snapshot().tiebreak;
	assert.equal(second.index, 1);
	assert.equal(second.anagramShown, false);
	assert.equal(second.answerShown, false);
	play.nextTiebreak(3_000);
	play.nextTiebreak(4_000);
	assert.equal(play.snapshot().tiebreak.index, 2, "no hay cuarto desempate");
});

test("volver del desempate devuelve la revisión", () => {
	const play = session(10);
	play.start(0);
	play.beginReview();
	play.startTiebreak(1_000);
	assert.deepEqual(play.closeTiebreak(), []);
	assert.equal(play.snapshot().stage, PLAY_STAGE.REVIEW);
	assert.equal(play.snapshot().review.cursor, 0, "la revisión conserva su avance");
});

test("el cambio de desempate respeta la guarda anti doble acción", () => {
	const play = session(10);
	play.start(0);
	play.beginReview();
	play.startTiebreak(1_000);
	play.nextTiebreak(1_050);
	assert.equal(play.snapshot().tiebreak.index, 0, "dos avances seguidos cuentan como uno");
	play.nextTiebreak(2_000);
	assert.equal(play.snapshot().tiebreak.index, 1);
});
