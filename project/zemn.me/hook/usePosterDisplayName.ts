import { useGetExactContactByEmail } from "#root/project/zemn.me/hook/useGetExactContactByEmail.js";
import { displayPersonName } from "#root/ts/google/people/display.js";
import { None, option_and_then_flatten, option_from_maybe_undefined, option_unwrap_or } from "#root/ts/option/types.js";

export interface PosterIdentity {
	readonly email_address?: string | null;
	readonly given_name?: string | null;
	readonly family_name?: string | null;
	readonly sub?: string | null;
}

export function usePosterDisplayName(
	poster?: PosterIdentity | null
): string | undefined {
	const contact = useGetExactContactByEmail(
		option_from_maybe_undefined(poster?.email_address ?? undefined),
		new Set([
			"names",
			"nicknames",
		])
	);

	const contactName = option_unwrap_or(
		contact(
			() => None,
			person => option_and_then_flatten(
				person,
				person => displayPersonName(person)
			)
		),
		""
	);

	const posterName = [
		poster?.given_name,
		poster?.family_name,
	].filter(part => part && part.trim() !== "").join(" ").trim();

	const fallback = contactName
		|| posterName
		|| poster?.email_address
		|| poster?.sub
		|| "";

	return fallback ? fallback : undefined;
}
