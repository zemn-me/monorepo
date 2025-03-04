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
import { redirect } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { stringToJSON } from 'zod_utilz';

import { useLocalStorageController } from "#root/project/zemn.me/app/hook/useLocalStorage.js";
import { clientSecret } from "#root/project/zemn.me/localStorage/localStorage.js";
import { Client, clients, Issuer, OAuthClientByIssuer } from "#root/project/zemn.me/OAuth/clients.js";
import { oidcAuthorizeUri } from "#root/ts/jose/oidc/oidc.js";
import { and, and_then as option_and_then, None, Option, Some, unwrap_or as option_unwrap_or, unwrap_or, unwrap_or_else as option_unwrap_or_else, zip } from "#root/ts/option/types.js";
import { and_then } from "#root/ts/result_types.js";

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
}

/**
 * Allows the user to pick from one of several OIDC+OAuth clients.
 */
function SignOnSelector(props: SignOnSelectorProps) {
	const onSelectionChange = useCallback(
		(e: ChangeEvent<HTMLSelectElement>) => props.onChange(
			OAuthClientByIssuer(Issuer.parse(e.target.value))
		)
	, [ props.onChange ])

	return <select defaultValue={""} id={props.id} onChange={onSelectionChange}>
		<option disabled value="">Sign on via...</option>
		{
			[...clients].map(c => <option key={c.issuer}>
				{c.name}
			</option>)
		}
	</select>
}


const challengeForIssuerPrefix = "0|";

const challengeStringHashInputForIssuer =
	(issuer: string) => challengeForIssuerPrefix + issuer;

/**
 * Generates an entropy challenge for a given issuer.
 *
 * I dont really care too much for n-onces. These can
 * be used as state tokens without worrying too much
 * about disclosure.
 *
 * It's possible the state tokens could build up in logs
 * and stuff but overall i dont care rn.
 */
async function challengeForIssuer(masterKey: CryptoKey, issuer: string) {
	return crypto.subtle.sign("HMAC", masterKey, new TextEncoder().encode(challengeStringHashInputForIssuer(issuer)));
}

async function challengeStringForIssuer(masterKey: CryptoKey, issuer: string) {
	return b64.fromByteArray(new Uint8Array(await challengeForIssuer(masterKey, issuer)))
}

async function verifyChallengeForIssuer(masterKey: CryptoKey, issuer: string, signature: ArrayBuffer) {	return crypto.subtle.verify(
		"HMAC",
		masterKey,
		signature,
		new TextEncoder().encode(challengeStringHashInputForIssuer(issuer))
	)
}

interface AuthInitiatorProps {
	readonly client: Client | undefined
}

/**
 * Attempts to start OIDC auth in this window for a specific OAuth client.
 */
