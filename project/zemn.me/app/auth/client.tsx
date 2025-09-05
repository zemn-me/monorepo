"use client"
/**
 * @fileoverview
 * OAuth callback page etc.
 *
 * NB: need to make the localStorage serde system also work outside
 * react to make this thing work.
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import b64 from 'base64-js';
import { redirect, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { useLocalStorageController } from "#root/project/zemn.me/hook/useLocalStorage.js";
import { authCacheSchema, AuthorizationCache, clientSecret } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Client, clients, Issuer, OAuthClientByIssuer } from "#root/project/zemn.me/OAuth/clients.js";
import { LensGet, LensSet } from "#root/ts/lens.js";
import { oidcAuthorizeUri, watch_out_i_am_verifying_the_id_token_with_no_specified_issuer } from "#root/ts/oidc/oidc.js";
import { and, and_then as option_and_then, None, ok_or_else, Option, Some, unwrap_or as option_unwrap_or } from "#root/ts/option/types.js";
import { and_then as result_and_then, Err, flatten as result_flatten, Ok, Result, result_promise_transpose, unwrap_or_else as result_unwrap_or_else, zip as result_zip } from "#root/ts/result_types.js";
import { resultFromZod } from "#root/ts/zod/util.js";

/**
 * Allows accessing window.location, which will not be around during prerender.
 */
function useWindowLocation() {
	const [location, setLocation] = useState<Option<typeof window.location>>(None);

	// useState only renders on the client.
	useEffect(() => {
		setLocation(Some(window.location));
	}, [setLocation])


	return location;
}




interface SignOnSelectorProps {
	readonly onChange: (c: Client | undefined) => void,
	readonly id?: string
	readonly issuerHint?: string
}

/**
 * Allows the user to pick from one of several OIDC+OAuth clients.
 */
function SignOnSelector(props: SignOnSelectorProps) {
	const [value, setValue] = useState<string>(
		[...clients].filter(
			v => v.issuer === props.issuerHint
		)[0]?.issuer ?? ""
	);

	useEffect(() => {
		if (value == "") return;
		props.onChange(OAuthClientByIssuer(Issuer.parse(value)))
	}, [value])

	return <select id={props.id} onChange={e => setValue(e.target.value)} value={value}>
		<option disabled value="">Sign on via...</option>
		{
			[...clients].map(c => <option key={c.issuer} value={c.issuer}>
				{c.name}
			</option>)
		}
	</select>
}

interface AuthInitiatorProps {
	readonly client: Client | undefined
}

function DisplayError({ summary = "It broke…", error, suppressHydrationWarning}: ErrorProps) {
	return <details>
		<summary>{summary}</summary>
		<p suppressHydrationWarning={suppressHydrationWarning}>{error.toString()}</p>
		<p suppressHydrationWarning={suppressHydrationWarning}>{error.stack}</p>
	</details>
}

const useQueryResultToSomeResult =
	<T, E>(u: UseQueryResult<T, E>):
		Option<Result<T, E>> => {
		if (u.error !== null) return Some(Err(u.error));

		if (u.data !== undefined) return Some(Ok(u.data));

		return None;
	}

/**
 * Attempts to start OIDC auth in this window for a specific OAuth client (
 * or prints an error string..!)
 */
function AuthInitiator(props: AuthInitiatorProps) {
	const storageController = useLocalStorageController();

	const ourLocation = useWindowLocation();


	// wow and I'm sorry
	// could probably also use some higher-order flattener here
	// but not today!!
	const nextUrl = useQuery({
		queryKey: [
			'nexturl',
			// invalidate along with storagecontroller changes.
			option_unwrap_or(and(
				storageController, "controller"), undefined),
			// invalidate along with client issuer changes.
			props.client?.issuer,
			// invalidate along with our location
			option_unwrap_or(
				option_and_then(ourLocation, v => v.href),
				undefined
			),
			// invalidate along with our client id
			props.client?.clientId

		],
		queryFn: async () => {
			const masterKey = ok_or_else(option_and_then(
				storageController,
				v => clientSecret(v)
			), () => new Error("Waiting for master key"));

			const issuer = ok_or_else(props.client?.issuer === undefined
				? None
				: Some(props.client.issuer),
				() => new Error("Please select a client.")
			);

			const challenge = result_and_then(
				result_zip(masterKey, issuer),
				async ([masterKey, issuer]) => challengeStringForIssuer(
					await masterKey,
					issuer
				)
			);

			/**
			 * Our location made with just origin + pathname
			 */
			const callback = ok_or_else(option_and_then(
				ourLocation,
				l => {
					const target = new URL(l.origin);
					target.pathname = l.pathname;

					return target;
				}
			), () => new Error("Missing current location."));

			const challenge_callback = result_and_then(
				result_zip(challenge, callback),
				([challenge, callback]) => [challenge, callback] as const
			);

			const challenge_callback_issuer = result_and_then(
				result_zip(challenge_callback, issuer),
				([[challenge, callback], issuer]) => [
					challenge, callback, issuer
				] as const
			);

			const client_id = ok_or_else( props.client?.clientId === undefined
				? None
				: Some(props.client.clientId)
			, () => new Error("Missing ClientID"));

			// this really needs a higher order pattern, for which I apologise
			const challenge_callback_issuer_client_id = result_and_then(
				result_zip(challenge_callback_issuer, client_id),
				([[challenge, callback, issuer], client_id]) =>
				[challenge, callback, issuer, client_id] as const
			)

			const ret = result_and_then(
				challenge_callback_issuer_client_id,
				async ([challenge, callback, issuer, client_id]) => oidcAuthorizeUri(
					await challenge, await challenge, callback, client_id, new URL(issuer),
				)
			)
			return result_promise_transpose(ret).then(
				r => result_flatten(r)
			)
		}
	})

	if (nextUrl.isLoading) return "⌛";

	if (nextUrl.isError) return <DisplayError error={nextUrl.error}/>;

	if (nextUrl.isSuccess) return result_unwrap_or_else(
		result_and_then(
			nextUrl.data,
			v => redirect(v.toString())
		),
		v => <DisplayError error={v}/>
	)

	throw new Error("Unknown state!")
}

