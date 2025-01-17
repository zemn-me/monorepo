import { isNorthernHemisphereTz } from '#root/ts/time/hemisphere/is_hemisphere';

/**
 * Returns true if the user is in the northern hemisphere, or false
 * if known to be in the southern hemisphere.
 *
 * This function used to return None if unable to determine
 */
export function isNorthernHemisphere(): boolean {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

	return isNorthernHemisphereTz(tz)
}
