import { isNorthernHemisphereTz } from '#root/ts/time/hemisphere/is_hemisphere';

/**
 * Returns true if the user is in the northern hemisphere, or false
 * if known to be in the southern hemisphere.
 */
export function isNorthernHemisphere(): boolean {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

	return isNorthernHemisphereTz(tz)
}
