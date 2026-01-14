import {
	useSearchContact,
} from "#root/project/zemn.me/hook/useSearchContact.js";
import { useQueryFuture } from "#root/ts/future/react-query/useQuery.js";
import { PeopleFieldMask, PeoplePhoneNumber } from "#root/ts/google/people/display.js";
import { concatn_array, filter_map, iterator, map, nth, to_array } from "#root/ts/iter/iterable_functional.js";
import { None, Option, option_and_then, option_and_then_flatten, option_unwrap_or, Some } from "#root/ts/option/types.js";
import { format_phone_number_e164, parse_phone_number } from "#root/ts/phone/number.js";
import { Err, Ok, result_and_then, result_collect } from "#root/ts/result/result.js";


/**
 * Might return a contact with the exact same phone number.
 *
 * When loading returns an empty list.
 */
export function useGetExactContactByPhoneNumber(
	phoneNumber: Option<string>,
	fields: Set<PeopleFieldMask>
) {
	const parsed_phone_number = option_and_then_flatten(
		phoneNumber,
		phone => parse_phone_number(phone)
	)

	// try both formats as work-around for
	// https://issuetracker.google.com/u/1/issues/390736547?pli=1

	const intl_format = option_and_then(
		parsed_phone_number,
		p => p.formatInternational()
	);

	const ntl_format = option_and_then(
		parsed_phone_number,
		p => p.formatNational()
	);

	const e164_format = option_and_then(
		parsed_phone_number,
		p => format_phone_number_e164(p)
	);

	const futures = map([intl_format, ntl_format],
		formatted_number => useQueryFuture(useSearchContact(
		option_unwrap_or(formatted_number, ""),
		new Set([
			"phoneNumbers",
			...fields
		]),
	)));

	const results = map(
		futures,
		future => future(
			contacts => Ok(contacts),
			(/* loading */) => Ok([]),
			e => Err(e),
		)
	)

	const candidates = result_and_then(
		result_collect(to_array(results)),
		contacts => concatn_array(
			contacts
		)
	)

	const is_number_we_are_looking_for = option_and_then(
		e164_format,
		n => (number: PeoplePhoneNumber) =>
			"canonicalForm" in number &&
			number.canonicalForm === n
	)


	const matches = result_and_then(
		candidates,
		candidates => filter_map(
			candidates,
			candidate =>
				candidate.person?.phoneNumbers?.some(
					option_unwrap_or(
						is_number_we_are_looking_for,
						() => () => false
					)
				) ?
					Some(candidate.person): None
		)
	)

	return result_and_then(
		matches,
		m => nth(0)(
			iterator(m)
		)
	)
}
