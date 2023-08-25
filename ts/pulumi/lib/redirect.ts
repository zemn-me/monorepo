import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import CloudFront from 'ts/pulumi/lib/cloudfront';

export interface Args {
	/**
	 * Zone to create any needed DNS records in.
	 */
	zoneId: pulumi.Input<string>;

	to: string;

	/**
	 * The domain or subdomain itself in which to create the redirector.
	 *
	 * Leave undefined to host at the root of the domain
	 *
	 * @example
	 * "mywebsite.com."
	 */
	domain: string;

	/**
	 * Prevent search engines from indexing.
	 */
	noIndex: boolean;
}

/**
 * 200 redirects a whole domain somewhere.
 */
export class Redirect extends pulumi.ComponentResource {
	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lib:Redirect', name, args, opts);

		const redirector = new aws.cloudfront.Function(
			//  creating CloudFront Function (monorepo_zemn.me_availability.zemn.me_function_redirector-b62460d):
			// MalformedXML: 2 validation errors detected: Value 'monorepo_zemn.me_availability.zemn.me_function_redirector-b62460d'
			//at 'name' failed to satisfy constraint: Member must satisfy regular expression pattern: ^[a-zA-Z0-9-_]{1,64}$;
			// Value 'monorepo_zemn.me_availability.zemn.me_function_redirector-b62460d' at 'name' failed to satisfy constraint:
			// Member must have length less than or equal to 64
			`${name}_function_redirector`
				.replace(/[^a-zA-Z0-9-_]/g, '_')
				.slice(0, 64),
			{
				runtime: 'cloudfront-js-1.0',
				code: function handler() {
					return {
						statusCode: 302,
						statusDescription: 'Found',
						headers: {
							location: { value: args.to },
						},
					};
				}.toString(),
			},
			{ parent: this }
		);

		const c = new CloudFront(
			`${name}_cloudfront`,
			{
				zoneId: args.zoneId,
				domain: args.domain,
				noIndex: args.noIndex,
				distributionArgs: {
					origins: [
						{
							domainName: 'example.com', // everything redirects anyway, so this is basically ignored
							originId: `${name}_default_origin`,
						},
					],
					defaultCacheBehavior: {
						targetOriginId: `${name}_default_origin`,
						functionAssociations: [
							{
								eventType: 'viewer-request',
								functionArn: redirector.arn,
							},
						],
					},
				},
			},
			{ parent: this }
		);

		this.registerOutputs({ c });
	}
}

export default Redirect;
