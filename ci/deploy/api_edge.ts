import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const site = 'https://staging.zemn.me';
const api = 'https://api.staging.zemn.me';

async function get(path: string, headers: Record<string, string> = {}) {
	const response = await fetch(api + path, {
		headers: { Origin: site, 'Accept-Encoding': 'gzip', ...headers },
		redirect: 'error',
		signal: AbortSignal.timeout(40_000),
	});
	assert.equal(response.status, 200, `GET ${path} returned ${response.status}`);
	return response;
}

// Use a public archive and an ordinary API route so both behaviors are
// exercised without an authenticated session or a write to staging.
export async function verifyStagingApiEdge() {
	const archive = '/earth-orbits/elements/2006-08-01';
	const visit = () => {
		const viewer = randomUUID();
		return get(archive + '?viewer=' + viewer, { Cookie: 'edge-test=' + viewer });
	};
	const first = await visit();
	const elements = await first.text();
	assert.ok(/^1 .+\r?\n2 /m.test(elements), 'Expected a pair of orbital element lines');

	const second = await visit();
	assert.equal(second.headers.get('x-cache'), 'Hit from cloudfront');
	assert.equal(second.headers.get('access-control-allow-origin'), site);
	assert.equal(second.headers.get('content-encoding'), 'gzip');
	assert.match(second.headers.get('cache-control') ?? '', /\bmax-age=31536000\b/);
	assert.ok((await second.text()) === elements, 'Cached orbital elements changed');

	for (let request = 0; request < 2; request++) {
		const metadata = await get('/.well-known/openid-configuration');
		assert.equal(metadata.headers.get('x-cache'), 'Miss from cloudfront');
		assert.equal((await metadata.json()).issuer, api);
	}
}
