import * as aws from "@pulumi/aws";
import { ComponentResource, ComponentResourceOptions } from "@pulumi/pulumi";

import { mergeTags, TagSet, tagTrue } from "#root/ts/pulumi/lib/tags.js";
import { HelloWorldImage } from "#root/ts/pulumi/zemn.me/hello_world/HelloWorldImage.js";

export interface Args {
    tags?: TagSet;
}

function clampLambdaFunctionName(name: string): string {
  // Define constraints
  const maxLength = 64;
  const allowedCharactersRegex = /^[a-zA-Z0-9._-]+$/;

  // Trim the string to the maximum allowed length
  let clampedName = name.slice(0, maxLength);

  // Remove invalid characters
  clampedName = clampedName
    .split('')
    .filter(char => allowedCharactersRegex.test(char))
    .join('');

  // Ensure the name is at least one character long
  if (clampedName.length === 0) {
    throw new Error("Lambda function name must contain at least one valid character.");
  }

  return clampedName;
}


export class LambdaHelloWorld extends ComponentResource {
    constructor(
        name: string,
        args: Args,
        opts?: ComponentResourceOptions
    ) {
        super("ts:pulumi:Component", name, args, opts);

        const tag = name;
        const tags = mergeTags(args.tags, tagTrue(tag));

        // Create the ECR repository to store our container image
        const repo = new aws.ecr.Repository("repo", {
            forceDelete: true,
            tags: tags,
        });

		const auth = aws.ecr.getAuthorizationToken();



        // Build and push the container image
        const img = new HelloWorldImage(`${name}_img`, {
            repository: repo.repositoryUrl,
			token: auth.then(auth => auth.authorizationToken)
        });

        // Create the Lambda function using the container image
        const lambda = new aws.lambda.Function(`${name}_lambda`, {
			name: clampLambdaFunctionName(`${name}_lambda`),
            packageType: "Image",
			// e.g. --
			// https://658613637108.dkr.ecr.us-east-1.amazonaws.com/repo-fe6824f@sha256:c61c4b619733eb59d7c68a34d7b56e562894c9d777f26e982bc453bbcf57ab5b
            imageUri: img.url,
            role: new aws.iam.Role("lambdaRole", {
                assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
                    Service: "lambda.amazonaws.com",
                }),
            }).arn,
            timeout: 30,
            memorySize: 512,
            tags: tags,
        });

        // Add permissions for Lambda to log to CloudWatch
        new aws.iam.RolePolicyAttachment(`${name}_lambda_logging`, {
            role: lambda.role!,
            policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
        });

        // Export the Lambda function name
        this.registerOutputs({
            lambdaFunctionName: lambda.name,
        });
    }
}
