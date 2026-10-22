// Administration shell: three sections, appearance preferences, security actions
// and the local-data warning. Phase 1 has no activity editor yet, so the two game
// sections state that plainly instead of showing an empty table.

import { ADMIN_SECTIONS, SECTION_LABELS } from "../core/router.js";
import { el } from "./dom.js";
import { renderSecurityGroup } from "./security.js";
import { createAudioEngine } from "./audio.js";
import { confirmDialog, createDialog } from "./common.js";
import { readFileText } from "./download.js";
import { formatDateTime } from "./format.js";
import { previewBackup } from "../core/backup.js";
import { formatVersion, isNewerVersion } from "../core/version.js";
import { mountPalabrasSection } from "./palabras-admin.js";
import { mountSopaSection } from "./sopa-admin.js";

function renderNav(section) {
	const nav = el("nav", { class: "admin-nav", "aria-label": "Secciones de administración" });
	for (const key of ADMIN_SECTIONS) {
		const link = el(
			"a",
			{ class: "admin-nav__link", href: key === ADMIN_SECTIONS[0] ? "#/admin" : `#/admin/${key}` },
			SECTION_LABELS[key],
		);
		if (key === section) link.setAttribute("aria-current", "page");
		nav.append(link);
	}
	return nav;
}

function renderGameSection(section, publishedCount) {
	const label = SECTION_LABELS[section];
	return el(
		"section",
		{ class: "panel stack", "aria-labelledby": "section-title" },
		el("h2", { class: "settings-group__title", id: "section-title" }, `Actividades de ${label}`),
		el(
			"p",
			{},
			publishedCount > 0
				? "Hay una actividad publicada. La edición de actividades de esta versión llega en la siguiente fase del proyecto."
				: `Todavía no hay actividades de ${label}. El motor y el editor de este juego llegan en la siguiente fase del proyecto.`,
		),
		el("p", { class: "field__hint" }, "Este panel ya guarda sus datos en el dispositivo y se protege con el PIN."),
	);
}

function renderSizeControl({ value, onChange }) {
	const wrap = el("div", { class: "segmented", role: "radiogroup", "aria-label": "Tamaño de proyección" });
	for (const [key, label] of [
		["grande", "Grande"],
		["normal", "Normal"],
	]) {
		const input = el("input", {
			type: "radio",
			name: "displaySize",
			value: key,
			checked: value === key,
		});
		const option = el("label", { class: "segmented__option" }, input, label);
		option.dataset.selected = value === key ? "true" : "false";
		input.addEventListener("change", () => {
			if (!input.checked) return;
			for (const sibling of wrap.querySelectorAll(".segmented__option")) sibling.dataset.selected = "false";
			option.dataset.selected = "true";
			onChange(key);
		});
		wrap.append(option);
	}
	return wrap;
}

function renderAppearanceGroup({ prefs, onChange }) {
	const status = el("p", { class: "form-error", role: "status", hidden: true });
	const report = (saved) => {
		if (saved) {
			status.hidden = true;
			status.textContent = "";
			return;
		}
		status.hidden = false;
		status.textContent = "El navegador rechazó guardar este ajuste. Se mantiene hasta que cierres la aplicación.";
	};

	const contrast = el("input", { type: "checkbox", id: "toggle-contrast", checked: prefs.highContrast });
	contrast.addEventListener("change", () => report(onChange({ highContrast: contrast.checked })));

	return el(
		"section",
		{ class: "settings-group", "aria-labelledby": "group-appearance" },
		el("h2", { class: "settings-group__title", id: "group-appearance" }, "Apariencia"),
		el("p", { class: "settings-group__desc" }, "Se guarda en este dispositivo y se aplica a la portada y al panel."),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "Tamaño de proyección"),
				el("span", { class: "setting-row__hint" }, "Grande está pensado para proyectar; Normal, para pantallas chicas."),
			),
			renderSizeControl({ value: prefs.displaySize, onChange: (displaySize) => report(onChange({ displaySize })) }),
		),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"label",
				{ class: "setting-row__text", for: "toggle-contrast" },
				el("span", { class: "setting-row__label" }, "Alto contraste"),
				el("span", { class: "setting-row__hint" }, "Aumenta el contraste sin cambiar el estilo JLA. Útil con mucha luz."),
			),
			contrast,
		),
		status,
	);
}

