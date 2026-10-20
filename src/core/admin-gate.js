// Admin access gate.
//
// Deliberately in memory only: a reload forgets the unlock and asks for the PIN
// again, which is the safer default for a shared notebook. Navigating between
// admin sections keeps it, as the spec requires.

export const ADMIN_ACCESS = Object.freeze({
	SETUP: "setup",
	UNLOCK: "unlock",
	ADMIN: "admin",
});

/** Which screen the administration area must show right now. */
export function decideAdminAccess({ hasPin, unlocked }) {
	if (!hasPin) return ADMIN_ACCESS.SETUP;
	return unlocked ? ADMIN_ACCESS.ADMIN : ADMIN_ACCESS.UNLOCK;
}

/**
 * A PIN verification is asynchronous, so it may only unlock the visit it started in.
 *
 * `startedAt` and `current` are navigation generations. Leaving the panel bumps the
 * generation and coming back bumps it again, so a completion from an earlier visit is
 * stale even though the route happens to look like the panel once more. Without this,
 * typing the PIN, walking away and walking back could open the panel without a prompt.
 */
export function canHonorVerification({ startedAt, current, route }) {
	return startedAt === current && route?.name === "admin";
}

/**
 * Whether to offer the freshly generated recovery file.
 *
 * This is deliberately not the unlock rule. Changing the PIN invalidates the previous
 * file, so the moderator must be told whenever they are inside the unlocked panel —
 * including when a section navigation during the hash made the unlock itself stale.
 */
export function shouldOfferRecoveryFile({ unlocked, route }) {
	return unlocked === true && route?.name === "admin";
}

export function createAdminGate() {
	let unlocked = false;
	return {
		isUnlocked: () => unlocked,
		unlock() {
			unlocked = true;
		},
		lock() {
			unlocked = false;
		},
		step(hasPin) {
			return decideAdminAccess({ hasPin, unlocked });
		},
	};
}
