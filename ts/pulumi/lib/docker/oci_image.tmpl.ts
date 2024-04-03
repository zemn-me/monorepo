import { Image, ImageArgs } from '@pulumi/awsx/ecr';
import { ComponentResource, ComponentResourceOptions } from '@pulumi/pulumi';

export interface Args {
	image: Omit<ImageArgs, 'dockerfile'>;
}

export default class __ClassName extends ComponentResource {
	image: Image;
	constructor(name: string, args: Args, opts?: ComponentResourceOptions) {
		super('__TYPE', name, args, opts);

		this.image = new Image(
			`${name}_image`,
			{
				dockerfile: '__DOCKERFILE_PATH',
				...args.image,
			},
			{ parent: this }
		);

		super.registerOutputs({ image: this.image });
	}
}
