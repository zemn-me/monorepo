import createFetchClient from 'openapi-fetch';
import { createCookie } from 'react-router';
import type { paths } from '#root/project/me/zemn/api/api_client.gen.js';
import { ZEMN_ME_API_BASE } from '#root/project/me/zemn/constants/constants.js';
import { watchOutParseIdToken } from '#root/ts/oidc/oidc.js';

// The API verifies the signed credential; cookie serialization is not authentication.
const authorization = createCookie('__Host-zemn-authorization', {
	httpOnly: true,
	secure: true,
	sameSite: 'lax',
	path: '/',
});
export const privateHeaders = {
	'Cache-Control': 'private, no-store',
	Vary: 'Cookie, Authorization',
};

export async function verifySession(token: unknown, signal: AbortSignal) {
	if (typeof token !== 'string') return null;
	const parsed = watchOutParseIdToken.safeParse(token);
	if (
		!parsed.success ||
		!parsed.data.jti ||
		parsed.data.exp <= Date.now() / 1000
	)
		return null;
	const client = createFetchClient<paths>({
		baseUrl: ZEMN_ME_API_BASE,
		headers: { Authorization: token },
		signal,
		cache: 'no-store',
	});
	const response = await client.GET('/me/scopes');
	if (response.response.status === 401 || response.response.status === 403)
		return null;
	if (!response.data)
		throw new Response('Login service unavailable', {
			status: 503,
			headers: privateHeaders,
		});
	return {
		client,
		session: { claims: parsed.data, scopes: response.data.scopes },
	};
}

export async function readSession(request: Request) {
	let token: unknown;
	try {
		token = await authorization.parse(request.headers.get('Cookie'));
	} catch {
		return null;
	}
	return verifySession(token, request.signal);
}

export async function updateSession(request: Request) {
	// The cookie authenticates document reads only. Browser API writes still use
	// Authorization; this endpoint alone changes the cookie and requires same origin.
	if (request.headers.get('Origin') !== new URL(request.url).origin)
		return new Response('Forbidden', {
			status: 403,
			headers: privateHeaders,
		});
	if (request.method === 'DELETE')
		return new Response(null, {
			status: 204,
			headers: {
				...privateHeaders,
				'Set-Cookie': await authorization.serialize('', {
					maxAge: 0,
					expires: new Date(0),
				}),
			},
		});
	if (request.method !== 'POST')
		return new Response('Method not allowed', {
			status: 405,
			headers: { ...privateHeaders, Allow: 'POST, DELETE' },
		});
	const token = request.headers.get('Authorization');
	const verified = await verifySession(token, request.signal);
	if (!verified)
		return new Response('Unauthorized', {
			status: 401,
			headers: privateHeaders,
		});
	const cookie = await authorization.serialize(token, {
		expires: new Date(verified.session.claims.exp * 1000),
	});
	if (cookie.length > 4096)
		return new Response('Credential too large', {
			status: 400,
			headers: privateHeaders,
		});
	return new Response(null, {
		status: 204,
		headers: { ...privateHeaders, 'Set-Cookie': cookie },
	});
}
