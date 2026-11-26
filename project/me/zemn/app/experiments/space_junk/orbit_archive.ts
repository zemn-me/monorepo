import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';

export const orbitElementsUrl = (day: string) =>
	new URL(
		'/earth-orbits/elements/' + encodeURIComponent(day),
		ZEMN_ME_API_BASE
	).href;
