// Version helpers.
//
// The app reads `version.json` at start-up and shows it; the backup carries the same
// value, so a file can tell which build produced it. Comparing versions lets the import
// warn when a file comes from a newer app than the one open.

/** Read a version like "0.6.0". Returns undefined when it is not semantic. */
export function parseVersion(value) {
	if (typeof value !== "string") return undefined;
	const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value.trim());
	if (!match) return undefined;
	return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

/**
 * Negative when `left` is older than `right`, positive when newer, 0 when equal.
 * An unreadable version compares as 0, so an unknown file never blocks an import.
 */
export function compareVersions(left, right) {
	const a = parseVersion(left);
	const b = parseVersion(right);
	if (!a || !b) return 0;
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	return a.patch - b.patch;
}

/** True when `candidate` is strictly newer than `current`. */
export function isNewerVersion(candidate, current) {
	return compareVersions(candidate, current) > 0;
}

/** "v0.6.0" for display; empty when there is nothing readable. */
export function formatVersion(value) {
	const parsed = parseVersion(value);
	return parsed ? `v${parsed.major}.${parsed.minor}.${parsed.patch}` : "";
}
