"use client";

import { useRouter } from 'next/navigation';
import { type inferParserType, parseAsString, useQueryStates } from 'nuqs';
import { useEffect } from 'react';

import { useZemnMeApi } from '#root/project/zemn.me/hook/useZemnMeApi.js';

const querySchema = {
	/** OAuth 2 response type – selects code / implicit / hybrid flow. */
	response_type: parseAsString,

	/** Client identifier issued during registration. */
	client_id: parseAsString,

	/** Redirect URI that **must** exactly match a registered value. */
	redirect_uri: parseAsString,

	scope: parseAsString,

	/** Opaque value for CSRF mitigation – returned verbatim. */
	state: parseAsString,

	/**
	 * Associates client session with resulting ID Token; mandatory for the
	 * implicit & hybrid flows.
	 */
	nonce: parseAsString,

	/* ── UI hints ──────────────────────────────────────────────────────────── */

	/** Suggests how the OP should render its UI. */
	display: parseAsString,

	/**
	 * Space-delimited directives governing user interaction
	 * (e.g., `login`, `consent`, `none`).
	 */
	prompt: parseAsString,

	/* ── Authentication constraints ───────────────────────────────────────── */

	/** Maximum seconds since the user last actively authenticated. */
	max_age: parseAsString,

	/** Preferred languages for OP UI (space-separated BCP-47 tags). */
	ui_locales: parseAsString,

	/** Previously issued ID Token used as a login hint (raw JWT). */
	id_token_hint: parseAsString,

	/** User identifier hint (e-mail, phone number, etc.). */
	login_hint: parseAsString,

	/** Preferred Authentication Context Class References (space-delimited). */
	acr_values: parseAsString,

	/* ── Response handling tweaks ─────────────────────────────────────────── */

	/** Instructs OP how to return parameters (`query`, `fragment`, etc.). */
	response_mode: parseAsString
}

type QueryParams = inferParserType<typeof querySchema>;

interface AuthErrorParams {
	/** Error code (e.g., 'login_required', 'invalid_request') */
	error:
	| 'interaction_required'
	| 'login_required'
	| 'account_selection_required'
	| 'consent_required'
	| 'invalid_request_uri'
	| 'invalid_request_object'
	| 'request_not_supported'
	| 'request_uri_not_supported'
	| 'registration_not_supported'
	| 'invalid_request' // from OAuth 2.0
	| 'unauthorized_client'
	| 'access_denied'
	| 'unsupported_response_type'
	| 'invalid_scope'
	| 'server_error'
	| 'temporarily_unavailable';

	/** Optional human-readable description of the error */
	error_description?: string;

	/** Optional URI with more information about the error */
	error_uri?: string;

	/** Required if state was present in the original request */
	state?: string;
}

export function errorRedirectUri(
	redirectUri: string,
	params: AuthErrorParams
): string {
	const url = new URL(redirectUri);
	const searchParams = url.searchParams;

	for (const [k, v] of Object.entries(params)) {
		if (v == undefined) continue;
		searchParams.set(k, v);
	}

	return url.toString();
}

interface displayErrorProps {
	readonly children: React.ReactNode;
	readonly error?: Error
}

function E({ children, error }: displayErrorProps) {
	return <output>
		<p>{children}</p>
		{error && <p>The error was: <code>{error.message}</code></p>}
	</output>;
}


function EBadRequestNoTrust(props: { readonly error?: Error}) {
	const r = useRouter();
	return <E error={props.error}>
		<p>A login request was attempted, but it was made incorrectly and we were unable to verify trust of the requesting party. Click here to go back: <button onClick={() => r.back()}>↺</button>.
		</p>
	</E>
}

type Filled<T, K extends keyof T> = Omit<T, K> & {
	[K2 in K]: NonNullable<T[K2]>;
}



interface SignInRedirectUriTrustedParams {
	readonly params: Filled<QueryParams, 'redirect_uri' | 'client_id'>;
}

function SignInRedirectUriTrusted({ params }: SignInRedirectUriTrustedParams) {
	if (params.response_type !== 'implicit') return <E>
		<p>Unsupported response type: <code>{params.response_type}</code>. Only <code>implicit</code> is supported at this time.</p>
	</E>;

	if (params.display !== null) return <E>
		<p>The request includes a display type and these are unsupported right now.</p>
	</E>;



	return <Next params={{ ...params, scope: params.scope ?? '' }} provider="accounts.google.com" />;
}



function Next({params, provider}: { readonly params: Filled<QueryParams, 'redirect_uri' | 'client_id' | 'scope'>, readonly provider: string }) {
	const router = useRouter();
	const $api = useZemnMeApi();

	const nextRq = $api.useQuery("post", "/oauth/connect", {
		body: {
			clientId: params.client_id,
			nonce: params.nonce ?? undefined,
			redirectUri: params.redirect_uri,
			scope: params.scope,
			state: params.state ?? undefined,
			provider,
		}
	});

	// if we have a next URL, send the user to it.
	useEffect(() => {
		if (!nextRq.data?.next) return;
		const wnd = window.open(nextRq.data.next, "_blank", "noopener,noreferrer");

		if (wnd == null) return void router.push(nextRq.data.next);

		wnd.focus();

		return () => wnd.close();
	}, [nextRq.data?.next])

	if (!nextRq.isSuccess) {
		return <E error={new Error(nextRq.error?.cause)}>
			<p>Failed to connect to the provider: <code>{provider}</code>.</p>
			<p>Please try again later.</p>
		</E>;
	};





}


export default function SignInPage() {
	const [params] = useQueryStates(
		querySchema
	);

	const $api = useZemnMeApi();

	// in this preamble it's possible for an error to occur,
	// but we have NOT validated the redirect_uri yet so we cannot
	// safely perform a redirect.

	if (params.client_id == null) return <EBadRequestNoTrust error={new Error("Missing client_id parameter")} />;
	if (params.redirect_uri == null) return <EBadRequestNoTrust error={new Error("Missing redirect_uri parameter")} />;


	const verify_response = $api.useQuery("post", "/oauth/verify_redirect_uri", {
		body: {
			clientId: params.client_id,
			redirectUri: params.redirect_uri
		}
	});

	if (!verify_response.isSuccess) return <EBadRequestNoTrust error={new Error(verify_response.error?.cause)} />;


	if (verify_response.data.valid != true) {
		return <EBadRequestNoTrust error={new Error("Invalid redirect_uri")}/>;
	}

	// ok redirect_uri is valid

	return <SignInRedirectUriTrusted params={{
		...params,
		// this is only needed due to weird TS BS
		client_id: params.client_id,
		redirect_uri: params.redirect_uri
	}} />;
}
