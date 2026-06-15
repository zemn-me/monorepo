const awsAlphaNumericHyphenUnderscoreNamePattern = /^[A-Za-z0-9_-]+$/;
const awsEcsTaskFamilyNameMaxLength = 255;
const awsElbv2NameMaxLength = 32;
const awsElbv2NamePattern = /^[A-Za-z0-9-]+$/;
const awsLambdaFunctionNameMaxLength = 64;
const awsLambdaStatementIdMaxLength = 100;

export function isAwsAlphaNumericHyphenUnderscoreName(name: string): boolean {
	return awsAlphaNumericHyphenUnderscoreNamePattern.test(name);
}

export function sanitizeAwsAlphaNumericHyphenUnderscoreName(name: string): string {
	const sanitized = name.replaceAll(/[^A-Za-z0-9_-]/g, '_');
	return sanitized.length === 0 ? 'resource' : sanitized;
}

export function isAwsEcsTaskFamilyName(name: string): boolean {
	return (
		name.length <= awsEcsTaskFamilyNameMaxLength &&
		isAwsAlphaNumericHyphenUnderscoreName(name)
	);
}

export function sanitizeAwsEcsTaskFamilyName(name: string): string {
	return sanitizeAwsAlphaNumericHyphenUnderscoreName(name).slice(
		0,
		awsEcsTaskFamilyNameMaxLength
	);
}

export function isAwsLambdaFunctionName(name: string): boolean {
	return (
		name.length <= awsLambdaFunctionNameMaxLength &&
		isAwsAlphaNumericHyphenUnderscoreName(name)
	);
}

export function sanitizeAwsLambdaFunctionName(name: string): string {
	return sanitizeAwsAlphaNumericHyphenUnderscoreName(name).slice(
		0,
		awsLambdaFunctionNameMaxLength
	);
}

export function isAwsLambdaStatementId(name: string): boolean {
	return (
		name.length <= awsLambdaStatementIdMaxLength &&
		isAwsAlphaNumericHyphenUnderscoreName(name)
	);
}

export function sanitizeAwsLambdaStatementId(name: string): string {
	return sanitizeAwsAlphaNumericHyphenUnderscoreName(name).slice(
		0,
		awsLambdaStatementIdMaxLength
	);
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
