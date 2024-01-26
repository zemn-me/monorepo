import * as aws from '@pulumi/aws';
import { CostAllocationTag } from '@pulumi/aws/costexplorer/index.js';
import * as pulumi from '@pulumi/pulumi';

import { mergeTags, tagTrue } from '#root/ts/pulumi/lib/tags.js';

const second = 1;
const minute = 60 * second;

export interface Args {
	/**
	 * Zone to create any needed DNS records in.
	 */
	zoneId: pulumi.Input<string>;

	/**
	 * The domain or subdomain itself within the zone to create the website.
	 *
	 * @example
	 * "mywebsite.com."
	 */
	domain: pulumi.Input<string> | undefined;

	tags?: pulumi.Input<Record<string, pulumi.Input<string>>>;
}

/**
 * Provisions an SSL certificate for the given domain in the given zone.
 */
export class Certificate extends pulumi.ComponentResource {
	validation: aws.acm.CertificateValidation;
	constructor(
		name: string,
		args: Args,
		opts?: pulumi.ComponentResourceOptions
	) {
		super('ts:pulumi:lib:Certificate', name, args, opts);

		const tag = name;
		const tags = mergeTags(args.tags, tagTrue(tag));

		new CostAllocationTag(
			name,
			{
				status: 'Active',
				tagKey: tag,
			},
			{ parent: this }
		);

		const cert = new aws.acm.Certificate(
			`${name}_cert`,
			{
				domainName: args.domain,
				validationMethod: 'DNS',
				tags,
			},
			{
				parent: this,
			}
		);

		const validatingRecord = new aws.route53.Record(
			`${name}_validating_record`,
			{
				name: cert.domainValidationOptions[0]!.resourceRecordName,
				records: [cert.domainValidationOptions[0]!.resourceRecordValue],
				type: cert.domainValidationOptions[0]!.resourceRecordType,
				zoneId: args.zoneId,
				ttl: 1 * minute, // because these really don't need to be cached
			},
			{
				// records must be unique
				parent: this,
				deleteBeforeReplace: true,
			}
		);

		this.validation = new aws.acm.CertificateValidation(
			`${name}_validation`,
			{
				certificateArn: cert.arn,
				validationRecordFqdns: [validatingRecord.fqdn],
			},
			{
				parent: this,
			}
		);

		super.registerOutputs({
			validation: this.validation,
		});
	}
}

export default Certificate;
