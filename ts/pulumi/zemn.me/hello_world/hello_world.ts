import * as aws from '@pulumi/aws';
import { ComponentResource, ComponentResourceOptions } from '@pulumi/pulumi';

import { BinaryImageFunction } from '#root/ts/pulumi/lib/lambda_function.js';
import { mergeTags, TagSet, tagTrue } from '#root/ts/pulumi/lib/tags.js';
import { HelloWorldImage } from '#root/ts/pulumi/zemn.me/hello_world/HelloWorldImage.js';

export interface Args {
	tags?: TagSet;
}

export class LambdaHelloWorld extends ComponentResource {
	constructor(name: string, args: Args, opts?: ComponentResourceOptions) {
		super('ts:pulumi:Component', name, args, opts);

		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		// Create the ECR repository to store our container image
		const repo = new aws.ecr.Repository(`${name}_repo`, {
			forceDelete: true,
			tags: tags,
		});

		const auth = aws.ecr.getAuthorizationToken();

		// Build and push the container image
		const img = new HelloWorldImage(`${name}_img`, {
			repository: repo.repositoryUrl,
			token: auth.then(auth => auth.authorizationToken),
		});

		const role = new aws.iam.Role(`${name}_role`, {
			assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
				Service: 'lambda.amazonaws.com',
			}),
		});
		const lambda = new BinaryImageFunction(`${name}_lambda`, img, {
			role: role.arn,
			timeout: 30,
			memorySize: 512,
			tags: tags,
		});

		// Add permissions for Lambda to log to CloudWatch
		new aws.iam.RolePolicyAttachment(`${name}_lambda_logging`, {
			role: role.name,
			policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
		});

		// Export the Lambda function name
		this.registerOutputs({
			lambdaFunctionName: lambda.function.name,
		});
	}
}
