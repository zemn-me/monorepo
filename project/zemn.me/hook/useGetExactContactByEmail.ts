import {
	useSearchContact,
} from "#root/project/zemn.me/hook/useSearchContact.js";
import { useQueryFuture } from "#root/ts/future/react-query/useQuery.js";
import { PeopleEmailAddress, PeopleFieldMask } from "#root/ts/google/people/display.js";
import { filter_map, iterator, nth } from "#root/ts/iter/iterable_functional.js";
import { None, Option, option_and_then, option_and_then_flatten, option_unwrap_or, Some } from "#root/ts/option/types.js";
import { Err, Ok, result_and_then } from "#root/ts/result/result.js";


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
			const trimmed = value.trim().toLowerCase();
			return trimmed ? Some(trimmed) : None;
		}
	);

	const future = useQueryFuture(useSearchContact(
		option_unwrap_or(normalized_email, ""),
		new Set([
			"emailAddresses",
			...fields,
		]),
		{ normalizeQuery: query => query }
	));

	const results = future(
		contacts => Ok(contacts),
		(/* loading */) => Ok([]),
		e => Err(e),
	);

	const is_email_we_are_looking_for = option_and_then(
		normalized_email,
		needle => (address: PeopleEmailAddress) =>
			address.value !== undefined && address.value.toLowerCase() === needle
	);

	const matches = result_and_then(
		results,
		contacts => filter_map(
			contacts,
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