/** Typed confirmation: a plain "are you sure?" is too easy to accept by reflex. */
function openResetDialog(actions) {
	const sheet = createDialog("Restablecer con la configuración inicial");
	const input = el("input", { class: "input", type: "text", autocomplete: "off", "aria-label": "Escribí RESTABLECER para confirmar" });
	const confirm = el("button", { class: "btn btn--danger", type: "button", disabled: true }, "Restablecer");
	input.addEventListener("input", () => {
		confirm.disabled = input.value.trim().toUpperCase() !== "RESTABLECER";
	});
	confirm.addEventListener("click", async () => {
		confirm.disabled = true;
		let result;
		try {
			result = await actions.resetConfig();
		} catch (error) {
			// A reset that fails must say so here, not leave the dialog frozen.
			sheet.content.replaceChildren(
				el("p", { class: "notice notice--warn" }, `No se pudo restablecer: ${error?.message ?? "error desconocido"}`),
				el("div", { class: "jla-dialog__actions" }, el("button", { class: "btn btn--ghost", type: "button", onclick: () => sheet.close() }, "Cerrar")),
			);
			return;
		}
		sheet.content.replaceChildren(
			el("p", {}, `Listo: se restablecieron ${result.total} actividades (${result.published} publicadas).`),
			el("p", { class: "field__hint" }, "El PIN y las preferencias de este equipo no cambiaron."),
			el(
				"div",
				{ class: "jla-dialog__actions" },
				el("button", { class: "btn btn--primary", type: "button", onclick: () => sheet.close() }, "Listo"),
			),
		);
		sheet.dialog.addEventListener("close", () => {
			void actions.refresh();
		});
	});
	sheet.content.append(
		el(
			"div",
			{ class: "stack" },
			el(
				"p",
				{},
				"Se van a borrar todas las actividades de este equipo y se va a volver a aplicar la configuración que viene con el sitio. Después de esto, la lista muestra lo que está publicado en el repositorio.",
			),
			el("p", { class: "notice notice--warn" }, "Si tenés actividades sin respaldar, exportá un respaldo antes de continuar."),
			el("div", { class: "field" }, el("label", { class: "field__label", for: "confirmar-restablecer" }, "Escribí RESTABLECER para confirmar"), input),
			el(
				"div",
				{ class: "jla-dialog__actions" },
				el("button", { class: "btn btn--ghost", type: "button", onclick: () => sheet.close() }, "Cancelar"),
				confirm,
			),
		),
	);
	sheet.open();
}

let soundEngine;

/** One shared engine for the test buttons; its context is created on the first click. */
function engineFor(prefs) {
	if (!soundEngine) soundEngine = createAudioEngine({ volume: prefs.soundVolume, muted: prefs.muted });
	else {
		soundEngine.setVolume(prefs.soundVolume);
		soundEngine.setMuted(prefs.muted);
	}
	return soundEngine;
}

