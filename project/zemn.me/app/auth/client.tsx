"use client"
/**
 * @fileoverview
 * OAuth callback page etc.
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import b64 from 'base64-js';
import { redirect } from "next/navigation";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { stringToJSON } from 'zod_utilz';

import { ClientSecret, IdToken, LGet, LSet } from "#root/project/zemn.me/localStorage/localStorage.js";
import { and_then as option_and_then, None, Option, Some, unwrap_or_else as option_unwrap_or_else } from "#root/ts/option/types.js";
import { and_then as result_and_then, Err, flatten as result_flatten, Ok, Result, unwrap_or_else as result_unwrap_or_else } from '#root/ts/result_types.js';

interface Client {
	clientId: string
	issuer: URL
}

const clients: Client[] = [
	{
		issuer: new URL("https://accounts.google.com"),
		clientId: `845702659200-q34u98lp91f1tqrqtadgsg78thp207sd.apps.googleusercontent.com`
	}
];

const openidConfiguration = z.object({
	issuer: z.string(),
	response_types_supported: z.string().array(),
	subject_types_supported: z.string().array(),
	scopes_supported: z.string().array(),
	claims_supported: z.string().array(),
	authorization_endpoint: z.string().url(),
});

const openidConfigPathName = ".well-known/openid-configuration";

const getOpenidConfig = (issuer: URL) => {
	const clone = new URL(issuer);
	clone.pathname = openidConfigPathName;

	return fetch(clone).then(b => b.json())
		.then(json => openidConfiguration.safeParse(json))
}

interface SignOnSelectorProps {
	readonly onChange: (c: Client | undefined) => void,
	readonly id?: string
}

function SignOnSelector(props: SignOnSelectorProps) {
	const mapping = useMemo(() => new Map(
		clients.map(c => [c.issuer.host, c])
	), [clients]);

	const onSelectionChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => props.onChange(mapping.get(e.target.value))
	, [ props.onChange, mapping ])

	return <select defaultValue={""} id={props.id} onChange={onSelectionChange}>

		<option disabled value="">Sign on via...</option>
		{
			[...mapping].map(([host]) => <option key={host}>
				{host}
			</option>)
		}
	</select>
}

const userClientSecret = () => {
	const secret = ClientSecret[0](localStorage);
	if (secret !== null) return secret;

	const bytes = new Uint8Array(64);
	crypto.getRandomValues(bytes);
	ClientSecret[1](bytes, localStorage);
	return ClientSecret[0](localStorage)!
};

const userClientSecretKey = () => crypto.subtle.importKey(
	"raw",
	userClientSecret(),
	{ name: "HMAC", hash: "SHA-256" },
	false,
	["sign", "verify"]
);

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
async function challengeForIssuer(issuer: string) {
	return crypto.subtle.sign("HMAC", await userClientSecretKey(), new TextEncoder().encode(challengeStringHashInputForIssuer(issuer)));

}

async function verifyChallengeForIssuer(issuer: string, signature: ArrayBuffer) {	return crypto.subtle.verify(
		"HMAC",
		await userClientSecretKey(),
		signature,
		new TextEncoder().encode(challengeStringHashInputForIssuer(issuer))
	)
}

interface AuthInitiatorProps {
	readonly client: Client | undefined
}

function AuthInitiator(props: AuthInitiatorProps) {
	const serverInfo = useQuery({
		queryKey: ['authInitiator', props.client?.issuer.toString()],
		queryFn: () => props.client == undefined ?
			undefined : getOpenidConfig(props.client.issuer)
	});

	const challenge = useQuery({
		queryKey: ['issuerChallenge', props.client?.issuer.toString()],
		queryFn: () => props.client?.issuer == undefined ? undefined :
			challengeForIssuer(props.client.issuer.toString()).then(
				challenge => b64.fromByteArray(new Uint8Array(challenge))
			)
	});

	if (!props.client) return;

	let error: string | undefined;

	if (serverInfo.isLoading) return "⏳";

	if (serverInfo.isError || !serverInfo.data?.success) return <details>
		<summary>⚠ It broke...</summary>
		{serverInfo.error === null? serverInfo.error: serverInfo.error.toString()}
		{serverInfo.data?.error?.toString()}
	</details>;

	if (challenge.isError) return <details>
		<summary>⚠ It broke...</summary>
		{challenge.error.toString()}
	</details>

	if (!serverInfo.data.data.response_types_supported.includes("id_token")
		|| !serverInfo.data.data.scopes_supported.includes("openid"))
		error = "Server doesn't support OIDC."

	if (error) return "⚠ " + error;

	const ourUri = new URL(window.location.href);
	const callbackUri = new URL(window.location.origin);
	callbackUri.pathname = ourUri.pathname;

	const target = new URL(serverInfo.data.data.authorization_endpoint);
	const params = new URLSearchParams({
		response_type: 'id_token',
		client_id: props.client.clientId,
		redirect_uri: callbackUri.toString(),
		scope: 'openid',
		nonce: challenge.data!,
		state: challenge.data!,
	});

	target.search = params.toString();

	window.location.assign(
		target
	)
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
	const [hash, setHash] = useState<string>(location.hash);

	useEffect(() => {
		setHash(window.location.hash)
	}, [setHash]);

	const tok = useQueryResultToSomeResult(useQuery({
		queryKey: ['callback', hash],
		queryFn: async () => {
			const params = oidcUrlParams.safeParse(hash);
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
				"You are logged in. If you want to log in again, use the form below.": null
		}
		<AuthSelector/>
		</>



}








