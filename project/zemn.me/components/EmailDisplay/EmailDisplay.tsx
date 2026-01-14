import { useGetExactContactByEmail } from "#root/project/zemn.me/hook/useGetExactContactByEmail.js";
import { displayPersonName } from "#root/ts/google/people/display.js";
import { None, option_and_then_flatten, option_from_maybe_undefined, option_unwrap_or } from "#root/ts/option/types.js";

export interface EmailDisplayProps {
	email?: string
}

export function EmailDisplay(props: EmailDisplayProps) {
	const contact = useGetExactContactByEmail(
		option_from_maybe_undefined(props.email),
		new Set([
			"names",
			"nicknames",
		])
	);

	return option_unwrap_or(
		contact(
			() => None, // ignore error for now
			contact => option_and_then_flatten(
				contact,
				contact => displayPersonName(contact)
			)
		),
		props.email
	);
}
