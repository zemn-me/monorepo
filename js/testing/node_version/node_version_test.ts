

test('node version must be at least 18', () => {
    const match = /^v(\d+)/.exec(process.version);
    expect(+match?.[1]!).toBeGreaterThanOrEqual(18);
})