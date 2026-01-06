import { useGetExactContact } from "#root/project/zemn.me/hook/useGetExactContact.js"
import { filter, iterator, map, nth } from "#root/ts/iter/iterable_functional.js";
import * as option from "#root/ts/option/types.js";

export interface PhoneNumberDisplayProps {
	number?: string
}

export function PhoneNumberDisplay(props: PhoneNumberDisplayProps) {
	const contacts = useGetExactContact(
		"phoneNumbers",
		props.number,
	)

	if (contacts.isLoading) return props.number;

	if (!contacts.isSuccess) return props.number;


	// this logic can be improved at some point...
	const display_name_or_undefined = map(contacts.data ?? [],
		p => p.person?.nicknames?.[0]?.value ??
			p.person?.names?.[0]?.givenName
	);

	const display_name = nth(0)(iterator(filter(map(
		display_name_or_undefined,
		v => v === undefined
			? option.None
			: option.Some(v)
	))));

	return option.unwrap_or(display_name, props.number)
}