function AuthSelector() {
	const param = useSearchParams();
	const [authClient, setAuthClient] = useState<Client | undefined>(undefined);

	return <>
		<SignOnSelector issuerHint={param.get("hint") ?? undefined} onChange={setAuthClient} />
		{ authClient == undefined? null : <AuthInitiator client={authClient}/>}
	</>
}

const oidcParamsSchema = z.object({
	id_token: z.string(),
	state: z.string()
});

/**
 * Schema for extracting the OIDC callback params from the URL hash component.
 */
const oidcUrlParams = z.string().transform(
	p => Object.fromEntries((new URLSearchParams(p.slice(1))).entries())
).pipe(oidcParamsSchema);

interface ErrorProps {
	readonly summary?: string
	readonly suppressHydrationWarning?: boolean
	readonly error: Error
}

export default function Auth() {
	const location = useWindowLocation();
	const hash = option_and_then(location, l => l.hash);
	const storageController = useLocalStorageController();

	const q = useQueryResultToSomeResult(useQuery({
		queryKey: [
			'callback',
			option_unwrap_or(hash, undefined),
			// invalidate along with storagecontroller changes.
			option_unwrap_or(and(
				storageController, "controller"), undefined),

		],
		queryFn: async () => {
			const masterKey = await result_promise_transpose(ok_or_else(option_and_then(
				storageController,
				v => clientSecret(v)
			), () => new Error("Waiting for master key")));

			const h = ok_or_else(hash, () => new Error(
				"missing hash part in URL"
			));

			const params = result_flatten(result_and_then(
				h,
				h => resultFromZod(oidcUrlParams.safeParse(h))
			));

			const id_token = result_and_then(params,
				params => params.id_token
			)

			const signature = result_and_then(
				params,
				v => b64.toByteArray(v.state)
			);

			const verified_id_token_with_no_specific_issuer = await result_promise_transpose(result_and_then(
				id_token,
				id_token => watch_out_i_am_verifying_the_id_token_with_no_specified_issuer(
					id_token,
					issuer =>
						result_and_then(
							resultFromZod(Issuer.safeParse(issuer)),
							issuer => OAuthClientByIssuer(issuer).clientId
						),
					/** tolerance in seconds */ 60
				)
			)).then(r => result_flatten(r));

			const mk_tok = result_zip(masterKey, verified_id_token_with_no_specific_issuer);

			const mk_tok_sig = result_and_then(
				result_zip(
					mk_tok,
					signature
				),
				([[mk, tok], sig]) => [mk, tok, sig] as const
			)

			const verified_token = result_flatten(await result_promise_transpose(result_and_then(
				mk_tok_sig,
				async ([mk, t, s]) => {
					const verification = await verifyChallengeForIssuer(
						mk, t.payload.iss!, s.buffer as ArrayBuffer) // fuck it

					if (!verification) return Err(new Error("Invalid challenge :("));

					return Ok(t)
				}
			)));

			return [ verified_token, id_token ] as const;
		}
	}));

	const t2 = result_flatten(ok_or_else(
		q,
		() => new Error("Loading!")
	));

	const verified_token = result_flatten( result_and_then(
		t2,
		([v]) => v
	));

	const id_token = result_flatten(result_and_then(
		t2,
		([, v]) => v
	));

	const id_token_and_verified_token = result_zip(
		id_token,
		verified_token
	)

	const resultStorageController = ok_or_else(
		storageController
	, () => new Error("Missing storage controller 😭"));

	const authTokenCache = result_flatten(result_and_then(
		resultStorageController,
		c => {
			const cache = LensGet(AuthorizationCache)(c)

			return cache === null
				? Ok({} as z.TypeOf<typeof authCacheSchema>)
				: cache;

		}
	));

	const verifiedToken_idToken_authTokenCache = result_and_then(
		result_zip(id_token_and_verified_token, authTokenCache),
		([[verified_token, id_token], authTokenCache]) => [
			verified_token, id_token, authTokenCache
		] as const
	)

	/**
        * New new auth token cache with the newly received OIDC id_token
	 * mixed in.
	 */
	const amendedAuthTokenCache = result_and_then(
		verifiedToken_idToken_authTokenCache,
		// agh, maybe the cache should be partitioned by key
		// rather than within the record.
		//
		// there is a race here, but maybe i dont care.
		([id_token, verified_token, authTokenCache]) => ({
			...authTokenCache, // add to existing records
			[verified_token.payload.iss!]: { id_token }
		})
	);

	// we are successful if we managed to put the new auth token in the cache.
	// because of the controller (& localstorage...) everyone will get notified
	// that there is a new token! hurray!

	const amendment = result_and_then(
		result_zip(resultStorageController, amendedAuthTokenCache),

		([c, tc]) => void LensSet(AuthorizationCache)(
				Ok(authCacheSchema.parse(tc))
				, c)
	);

	return result_unwrap_or_else(
		result_and_then(amendment, () => redirect("/")),
		error => <>
			<AuthSelector/>
			{ /* we get a hydration error because higher up in the stack,
			the controller is derived via localStorage
			not sure what to do about it yet.*/}
			<DisplayError error={error} suppressHydrationWarning/>
		</>
	)
}








