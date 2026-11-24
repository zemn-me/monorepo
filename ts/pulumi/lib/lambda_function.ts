import * as aws from '@pulumi/aws';
import {
	ComponentResource,
	ComponentResourceOptions,
	type Output,
} from '@pulumi/pulumi';

function clampLambdaFunctionName(name: string): string {
	// Define constraints
	const maxLength = 64;
	const allowedCharactersRegex = /^[a-zA-Z0-9_-]+$/;

	// Trim the string to the maximum allowed length
	let clampedName = name.slice(0, maxLength);

	// Remove invalid characters
	clampedName = clampedName
		.split('')
		.filter(char => allowedCharactersRegex.test(char))
		.join('');

	// Ensure the name is at least one character long
	if (clampedName.length === 0) {
		throw new Error(
			'Lambda function name must contain at least one valid character.'
		);
	}

	return clampedName;
}

/**
 * Wrapper for {@link aws.lambda.Function}, providing fixes for a few
 * weirdnesses of the existing API.
 */
export class LambdaFunction extends ComponentResource {
	function: aws.lambda.Function;
	constructor(
		name: string,
		args: aws.lambda.FunctionArgs,
		opts?: ComponentResourceOptions
	) {
		super('ts:pulumi:lib:lambdafunciton', name, args, opts);

		this.function = new aws.lambda.Function(
			clampLambdaFunctionName(name),
			args,
			{ ...opts, parent: this }
		);
	}
}

/** A Lambda deployed from the image containing this Bazel executable. */
export class BinaryImageFunction extends LambdaFunction {
	constructor(
		name: string,
		readonly image: {
			url: Output<string>;
			runtime: { binary: string; tools: string[] };
		},
		args: Omit<
			aws.lambda.FunctionArgs,
			'packageType' | 'imageUri' | 'code' | 'imageConfig'
		>,
		opts?: ComponentResourceOptions
	) {
		super(
			name,
			{ ...args, packageType: 'Image', imageUri: image.url },
			opts
		);
	}
}
