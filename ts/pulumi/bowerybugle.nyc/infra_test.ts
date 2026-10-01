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
				zoneId: `${args.name}-zone`,
				nameServers: ['ns.example.test'],
			},
		};
	},
	call: args => args.inputs,
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
		expect(owned.some(r => r.type.startsWith('aws:ses/'))).toBe(false);
	});
}
