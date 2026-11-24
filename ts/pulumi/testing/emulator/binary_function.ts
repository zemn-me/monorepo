import assert from 'node:assert/strict';

import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import type { BinaryImageFunction } from '#root/ts/pulumi/lib/lambda_function.js';

// Project only public resource bindings before removing Pulumi's secret bit.
export function publicEnvironment(fn: aws.lambda.Function, names: string[]) {
	return pulumi.unsecret(
		fn.environment.apply(env =>
			Object.fromEntries(
				names.map(name => {
					const value = env?.variables?.[name];
					assert(
						value,
						`Missing Lambda environment variable ${name}`
					);
					return [name, value];
				})
			)
		)
	);
}

// The emulator provisions image Lambdas and routes their events, but cannot
// execute native entrypoints. Forward its asynchronous invocation record.
export function asyncBinaryFunction(
	name: string,
	target: BinaryImageFunction,
	role: aws.iam.Role,
	environmentNames: string[]
) {
	const queue = new aws.sqs.Queue(name);
	const grant = new aws.iam.RolePolicy(`${name}-delivery`, {
		role: role.name,
		policy: pulumi.jsonStringify({
			Version: '2012-10-17',
			Statement: [
				{
					Effect: 'Allow',
					Action: 'sqs:SendMessage',
					Resource: queue.arn,
				},
			],
		}),
	});
	new aws.lambda.FunctionEventInvokeConfig(
		name,
		{
			functionName: target.function.name,
			maximumRetryAttempts: 0,
			destinationConfig: { onFailure: { destination: queue.arn } },
		},
		{ dependsOn: grant }
	);
	return {
		binary: target.image.binary,
		arn: target.function.arn,
		name: target.function.name,
		memorySize: target.function.memorySize,
		timeout: target.function.timeout,
		environment: publicEnvironment(target.function, environmentNames),
		queueURL: queue.url,
	};
}
