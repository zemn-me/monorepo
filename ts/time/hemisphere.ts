import tz_to_hemisphere from '#root/py/time/hemisphere/tz_to_hemisphere.json';
import { None, Option, Some } from '#root/ts/option/option.js';

const known = (v: string): v is keyof typeof tz_to_hemisphere =>
	v in tz_to_hemisphere

/**
 * Returns true if the user is in the northern hemisphere, or false
 * if known to be in the southern hemisphere.
 *
 * This function will return {@link None} if unable to determine either
 * way.
 */
export function isNorthernHemisphere(): Option<boolean> {
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

	if (!known(tz)) return None;

	return Some(tz_to_hemisphere[tz])
}
