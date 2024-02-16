const bucketSuffix = '-bucket';
const pulumiRandomChars = 7;
const bucketNameMaximumLength = 56 - pulumiRandomChars - bucketSuffix.length;

// bucket has a maximum length of 63 (56 minus the 7 random chars that Pulumi adds)
export const deriveBucketName = (base: string) =>
	[...base.replace(/[^a-z0-9.]/g, '-')]
		.slice(0, bucketNameMaximumLength - 1)
		.join('') + bucketSuffix;
