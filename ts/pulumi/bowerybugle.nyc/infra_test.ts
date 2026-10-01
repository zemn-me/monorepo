import { expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

const resources: pulumi.runtime.MockResourceArgs[] = [];
void pulumi.runtime.setMocks({
	newResource: args => {
		resources.push(args);
		return {
			id: `${args.name}-id`,
			state: {
				...args.inputs,
				arn: `arn:aws:test:::${args.name}`,
				apiEndpoint: 'https://test.execute-api.us-east-1.amazonaws.com',
				executionArn: 'arn:aws:execute-api:us-east-1:123:api',
				repositoryUrl: '123.dkr.ecr.us-east-1.amazonaws.com/test',
				dkimTokens: ['a', 'b', 'c'],
				verificationToken: 'verified',
				keyId: `${args.name}-key`,
				bucket: `${args.name}-bucket`,
				zoneId: `${args.name}-zone`,
				nameServers: ['ns.example.test'],
			},
		};
	},
	call: args => ({ ...args.inputs, authorizationToken: undefined }),
});

// Import after installing mocks so no provider operations reach AWS.
const { Component } = await import('#root/ts/pulumi/bowerybugle.nyc/index.js');

for (const scenario of [
	{
		name: 'staging',
		staging: true,
		ready: false,
		domain: 'bowerybugle.staging.zemn.me',
	},
	{
		name: 'staging-ready',
		staging: true,
		ready: true,
		domain: 'bowerybugle.staging.zemn.me',
	},
	{
		name: 'bootstrap',
		staging: false,
		ready: false,
		domain: 'bowerybugle.zemn.me',
	},
	{
		name: 'delegated',
		staging: false,
		ready: true,
		domain: 'bowerybugle.nyc',
	},
]) {
	test(scenario.name, async () => {
		const component = new Component(scenario.name, {
			staging: scenario.staging,
			customDomainReady: scenario.ready,
			bootstrapZoneId: 'existing-zone',
		});
		await pulumi.runtime.disconnect();
		const owned = resources.filter(r =>
			r.name.startsWith(`${scenario.name}_`)
		);
		expect(component.domain).toBe(scenario.domain);
		expect(owned.some(r => r.type.startsWith('aws:route53domains/'))).toBe(
			false
		);
		expect(
			owned.filter(r => r.type === 'aws:route53/zone:Zone')
		).toHaveLength(scenario.staging ? 0 : 1);
		expect(
			owned.find(
				r => r.name === `${scenario.name}_website_distribution_record`
			)?.inputs
		).toMatchObject({
			name: scenario.domain,
			zoneId:
				scenario.ready && !scenario.staging
					? `${scenario.name}_zone-zone`
					: 'existing-zone',
		});
		expect(
			owned.find(r => r.type === 'aws:acm/certificate:Certificate')
				?.inputs.domainName
		).toBe(scenario.domain);
		const distribution = owned.find(
			r => r.type === 'aws:cloudfront/distribution:Distribution'
		);
		expect(distribution?.inputs.orderedCacheBehaviors).toContainEqual(
			expect.objectContaining({
				pathPattern: '/api/*',
				minTtl: 0,
				defaultTtl: 0,
				maxTtl: 0,
				forwardedValues: {
					queryString: false,
					headers: ['Origin', 'Content-Type'],
					cookies: { forward: 'all' },
				},
			})
		);
		expect(
			owned.find(
				r =>
					r.type ===
					'aws:s3/bucketPublicAccessBlock:BucketPublicAccessBlock'
			)?.inputs
		).toMatchObject({
			blockPublicAcls: true,
			blockPublicPolicy: true,
			ignorePublicAcls: true,
			restrictPublicBuckets: true,
		});
		expect(
			owned.find(
				r => r.type === 'aws:s3/bucketVersioningV2:BucketVersioningV2'
			)?.inputs.versioningConfiguration.status
		).toBe('Enabled');
		expect(
			owned.find(
				r =>
					r.type ===
					'aws:s3/bucketCorsConfigurationV2:BucketCorsConfigurationV2'
			)?.inputs.corsRules[0].allowedOrigins
		).toEqual([`https://${scenario.domain}`]);
		expect(
			owned.find(r => r.type === 'aws:dynamodb/table:Table')?.inputs
		).toMatchObject({
			hashKey: 'kind',
			rangeKey: 'id',
			ttl: { attributeName: 'expires', enabled: true },
			pointInTimeRecovery: { enabled: !scenario.staging },
		});
		expect(
			owned.filter(r => r.type === 'aws:ses/emailIdentity:EmailIdentity')
		).toHaveLength(scenario.staging ? 0 : 1);
		const permissions = owned.find(
			r => r.name === `${scenario.name}_backend_permissions`
		);
		const policy = JSON.parse(permissions?.inputs.policy ?? '{}');
		expect(
			policy.Statement.find((s: { Action: string[] }) =>
				s.Action.includes('ses:SendEmail')
			).Condition
		).toEqual({
			'ForAllValues:StringEquals': {
				'ses:Recipients': ['bowerybugle@gmail.com'],
			},
		});
		expect(
			owned.find(r => r.type === 'aws:kms/key:Key')?.inputs
		).toMatchObject({
			customerMasterKeySpec: 'HMAC_256',
			keyUsage: 'GENERATE_VERIFY_MAC',
		});
		expect(
			policy.Statement.find((s: { Action: string[] }) =>
				s.Action.includes('kms:GenerateMac')
			).Resource
		).toBe(`arn:aws:test:::${scenario.name}_backend_login_key`);
		const fn = owned.find(r => r.type === 'aws:lambda/function:Function');
		expect(fn?.inputs.environment.variables).toMatchObject({
			AUTHOR_EMAIL: 'bowerybugle@gmail.com',
			LOGIN_KEY_ID: `${scenario.name}_backend_login_key-key`,
			SITE_ORIGIN: `https://${scenario.domain}`,
		});
	});
}
