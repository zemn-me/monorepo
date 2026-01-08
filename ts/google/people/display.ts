import type { components } from "#root/third_party/com/googleapis/people/api_client.gen.js";
import { filter, filter_map, iterator, map, nth } from "#root/ts/iter/iterable_functional.js";
import { and_then, is_some, None, Option, Some, unwrap } from "#root/ts/option/types.js";

export type PeoplePerson = components["schemas"]["Person"];
export type PeopleName =
	NonNullable<
		components["schemas"]["Person"]["names"]
	>[number];

function formatPeopleName(
	n: PeopleName
): string {
	if (n.displayName === undefined)
		throw new Error("this person's display name is undefined :(");

	return n.displayName
}

/**
 * Returns the person's set of nicknames.
 */
export function nicknames(
	person: PeoplePerson
) {
	return filter(map(
		person.nicknames ?? [],
		nickname => nickname.value !== undefined
			? Some(nickname)
			: None
	))
}

export function displayPersonName(
	person: PeoplePerson | undefined
): Option<string> {
	const defaultNickname = nth(0)(
		iterator(
			filter_map(
				person?.nicknames ?? [],
				nick =>
					nick.value !== undefined &&
						nick.metadata?.primary === true
						? Some(nick)
						: None
			)
		)
	)

	if (is_some(defaultNickname)) {
		return Some(unwrap(defaultNickname).value!)
	}

	const otherNicknames = nth(0)(
		iterator(
			filter_map(
				person?.nicknames ?? [],
				nick =>
					nick.value !== undefined
						? Some(nick)
						: None
			)
		)
	)

	if (is_some(otherNicknames)) {
		return Some(unwrap(otherNicknames).value!)
	}

	// okay. let's try assembling a proper name then.
	const defaultNames = nth(0)(
		iterator(
			filter_map(
				person?.names ?? [],
				name =>
					name.metadata?.primary === true
						? Some(name)
						: None
			)
		)
	)

	if (is_some(defaultNames)) {
		return Some(formatPeopleName(unwrap(defaultNames)))
	}

	return and_then(nth(0)(
		iterator(
			person?.names ?? []
		)
	), name => formatPeopleName(name))
}
