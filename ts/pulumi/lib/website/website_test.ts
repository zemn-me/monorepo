import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';
import Website from './website.js';

const resources: pulumi.runtime.MockResourceArgs[] = [];
void pulumi.runtime.setMocks({
	newResource: args => {
		resources.push(args);
		return {
			id: args.name,
			state: {
				...args.inputs,
				name: args.inputs['name'] ?? args.name,
				arn: `arn:aws:example:us-east-1:123456789012:${args.name}`,
				apiEndpoint:
					'https://example.execute-api.us-east-1.amazonaws.com',
				executionArn:
					'arn:aws:execute-api:us-east-1:123456789012:example',
				bucketRegionalDomainName: 'example.s3.us-east-1.amazonaws.com',
				result: 'origin-secret',
				domainValidationOptions: [
					{
						resourceRecordName: '_validation.example.com',
						resourceRecordValue: 'validation',
						resourceRecordType: 'CNAME',
					},
				],
			},
		};
	},
	call: args => args.inputs,
});

test('hybrid hosting keeps static sites intact and separates asset caching from request-aware SSR', async () => {
	const directory = mkdtempSync(path.join(tmpdir(), 'remix-infra-'));
	writeFileSync(path.join(directory, 'index.html'), '<html>Home</html>');
	writeFileSync(path.join(directory, '404.html'), '<html>Not found</html>');
	const serverDirectory = mkdtempSync(path.join(tmpdir(), 'remix-server-'));
	writeFileSync(
		path.join(serverDirectory, 'assets.json'),
		JSON.stringify(['/assets/*', '/sha256/*', '/icon.svg'])
	);
	const bundleDirectory = mkdtempSync(path.join(tmpdir(), 'remix-bundle-'));
	writeFileSync(
		path.join(bundleDirectory, 'handler.mjs'),
		'export const handler = () => {};'
	);
	mkdirSync(path.join(bundleDirectory, 'prerendered'));
	writeFileSync(
		path.join(bundleDirectory, 'prerendered/index.html'),
		'<html>Snapshot</html>'
	);
	symlinkSync(
		path.join(bundleDirectory, 'handler.mjs'),
		path.join(serverDirectory, 'handler.mjs')
	);
	symlinkSync(
		path.join(bundleDirectory, 'prerendered'),
		path.join(serverDirectory, 'prerendered')
	);
	const args = {
		directory,
		index: path.join(directory, 'index.html'),
		notFound: path.join(directory, '404.html'),
		domain: 'example.com',
		zoneId: 'zone',
		email: false,
		noIndex: false,
	};
	new Website('static', args);
	new Website('hybrid.zemn.me', {
		...args,
		serverDirectory,
		wellKnownOidcDomain: 'api.example.com',
	});
	await pulumi.runtime.disconnect();

	const resource = (type: string, name: string) => {
		const value = resources.find(
			item => item.type === type && item.name === name
		);
		expect(value).toBeDefined();
		return value!.inputs;
	};
	const staticSite = resource(
		'aws:cloudfront/distribution:Distribution',
		'static_cloudfront_distribution'
	);
	expect(staticSite['defaultRootObject']).toBe('index');
	expect(staticSite['defaultCacheBehavior']).toMatchObject({
		targetOriginId: 'static_cloudfront_distribution',
		forwardedValues: { queryString: false, cookies: { forward: 'none' } },
	});
	expect(
		resources.filter(item => item.type === 'aws:lambda/function:Function')
	).toHaveLength(1);
	const site = resource(
		'aws:cloudfront/distribution:Distribution',
		'hybrid.zemn.me_cloudfront_distribution'
	);
	expect(site['defaultRootObject']).toBeUndefined();
	expect(site['defaultCacheBehavior']).toMatchObject({
		targetOriginId: 'hybrid.zemn.me_remix',
		cachePolicyId: 'hybrid.zemn.me_remix_cache',
		originRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
		allowedMethods: expect.arrayContaining([
			'GET',
			'HEAD',
			'POST',
			'PUT',
			'PATCH',
			'DELETE',
		]),
	});
	expect(site['defaultCacheBehavior']).not.toHaveProperty('forwardedValues');
	expect(site['customErrorResponses']).toEqual(
		expect.arrayContaining([
			{ errorCode: 404, errorCachingMinTtl: 0 },
			{ errorCode: 500, errorCachingMinTtl: 0 },
		])
	);
	expect(site['orderedCacheBehaviors']).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				pathPattern: '/assets/*',
				targetOriginId: 'hybrid.zemn.me_cloudfront_distribution',
			}),
			expect.objectContaining({
				pathPattern: '/sha256/*',
				targetOriginId: 'hybrid.zemn.me_cloudfront_distribution',
			}),
			expect.objectContaining({
				pathPattern: '/.well-known/jwks.json',
				targetOriginId: 'hybrid.zemn.me_oidc_api',
			}),
		])
	);
	expect(site['origins']).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				originId: 'hybrid.zemn.me_remix',
				domainName: 'example.execute-api.us-east-1.amazonaws.com',
				customHeaders: [
					{ name: 'X-Remix-Origin-Secret', value: 'origin-secret' },
				],
			}),
		])
	);
	const policy = resource(
		'aws:cloudfront/cachePolicy:CachePolicy',
		'hybrid.zemn.me_remix_cache'
	);
	expect(policy).toMatchObject({
		minTtl: 0,
		defaultTtl: 0,
		parametersInCacheKeyAndForwardedToOrigin: {
			cookiesConfig: { cookieBehavior: 'all' },
			queryStringsConfig: { queryStringBehavior: 'all' },
			headersConfig: {
				headers: {
					items: expect.arrayContaining([
						'Authorization',
						'Accept',
						'Origin',
					]),
				},
			},
		},
	});
	const lambda = resource(
		'aws:lambda/function:Function',
		'hybrid_zemn_me_remix'
	);
	const code = lambda['code'];
	expect(pulumi.asset.AssetArchive.isInstance(code)).toBe(true);
	const files = await code.assets;
	expect(Object.keys(files).sort()).toEqual([
		'assets.json',
		'handler.mjs',
		'prerendered/index.html',
	]);
	expect(readFileSync(await files['handler.mjs'].path, 'utf8')).toContain(
		'export const handler'
	);
	expect(
		readFileSync(await files['prerendered/index.html'].path, 'utf8')
	).toBe('<html>Snapshot</html>');
	expect(lambda).toMatchObject({
		runtime: 'nodejs24.x',
		handler: 'handler.handler',
		environment: {
			variables: {
				PUBLIC_ORIGIN: 'https://example.com',
				REMIX_ORIGIN_SECRET: 'origin-secret',
			},
		},
	});
});
