// Administration shell: three sections, appearance preferences, security actions
// and the local-data warning. Phase 1 has no activity editor yet, so the two game
// sections state that plainly instead of showing an empty table.

import { ADMIN_SECTIONS, SECTION_LABELS } from "../core/router.js";
import { el } from "./dom.js";
import { renderSecurityGroup } from "./security.js";
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

function renderDataGroup() {
	return el(
		"section",
		{ class: "settings-group", "aria-labelledby": "group-data" },
		el("h2", { class: "settings-group__title", id: "group-data" }, "Datos y respaldo"),
		el(
			"p",
			{ class: "notice notice--warn" },
			"Los datos viven en este navegador. Si borrás los datos del navegador, usás una ventana privada o cambiás de dispositivo, se pierden.",
		),
		el("p", { class: "field__hint" }, "El respaldo en JSON, general y por juego, llega más adelante en el proyecto."),
	);
}

export function renderAdmin({ section, prefs, publishedCount = 0, downloaded = false, actions, db }) {
	let content;
	if (section === "config") {
		content = [renderAppearanceGroup({ prefs, onChange: actions.changePrefs }), renderSecurityGroup({ downloaded, actions }), renderDataGroup()];
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
