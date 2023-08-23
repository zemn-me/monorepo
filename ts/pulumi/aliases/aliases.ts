/**
 * A list of previous mappings we have made in resource names.
 */
export const aliases: Record<string, Array<{ name: string }> | undefined> = {
	// the below aliases happened because I introduced the 'CloudFront' abstraction
	'monorepo_pleaseintroducemetoyour.dog_pleaseintroducemetoyour_dog_website_cloudfront_certificate_validating_record':
		[
			{
				name: 'monorepo_pleaseintroducemetoyour.dog_pleaseintroducemetoyour_dog_website_certificate_validating_record',
			},
		],
	'staging.zemn.me_cloudfront_certificate_validating_record': [
		{ name: 'staging.zemn.me_certificate_validating_record' },
	],
	'monorepo_shadwell.im_thomas_shadwell_im_website_cloudfront_certificate_validating_record':
		[
			{
				name: 'monorepo_shadwell.im_thomas_shadwell_im_website_certificate_validating_record',
			},
		],
};
