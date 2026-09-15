import { readFile } from 'node:fs/promises';

import { expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';

import { MinecraftServerImage } from '#root/project/me/zemn/minecraft/MinecraftServerImage.js';
import { MinecraftOnDemand } from '#root/ts/pulumi/zemn.me/minecraft/minecraft.js';

const resources: pulumi.runtime.MockResourceArgs[] = [];

void pulumi.runtime.setMocks({
	newResource: args => {
		resources.push(args);
		const state = {
			...args.inputs,
			name: args.name,
			arn: `arn:aws:test:${args.name}`,
		};
		if (args.type === 'aws:ecr/repository:Repository') {
			state['repositoryUrl'] = 'registry.example.test/minecraft';
		}
		if (args.type === 'command:local:Command') {
			const command = args.inputs['interpreter'] as string[];
			state['stdout'] = `${command.at(-2)}@${command.at(-1)}`;
		}
		return { id: args.name, state };
	},
	call: args => args.inputs,
});

test('ECS deploys the Bazel image digest without overriding its Minecraft version', async () => {
	new MinecraftOnDemand('test_minecraft', {
		domain: 'example.test',
		environmentName: 'staging',
		zoneId: 'test-zone',
	});
	await pulumi.runtime.disconnect();
	const digest = (
		await readFile(MinecraftServerImage.digestPath, 'utf8')
	).trim();
	expect(digest).toMatch(/^sha256:[a-f0-9]{64}$/);
	const task = resources.find(
		resource => resource.type === 'aws:ecs/taskDefinition:TaskDefinition'
	);
	expect(task).toBeDefined();
	const containers = JSON.parse(
		task!.inputs['containerDefinitions'] as string
	) as {
		image: string;
		environment: { name: string; value: string }[];
	}[];
	expect(containers).toHaveLength(1);
	expect(containers[0]!.image).toBe(
		`registry.example.test/minecraft@${digest}`
	);
	expect(
		containers[0]!.environment.some(variable => variable.name === 'VERSION')
	).toBe(false);
});
