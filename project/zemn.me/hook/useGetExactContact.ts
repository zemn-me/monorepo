import parsePhoneNumber from "libphonenumber-js";

import {
	ContactReadMaskField,
	useSearchContact,
} from "#root/project/zemn.me/hook/useSearchContact.js";
import { filter_map, iterator, nth } from "#root/ts/iter/iterable_functional.js";
import { None, Some } from "#root/ts/option/types.js";


export function useGetExactContact(
	matchOn: "emailAddresses" | "phoneNumbers",
	content: string | undefined,
	fields: Set<ContactReadMaskField>,
) {
	const contacts = useSearchContact(
		content,
		new Set([
			matchOn,
			...fields
		]),
	);

	const data = contacts.isSuccess
		?
			nth(0)(
				iterator(
					filter_map(
						contacts.data,
						item =>
							item.person?.[matchOn]?.some(
								ident => "canonicalForm" in ident
									? parsePhoneNumber(content ?? "")?.formatInternational().replaceAll(/ /g, "") === ident.canonicalForm
									: ident.value === content
							)
								? Some(item.person)
								: None
					)
				)
			)
		: None

	return {
		...contacts,
		data
	}


}
