'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryState } from 'nuqs';

import type { components } from '#root/project/me/zemn/api/api_client.gen.js';
import { InlineLogin } from '#root/project/me/zemn/components/InlineLogin/inline_login.js';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';
import { useZemnMeAuth } from '#root/project/me/zemn/hook/useZemnMeAuth.js';
import { useQueryFuture } from '#root/ts/future/react-query/useQuery.js';

export default function JournalConnectPage() {
	const [request] = useQueryState('request', parseAsString);
	const [identity, , login] = useZemnMeAuth();
	const endpoint = new URL(
		`/oauth2/requests/${encodeURIComponent(request ?? '')}`,
		ZEMN_ME_API_BASE
	);
	const details = useQueryFuture(
		useQuery({
			queryKey: ['journal-oauth-request', request],
			enabled: request !== null,
			retry: false,
			gcTime: 0,
			queryFn: async (): Promise<
				components['schemas']['OAuthConsentDetails']
			> => {
				const response = await fetch(endpoint, {
					cache: 'no-store',
					credentials: 'omit',
				});
				if (!response.ok)
					throw new Error(
						'This connection request has expired. Start again from your MCP client.'
					);
				return response.json();
			},
		})
	);
	const decision = useMutation({
		mutationFn: async ({
			token,
			approve,
		}: {
			token: string;
			approve: boolean;
		}) => {
			const response = await fetch(endpoint, {
				method: 'POST',
				cache: 'no-store',
				credentials: 'omit',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ approve }),
			});
			if (!response.ok)
				throw new Error(
					response.status === 403
						? 'This account does not have access to the journal.'
						: 'Unable to complete this connection. Start again from your MCP client.'
				);
			const result: components['schemas']['OAuthConsentResult'] =
				await response.json();
			window.location.assign(result.redirect_uri);
		},
	});
	const loginButton = () => (
		<button
			aria-label="Authenticate with OIDC"
			disabled={login(
				() => false,
				() => true,
				() => true
			)}
			onClick={login(
				prompt => () => {
					void prompt();
				},
				() => undefined,
				() => undefined
			)}
			type="button"
		>
			Sign in to zemn.me
		</button>
	);
	return (
		<main>
			<h1>Connect your voice journal</h1>
			{!request ? (
				<p role="alert">Start this connection from your MCP client.</p>
			) : (
				details(
					client => (
						<>
							<p>
								<strong>{client.client_name}</strong> is
								requesting access to your voice journal.
							</p>
							<p>
								This grants permission to search entries and
								read transcripts and summaries, including their
								citations.
							</p>
							<p>
								The client cannot record, change, or delete
								entries. Only connect clients you trust with
								your private journal.
							</p>
							<p>
								Return address:{' '}
								<code>{client.redirect_uri}</code>
							</p>
							<details>
								<summary>Client identity</summary>
								<p>
									<code>{client.client_id}</code>
								</p>
								<p>Permission: {client.scope}</p>
							</details>
							{identity(
								token => (
									<>
										<InlineLogin />
										<p>
											<button
												disabled={decision.isPending}
												onClick={() =>
													decision.mutate({
														token,
														approve: true,
													})
												}
												type="button"
											>
												Allow journal access
											</button>{' '}
											<button
												disabled={decision.isPending}
												onClick={() =>
													decision.mutate({
														token,
														approve: false,
													})
												}
												type="button"
											>
												Cancel connection
											</button>
										</p>
									</>
								),
								loginButton,
								loginButton
							)}
							{decision.isPending ? (
								<p role="status">Completing connection…</p>
							) : null}
							{decision.error ? (
								<p role="alert">{decision.error.message}</p>
							) : null}
						</>
					),
					() => <p role="status">Loading connection request…</p>,
					error => <p role="alert">{error.message}</p>
				)
			)}
		</main>
	);
}