function AuthInitiator(props: AuthInitiatorProps) {
	const storageController = useLocalStorageController();

	const ourLocation = useWindowLocation();



	const nextUrl = useQuery({
		queryKey: [
			'masterkey',
			// invalidate along with storagecontroller changes.
			unwrap_or(and(
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
			const masterKey = option_and_then(
				storageController,
				v => clientSecret(v)
			);

			const issuer = props.client?.issuer === undefined
				? None
				: Some(props.client.issuer);

			const challenge = option_and_then(
				zip(masterKey, issuer),
				async ([masterKey, issuer]) => challengeStringForIssuer(
					await masterKey,
					issuer
				)
			);

			/**
			 * Our location made with just origin + pathname
			 */
			const callback = option_and_then(
				ourLocation,
				l => {
					const target = new URL(l.origin);
					target.pathname = l.pathname;

					return target;
				}
			)

			const challenge_callback = option_and_then(
				zip(challenge, callback),
				([challenge, callback]) => [challenge, callback] as const
			);

			const challenge_callback_issuer = option_and_then(
				zip(challenge_callback, issuer),
				([[challenge, callback], issuer]) => [
					challenge, callback, issuer
				] as const
			);

			const client_id = props.client?.clientId === undefined
				? None
				: Some(props.client.clientId);

			// this really needs a higher order pattern, for which I apologise
			const challenge_callback_issuer_client_id = option_and_then(
				zip(challenge_callback_issuer, client_id),
				([[challenge, callback, issuer], client_id]) =>
				[challenge, callback, issuer, client_id] as const
			)

			return option_and_then(
				challenge_callback_issuer_client_id,
				async ([challenge, callback, issuer, client_id]) => oidcAuthorizeUri(
					await challenge, await challenge, callback, client_id, new URL(issuer),
				)
			)
		}
	})




	return option_unwrap_or_else(option_and_then(
		params,
		params => {
			target.search = params.toString();
			return redirect(target.toString())
		}
	), () => null);
}

export function AuthSelector() {
	const [authClient, setAuthClient] = useState<Client | undefined>(undefined);

	return <>
		<SignOnSelector onChange={setAuthClient} />
		{ authClient == undefined? null : <AuthInitiator client={authClient}/>}
	</>
}

const oidcParamsSchema = z.object({
	id_token: z.string(),
	state: z.string()
});

// i should modify this later to actually validate the jwt
const unsafeJwtIssParser = z.string().transform(
	s => s.split(".")
).pipe(
	z.tuple([z.string(), z.string(), z.string()])
).transform(([, body]) => b64.toByteArray(body))
.transform(b => new TextDecoder().decode(b))
	.pipe(
stringToJSON()
).pipe(
	z.object({
		iss: z.string()
	})
).transform(o => o.iss);

const oidcUrlParams = z.string().transform(
	p => Object.fromEntries((new URLSearchParams(p.slice(1))).entries())
).pipe(oidcParamsSchema);

interface ErrorProps {
	readonly summary?: string
	readonly error: Error
}

function DisplayError({ summary = "It broke…", error}: ErrorProps) {
	return <details>
		<summary>{summary}</summary>
		{error.toString()}
	</details>
}

const useQueryResultToSomeResult =
	<T, E>(u: UseQueryResult<T, E>):
		Option<Result<T, E>> => {
		if (u.error !== null) return Some(Err(u.error));

		if (u.data !== undefined) return Some(Ok(u.data));

		return None;
	}


function errorCtx(error: unknown, context: string): Error {
    if (error instanceof Error) {
        return new Error(`${context}: ${error.message}`, { cause: error });
    }
    return new Error(`${context}: ${String(error)}`);
}

export default function Auth() {
	const location = useWindowLocation();
	const hash = option_and_then(location, l => l.hash);

	const tok = useQueryResultToSomeResult(useQuery({
		queryKey: ['callback', hash],
		queryFn: async () => {
			const h = option_unwrap_or(hash, undefined);
			if (h === undefined) return Err(new Error("no hash part"));
			const params = oidcUrlParams.safeParse(h);
			if (!params.success) return Err(errorCtx(params.error, "parsing params"));

			const issuer = unsafeJwtIssParser.safeParse(params.data.id_token);
			if (!issuer.success) return Err(errorCtx(
				issuer.error,
				"parsing id_token"
			));

			if (! await verifyChallengeForIssuer(
				issuer.data,
				b64.toByteArray(params.data.state).buffer as ArrayBuffer
			)) Err(new Error("Challenge invalid"));

			return Ok(params.data.id_token);
		}
	}));

	const a = option_and_then(
		tok,
		r => result_unwrap_or_else(
			result_and_then(
				result_flatten(r),
				token => {
					LSet(IdToken, localStorage, token);
					redirect('/');
				}
			),
			e => <DisplayError error={e}/>
		)
	)

	return <> {option_unwrap_or_else(
		a, () => null
	)}

		{
			/* below should be a hook at some point */
			LGet(IdToken, localStorage) !== null?
				<p>You are logged in. If you want to log in again, use the form below.</p>: null
		}
		<AuthSelector/>
		</>



}








