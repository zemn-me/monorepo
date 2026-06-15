const awsAlphaNumericHyphenUnderscoreNamePattern = /^[A-Za-z0-9_-]+$/;
const awsTargetGroupNameMaxLength = 32;
const awsTargetGroupNamePattern = /^[A-Za-z0-9-]+$/;

export function isAwsAlphaNumericHyphenUnderscoreName(name: string): boolean {
	return awsAlphaNumericHyphenUnderscoreNamePattern.test(name);
}

export function sanitizeAwsAlphaNumericHyphenUnderscoreName(name: string): string {
	const sanitized = name.replaceAll(/[^A-Za-z0-9_-]/g, '_');
	return sanitized.length === 0 ? 'resource' : sanitized;
}

export function isAwsTargetGroupName(name: string): boolean {
	return (
		name.length <= awsTargetGroupNameMaxLength &&
		awsTargetGroupNamePattern.test(name) &&
		!name.startsWith('-') &&
		!name.endsWith('-')
	);
}

export function sanitizeAwsTargetGroupName(name: string): string {
	const sanitized = name
		.replaceAll(/[^A-Za-z0-9-]/g, '-')
		.slice(0, awsTargetGroupNameMaxLength)
		.replaceAll(/^-+|-+$/g, '');
	return sanitized.length === 0 ? 'resource' : sanitized;
}
