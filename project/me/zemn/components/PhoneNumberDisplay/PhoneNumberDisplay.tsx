import { useGetExactContactByPhoneNumber } from "#root/project/me/zemn/hook/useGetExactContactByPhoneNumber.js";
import { displayPersonName } from "#root/ts/google/people/display.js";
import { None, option_and_then_flatten, option_from_maybe_undefined, option_unwrap_or } from "#root/ts/option/types.js";

export interface PhoneNumberDisplayProps {
	number?: string
}

export function PhoneNumberDisplay(props: PhoneNumberDisplayProps) {
	const contact = useGetExactContactByPhoneNumber(
		option_from_maybe_undefined(props.number),
		new Set([
			"names",
			"nicknames",
		])
	)

	return option_unwrap_or(
		contact(
			() => None, // ignore error for now
			contact => option_and_then_flatten(
				contact,
				contact => displayPersonName(contact)
			)
		),
		props.number
	)
}
