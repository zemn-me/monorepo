// @ts-expect-error template will fill in
import { Args as ImageArgs, default as Image } from '__modulename';
import { FunctionArgs } from '@pulumi/aws/lambda';
import { Function as LambdaFunction } from '@pulumi/aws/lambda/function';
import { Repository } from '@pulumi/awsx/ecr';
import { ComponentResource, ComponentResourceOptions } from '@pulumi/pulumi';

export interface Args {
	image: ImageArgs;
	function: Omit<FunctionArgs, 'imageUri'>;
	repository?: Repository;
}

export default class __ClassName extends ComponentResource {
	/**
	 * The AWS ECS Image instance.
	 */
	image: Image;
	/**
	 * Repository the image is created in; could be passed as a parameter.
	 */
	repository: Repository;

	lambda: LambdaFunction;
	constructor(name: string, args: Args, opts?: ComponentResourceOptions) {
		super('__TYPE', name, args, opts);

		this.repository =
			args.repository ??
			new Repository(
				`${name}_repostory`,
				{
					forceDelete: true,
				},
				{ parent: this }
			);

		this.image = new Image(
			`${name}_image`,
			{
				repositoryUrl: this.repository.url,
				...args.image,
			},
			{ parent: this }
		);

		this.lambda = new LambdaFunction(
			`${name}_lambda_func`,
			{
				imageUri: this.image.imageUri,
				...args.function,
			},
			{ parent: this }
		);

		super.registerOutputs({ image: this.image });
	}
}
