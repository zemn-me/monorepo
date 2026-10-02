import { expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

const resources: pulumi.runtime.MockResourceArgs[] = [];
const calls: pulumi.runtime.MockCallArgs[] = [];
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
	call: args => {
		calls.push(args);
		return {
			...args.inputs,
			authorizationToken: undefined,
			secretData: 'test-token',
		};
	},
});

// Import after installing mocks so no provider operations reach AWS.
const { Component } = await import('#root/ts/pulumi/bowerybugle.nyc/index.js');

for (const scenario of [
	{
		name: 'staging',
		register: false,
		staging: true,
		ready: false,
		domain: 'bowerybugle.staging.zemn.me',
	},
	{
		name: 'staging-ready',
		register: true,
		staging: true,
		ready: true,
		domain: 'bowerybugle.staging.zemn.me',
	},
	{
		name: 'bootstrap',
		register: false,
		staging: false,
		ready: false,
		domain: 'bowerybugle.zemn.me',
	},
	{
		name: 'delegated',
		register: true,
		staging: false,
		ready: true,
		domain: 'bowerybugle.nyc',
	},
	{
		name: 'registering',
		register: true,
		staging: false,
		ready: false,
		domain: 'bowerybugle.zemn.me',
	},
]) {
	test(scenario.name, async () => {
		const callStart = calls.length;
		const resourceOptions = new Map<string, pulumi.ResourceOptions>();
		const component = new Component(
			scenario.name,
			{
				staging: scenario.staging,
				registration: scenario.register
					? {
							contactId: 12345,
							extendedAttributes: {
								'test-attribute': 'test-value',
							},
						}
					: undefined,
				customDomainReady: scenario.ready,
				bootstrapZoneId: 'existing-zone',
			},
			{
				transformations: [
					args => {
						resourceOptions.set(args.name, args.opts);
						return undefined;
					},
				],
			}
		);
		await pulumi.runtime.disconnect();
		const owned = resources.filter(r =>
			r.name.startsWith(`${scenario.name}_`)
		);
		expect(component.domain).toBe(scenario.domain);
		const registers = scenario.register && !scenario.staging;
		const registration = owned.filter(
			r => r.type === 'dnsimple:index/registeredDomain:RegisteredDomain'
		);
		const delegation = owned.filter(
			r => r.type === 'dnsimple:index/domainDelegation:DomainDelegation'
		);
		expect(registration).toHaveLength(registers ? 1 : 0);
		expect(delegation).toHaveLength(registers ? 1 : 0);
		expect(
			owned.filter(r => r.type === 'gcp:secretmanager/secret:Secret')
		).toHaveLength(scenario.staging ? 0 : 1);
		if (!scenario.staging) {
			expect(
				resourceOptions.get(`${scenario.name}_registrar_token`)
			).toMatchObject({
				import: 'projects/extreme-cycling-441523-a9/secrets/bowery-bugle-dnsimple-token',
				protect: true,
				retainOnDelete: true,
			});
		}
		expect(
			calls
				.slice(callStart)
				.filter(
					c =>
						c.token ===
						'gcp:secretmanager/getSecretVersion:getSecretVersion'
				)
		).toHaveLength(registers ? 1 : 0);
		if (registers) {
			expect(registration[0]?.inputs).toMatchObject({
				name: 'bowerybugle.nyc',
				contactId: 12345,
				autoRenewEnabled: true,
				transferLockEnabled: true,
				whoisPrivacyEnabled: false,
				trustee: false,
				extendedAttributes: { 'test-attribute': 'test-value' },
			});
			expect(registration[0]?.inputs.premiumPrice).toBeUndefined();
			for (const resource of [...registration, ...delegation]) {
				expect(resourceOptions.get(resource.name)).toMatchObject({
					protect: true,
					retainOnDelete: true,
				});
			}
			expect(delegation[0]?.inputs).toMatchObject({
				domain: 'bowerybugle.nyc',
				nameServers: ['ns.example.test'],
			});
			expect(delegation[0]?.provider).toBe(registration[0]?.provider);
			expect(
				owned.find(r => r.type === 'pulumi:providers:dnsimple')?.inputs
			).toMatchObject({ account: '178973', sandbox: 'false' });
		}

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
