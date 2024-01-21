import allowlist from '#//ts/knowitwhenyouseeit';

describe('Alg', () => {
	const getMessage = allowlist(
		'$2y$12$BcuZ0VfUeLLpoLxOC5Xv7eQQK0r95by8YJsECCldKP4ftPr20rpXW', //hello world
		'$2y$12$hxyWxMx.qap70Snn1QKMwuDp/9XgNM7HpwbrGnsPu/j7dyTEWh0M2' //hewwo world
	);

	it('should whitelist correctly', () => {
		expect(getMessage('hello world')).toBe('hello world');
		expect(getMessage('hewwo world')).toBe('hewwo world');
		expect(getMessage('henlo world')).toBe(false);
	});
});