function renderSoundGroup({ prefs, onChange }) {
	const engine = engineFor(prefs);
	const test = (cue) => {
		engine.unlock();
		if (cue === "bell") engine.bell("start");
		else if (cue === "tick") engine.tick(4);
		else if (cue === "reveal") engine.reveal();
		else if (cue === "countdown") engine.beep(3);
		else if (cue === "closing") engine.playClosing();
		else if (cue === "lobby" || cue === "question") {
			engine.startMusic(cue);
			window.setTimeout(() => engine.stopMusic(), 2600);
		}
	};
	const volume = el("input", { type: "range", min: "0", max: "100", step: "5", value: String(Math.round(prefs.soundVolume * 100)), "aria-label": "Volumen del sonido" });
	volume.addEventListener("input", () => {
		const value = Number(volume.value) / 100;
		engine.setVolume(value);
		onChange({ soundVolume: value });
	});
	const muted = el("input", { type: "checkbox", id: "sonido-silencio", checked: prefs.muted });
	muted.addEventListener("change", () => onChange({ muted: muted.checked }));

	const stages = [
		["soundLobby", "Música de espera en la introducción", "lobby", "música"],
		["soundQuestion", "Música mientras responden", "question", "música"],
		["soundCountdown", "Cuenta regresiva 3 · 2 · 1", "countdown", "cuenta"],
		["soundBell", "Campana al empezar y al terminar", "bell", "campana"],
		["soundTicks", "Tic en los últimos cinco segundos", "tick", "tic"],
		["soundReveal", "Sonido al revelar una solución", "reveal", "revelación"],
		["soundClosing", "Acorde de cierre", "closing", "cierre"],
	];
	const rows = stages.map(([key, label, cue, action]) => {
		const input = el("input", { type: "checkbox", id: `sonido-${key}`, checked: prefs[key] !== false });
		input.addEventListener("change", () => onChange({ [key]: input.checked }));
		return el(
			"div",
			{ class: "setting-row" },
			el("label", { class: "setting-row__text", for: `sonido-${key}` }, el("span", { class: "setting-row__label" }, label)),
			el("div", { class: "row" }, input, el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: () => test(cue) }, `Probar ${action}`)),
		);
	});

	return el(
		"section",
		{ class: "settings-group", "aria-labelledby": "group-sound" },
		el("h2", { class: "settings-group__title", id: "group-sound" }, "Sonido"),
		el("p", { class: "settings-group__desc" }, "Se guarda en este dispositivo. Los sonidos son sintetizados: no hay archivos ni descargas."),
		el(
			"div",
			{ class: "setting-row" },
			el("label", { class: "setting-row__text", for: "volumen-admin" }, el("span", { class: "setting-row__label" }, "Volumen")),
			volume,
		),
		el(
			"div",
			{ class: "setting-row" },
			el("label", { class: "setting-row__text", for: "sonido-silencio" }, el("span", { class: "setting-row__label" }, "Silencio total")),
			muted,
		),
		...rows,
	);
}

