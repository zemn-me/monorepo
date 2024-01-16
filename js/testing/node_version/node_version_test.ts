test('node version must be at least 18', () => {
	const match = /^v(\d+)/.exec(process.version);
	expect(match).not.toBe(null);
	//eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const m = match!;
	expect(+m[1]!).toBeGreaterThanOrEqual(18);
});
