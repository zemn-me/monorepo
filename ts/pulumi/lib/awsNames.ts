const awsAlphaNumericHyphenUnderscoreNamePattern = /^[A-Za-z0-9_-]+$/;
const awsElbv2NameMaxLength = 32;
const awsElbv2NamePattern = /^[A-Za-z0-9-]+$/;

export function isAwsAlphaNumericHyphenUnderscoreName(name: string): boolean {
	return awsAlphaNumericHyphenUnderscoreNamePattern.test(name);
}

export function sanitizeAwsAlphaNumericHyphenUnderscoreName(name: string): string {
	const sanitized = name.replaceAll(/[^A-Za-z0-9_-]/g, '_');
	return sanitized.length === 0 ? 'resource' : sanitized;
}

export function isAwsTargetGroupName(name: string): boolean {
	return isAwsElbv2Name(name);
}

export function sanitizeAwsTargetGroupName(name: string): string {
	return sanitizeAwsElbv2Name(name);
}

export function isAwsElbv2Name(name: string): boolean {
	return (
		name.length <= awsElbv2NameMaxLength &&
		awsElbv2NamePattern.test(name) &&
		!name.startsWith('-') &&
		!name.endsWith('-')
	);
}

export function sanitizeAwsElbv2Name(name: string): string {
	const sanitized = name
		.replaceAll(/[^A-Za-z0-9-]/g, '-')
		.slice(0, awsElbv2NameMaxLength)
		.replaceAll(/^-+|-+$/g, '');
	return sanitized.length === 0 ? 'resource' : sanitized;
}
