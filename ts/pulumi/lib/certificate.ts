import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { aliases } from 'ts/pulumi/aliases';

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
	domain: string | undefined;
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

		const cert = new aws.acm.Certificate(
			`${name}_cert`,
			{
				domainName: args.domain,
				validationMethod: 'DNS',
			},
			{
				parent: this,
			}
		);

		const validatingRecordName = `${name}_validating_record`;

		const validatingRecord = new aws.route53.Record(
			validatingRecordName,
			{
				name: cert.domainValidationOptions[0].resourceRecordName,
				records: [cert.domainValidationOptions[0].resourceRecordValue],
				type: cert.domainValidationOptions[0].resourceRecordType,
				zoneId: args.zoneId,
				ttl: 1 * minute, // because these really don't need to be cached
			},
			{
				// records must be unique
				parent: this,
				deleteBeforeReplace: true,
				aliases: aliases[validatingRecordName],
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
