import * as pulumi from '@pulumi/pulumi';

/**
 * A list of previous mappings we have made in resource names.
 *
 * I think URNs are most reasonable here. It seems like names don't actually totally uniquely identify stuff
 *
 * Who knew?
 */
export const aliases: Record<string, Array<string | pulumi.Alias> | undefined> =
	{
		// the below aliases happened because I introduced the 'CloudFront' abstraction
		'monorepo_pleaseintroducemetoyour.dog_pleaseintroducemetoyour_dog_website_cloudfront_certificate_validating_record':
			[
				'urn:pulumi:staging::monorepo-2::ts:pulumi:Component$ts:pulumi:pleaseintroducemetoyour.dog$ts:pulumi:lib:Website$ts:pulumi:lib:Certificate$aws:route53/record:Record::monorepo_pleaseintroducemetoyour.dog_pleaseintroducemetoyour_dog_website_certificate_validating_record',
			],
		'staging.zemn.me_cloudfront_certificate_validating_record': [
			'urn:pulumi:staging::monorepo-2::ts:pulumi:Component$ts:pulumi:shadwell.im$ts:pulumi:lib:Website$ts:pulumi:lib:Certificate$aws:route53/record:Record::staging.zemn.me_certificate_validating_record',
		],
		'monorepo_shadwell.im_thomas_shadwell_im_website_cloudfront_certificate_validating_record':
			[
				'urn:pulumi:staging::monorepo-2::ts:pulumi:Component$ts:pulumi:shadwell.im$ts:pulumi:lib:Website$ts:pulumi:lib:Certificate$aws:route53/record:Record::monorepo_shadwell.im_thomas_shadwell_im_website_certificate_validating_record',
			],
		'staging.zemn.me_cloudfront_cloudfront_distribution': [
			'urn:pulumi:prod::monorepo-2::ts:pulumi:Component$ts:pulumi:shadwell.im$ts:pulumi:lib:Website$aws:cloudfront/distribution:Distribution::staging.zemn.me_cloudfront_distribution',
		],
		'monorepo_shadwell.im_thomas_shadwell_im_website_cloudfront_cloudfront_distribution':
			[
				'urn:pulumi:prod::monorepo-2::ts:pulumi:Component$ts:pulumi:shadwell.im$ts:pulumi:lib:Website$aws:cloudfront/distribution:Distribution::monorepo_shadwell.im_thomas_shadwell_im_website_cloudfront_distribution',
			],
		'monorepo_pleaseintroducemetoyour.dog_pleaseintroducemetoyour_dog_website_cloudfront_distribution':
			[
				'urn:pulumi:prod::monorepo-2::ts:pulumi:Component$ts:pulumi:pleaseintroducemetoyour.dog$ts:pulumi:lib:Website$aws:cloudfront/distribution:Distribution::monorepo_pleaseintroducemetoyour.dog_pleaseintroducemetoyour_dog_website_cloudfront_distribution',
			],
	};
