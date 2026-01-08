import { useGetExactContact } from "#root/project/zemn.me/hook/useGetExactContact.js"
import { displayPersonName } from "#root/ts/google/people/display.js";
import { and_then, flatten, unwrap_or_else } from "#root/ts/option/types.js";

export interface PhoneNumberDisplayProps {
	number?: string
}

export function PhoneNumberDisplay(props: PhoneNumberDisplayProps) {
	const contacts = useGetExactContact(
		"phoneNumbers",
		props.number,
		new Set([
			"names",
			"nicknames",
		])
	)

	if (contacts.isLoading) return props.number;

	if (!contacts.isSuccess) return props.number;


	const displayName = flatten(and_then(
		contacts.data,
		person => displayPersonName(person)
	))

	return unwrap_or_else(
		displayName,
		() => props.number,
	)
}
