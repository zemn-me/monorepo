import * as pulumi from "@pulumi/pulumi";
import * as archive from "@pulumi/archive";
import * as aws from "@pulumi/aws";
import { Function } from "@pulumi/aws/lambda";
import { Repository, Image } from '@pulumi/awsx/ecr';
import { RegistryImage } from '@pulumi/docker';


export interface Args {
	repository?: Repository
	image?: string
}

export class LambdaBase extends pulumi.ComponentResource {
	function: Function
	repository: Repository
	image: Image
	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('bin:lambda:LambdaBase', name, args, opts);

		this.repository = args.repository ?? new Repository(
			`${name}_repository`,
			{
				forceDelete: true
			}
		);

		image = new RegistryImage(`${name}_image`, {
			build
		})

		this.image = args.image ?? new Image(
			`${name}`,
			{
				repositoryUrl: this.repository.url,
			}
		)





		this.function = new Function(
			`${name}_function`,
			{
				code:
			}
	}

}
