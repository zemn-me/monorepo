const awsAlphaNumericHyphenUnderscoreNamePattern = /^[A-Za-z0-9_-]+$/;

export function isAwsAlphaNumericHyphenUnderscoreName(name: string): boolean {
	return awsAlphaNumericHyphenUnderscoreNamePattern.test(name);
}

export function sanitizeAwsAlphaNumericHyphenUnderscoreName(name: string): string {
	const sanitized = name.replaceAll(/[^A-Za-z0-9_-]/g, '_');
	return sanitized.length === 0 ? 'resource' : sanitized;
}