function renderDataGroup({ actions, version }) {
	const status = el("p", { class: "field__hint", role: "status" }, "");
	const fileInput = el("input", { class: "input", type: "file", accept: ".json,application/json", "aria-label": "Archivo de respaldo" });
	const importButton = el(
		"button",
		{
			class: "btn btn--ghost btn--small",
			type: "button",
			onclick: async () => {
				status.textContent = "";
				const file = fileInput.files?.[0];
				if (!file) {
					status.textContent = "Elegí un archivo de respaldo (.json).";
					return;
				}
				let text;
				try {
					text = await readFileText(file);
				} catch {
					status.textContent = "No se pudo leer el archivo.";
					return;
				}
				const preview = previewBackup(text);
				if (!preview.ok) {
					status.textContent = preview.error;
					return;
				}
				// Show what the file carries before writing anything: this is the work the
				// moderator configured, not a different one.
				const sheet = createDialog("Importar respaldo");
				sheet.content.append(
					el("p", {}, `${file.name}${preview.exportedAt ? ` · exportado el ${formatDateTime(preview.exportedAt)}` : ""}`),
					el(
						"ul",
						{ class: "review-list" },
						...preview.items.map((item) =>
							el(
								"li",
								{ class: item.valid ? "review-item" : "review-item review-item--pending" },
								el("span", { class: "review-item__solution" }, item.name),
								el(
									"span",
									{ class: "review-item__detail" },
									`${item.type === "sopa" ? "Sopa de letras" : item.type === "palabras" ? "Palabras desordenadas" : item.type} · ${item.status === "published" ? "publicada" : "borrador"}${item.valid ? "" : " · inválida"}`,
								),
							),
						),
					),
					preview.appVersion && version && isNewerVersion(preview.appVersion, version)
						? el(
								"p",
								{ class: "notice notice--warn" },
								`El archivo viene de una versión más nueva (${formatVersion(preview.appVersion)}). Actualizá esta app antes de importar.`,
							)
						: undefined,
					preview.invalid > 0
						? el("p", { class: "notice notice--warn" }, `${preview.invalid} ${preview.invalid === 1 ? "entrada no es válida" : "entradas no son válidas"} y se van a omitir.`)
						: undefined,
					el("p", { class: "field__hint" }, "Se agregan como borradores. Nada de lo que ya tenés se sobrescribe y la actividad publicada de este equipo no cambia."),
					el(
						"div",
						{ class: "jla-dialog__actions" },
						el("button", { class: "btn btn--ghost", type: "button", onclick: () => sheet.close() }, "Cancelar"),
						el(
							"button",
							{
								class: "btn btn--primary",
								type: "button",
								onclick: async () => {
									sheet.close();
									const result = await actions.importBackup(text);
									if (!result?.ok) {
										status.textContent = result?.error ?? "El respaldo no se pudo importar.";
										return;
									}
									const parts = [`Se importaron ${result.summary.added} actividades`];
									if (result.summary.renamed > 0) parts.push(`${result.summary.renamed} renombradas para no repetir nombres`);
									if (result.summary.skipped > 0) parts.push(`${result.summary.skipped} omitidas por inválidas`);
									status.textContent = `${parts.join(", ")}. Las vas a encontrar en la lista como borradores.`;
								},
							},
							"Importar",
						),
					),
				);
				sheet.open();
			},
		},
		"Importar respaldo",
	);

	return el(
		"section",
		{ class: "settings-group", "aria-labelledby": "group-data" },
		el("h2", { class: "settings-group__title", id: "group-data" }, "Datos y respaldo"),
		el("p", { class: "field__hint" }, `Versión de la aplicación: ${formatVersion(version) || version || "desconocida"}`),
		el(
			"p",
			{ class: "notice notice--warn" },
			"Los datos viven en este navegador. Si borrás los datos del navegador, usás una ventana privada o cambiás de dispositivo, se pierden: por eso existe el respaldo.",
		),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "Exportar respaldo"),
				el("span", { class: "setting-row__hint" }, "Descarga un archivo JSON con todas las actividades y la configuración. El PIN nunca se incluye."),
			),
			el("button", { class: "btn btn--primary btn--small", type: "button", onclick: () => void actions.exportBackup() }, "Exportar respaldo"),
		),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "Importar respaldo"),
				el("span", { class: "setting-row__hint" }, "Desde otro dispositivo. Todo lo importado entra como borrador; la publicada de este equipo no cambia."),
			),
			el("div", { class: "row" }, fileInput, importButton),
		),
		el(
			"div",
			{ class: "setting-row" },
			el(
				"div",
				{ class: "setting-row__text" },
				el("span", { class: "setting-row__label" }, "Restablecer con la configuración inicial"),
				el(
					"span",
					{ class: "setting-row__hint" },
					"Borra las actividades de este equipo y vuelve a aplicar la configuración del repositorio. El PIN y las preferencias se conservan.",
				),
			),
			el("button", { class: "btn btn--danger btn--small", type: "button", onclick: () => openResetDialog(actions) }, "Restablecer"),
		),
		status,
	);
}

export function renderAdmin({ section, prefs, publishedCount = 0, downloaded = false, actions, db, version = "" }) {
	let content;
	if (section === "config") {
		content = [
			renderAppearanceGroup({ prefs, onChange: actions.changePrefs }),
			renderSoundGroup({ prefs, onChange: actions.changePrefs }),
			renderSecurityGroup({ downloaded, actions }),
			renderDataGroup({ actions, version }),
		];
	} else if (section === "sopa" && db) {
		content = [mountSopaSection({ db }).element];
	} else if (section === "palabras" && db) {
		content = [mountPalabrasSection({ db }).element];
	} else {
		content = [renderGameSection(section, publishedCount)];
	}

	return el(
		"main",
		{ class: "page", id: "contenido", tabindex: "-1" },
		el(
			"div",
			{ class: "admin-header" },
			el(
				"div",
				{},
				el("p", { class: "hero__eyebrow" }, "Administración"),
				el("h1", { class: "admin-header__title" }, SECTION_LABELS[section] ?? "Administración"),
			),
			el("button", { class: "btn btn--ghost btn--small", type: "button", onclick: actions.lock }, "Cerrar sesión"),
		),
		renderNav(section),
		el("div", { class: "stack" }, ...content),
	);
}
