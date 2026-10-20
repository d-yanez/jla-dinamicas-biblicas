// File download and read helpers. Blob + object URL keeps everything local: no
// network, no service, works offline.

export function downloadJson(filename, data) {
	const text = `${JSON.stringify(data, null, 2)}\n`;
	const blob = new Blob([text], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.rel = "noopener";
	link.style.display = "none";
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function readFileText(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ""));
		reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo."));
		reader.onabort = () => reject(new Error("La lectura del archivo se canceló."));
		reader.readAsText(file);
	});
}
