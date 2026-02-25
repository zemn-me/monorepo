'use client';

import { usePostMeKey, useGetMeScopes } from '#root/project/zemn.me/hook/useZemnMeApi.js';
import { useZemnMeAuth } from '#root/project/zemn.me/hook/useZemnMeAuth.js';
import { future_to_option } from '#root/ts/future/option/future_to_option.js';
import { is_some as option_is_some, unwrap as option_unwrap } from '#root/ts/option/types.js';

const requiredScope = "callbox_key";

export default function KeyPageClient() {
	const [fut_idToken, , fut_promptForLogin] = useZemnMeAuth();
	const idToken = future_to_option(fut_idToken);
	const promptForLogin = future_to_option(fut_promptForLogin);

	if (!option_is_some(idToken)) {
		return (
			<button
				aria-label="Authenticate with OIDC"
				disabled={!option_is_some(promptForLogin)}
				onClick={() => {
					if (!option_is_some(promptForLogin)) return;
					void option_unwrap(promptForLogin)();
				}}
			>
				Login with OIDC
			</button>
		);
	}

	const token = option_unwrap(idToken);
	const scopesQuery = useGetMeScopes(token);
	const scopes = scopesQuery.data ?? [];
	const hasScope = scopes.includes(requiredScope);
	const postKey = usePostMeKey(token);

	return (
		<section>
			<h1>Callbox Key</h1>
			<p>Press the button to unlock the door for the next 5 minutes.</p>
			<button
				type="button"
				disabled={!hasScope || postKey.isPending}
				onClick={() => {
					void postKey.mutate({
						headers: { Authorization: token },
					});
				}}
			>
				Unlock Door
			</button>
			{!hasScope ? (
				<p>You do not have permission to use the key.</p>
			) : null}
			{postKey.isSuccess ? (
				<p>Key request recorded.</p>
			) : null}
			{postKey.isError ? (
				<p>Error recording key request.</p>
			) : null}
		</section>
	);
}
