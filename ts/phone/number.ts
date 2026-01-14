import parsePhoneNumber, { PhoneNumber } from "libphonenumber-js";

import { None, Some } from "#root/ts/option/types.js";

export function parse_phone_number(
	phone: string
) {
	const pn = parsePhoneNumber(phone);

	if (pn === undefined) return None;
	return Some(pn);
}

export function format_phone_number_e164(
	phone: PhoneNumber
) {
	return phone.format("E.164")
}
