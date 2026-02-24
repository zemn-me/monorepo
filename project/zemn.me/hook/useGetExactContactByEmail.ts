import { useSearchContact } from "#root/project/zemn.me/hook/useSearchContact.js";
import type { components } from "#root/third_party/com/googleapis/people/api_client.gen.js";
import { PeopleFieldMask } from "#root/ts/google/people/display.js";
import { concatn_array, filter_map, iterator, nth, to_array } from "#root/ts/iter/iterable_functional.js";
import { None, Option, option_and_then, option_and_then_flatten, option_unwrap_or, Some } from "#root/ts/option/types.js";
import { Err, Ok, result_and_then, result_collect } from "#root/ts/result/result.js";

type PeopleEmailAddress =
	NonNullable<
		components["schemas"]["Person"]["emailAddresses"]
	>[number];

/**
 * Might return a contact with the exact same email address.
 *
 * When loading returns an empty list.
 */
export function useGetExactContactByEmail(
	email: Option<string>,
	fields: Set<PeopleFieldMask>
) {
	const normalized_email = option_and_then_flatten(
		email,
		value => {
			const trimmed = value.trim();
			return trimmed ? Some(trimmed.toLowerCase()) : None;
		}
	);

	const future = useSearchContact(
		option_unwrap_or(normalized_email, ""),
		new Set([
			"emailAddresses",
			...fields
		]),
	);

	const results = [future(
		contacts => Ok(contacts),
		(/* loading */) => Ok([]),
		e => Err(e),
	)];

	const candidates = result_and_then(
		result_collect(to_array(results)),
		contacts => concatn_array(
			contacts
		)
	);

	const is_email_we_are_looking_for = option_and_then(
		normalized_email,
		n => (address: PeopleEmailAddress) =>
			address.value !== undefined &&
			address.value.trim().toLowerCase() === n
	);

	const matches = result_and_then(
		candidates,
		candidates => filter_map(
			candidates,
			candidate =>
				candidate.person?.emailAddresses?.some(
					option_unwrap_or(
						is_email_we_are_looking_for,
						() => () => false
					)
				) ?
					Some(candidate.person) : None
		)
	);

	return result_and_then(
		matches,
		m => nth(0)(
			iterator(m)
		)
	);
}
