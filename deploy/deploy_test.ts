import program, { release, releaseNotes } from './program';

it('should not break when run in dryRun mode', async () => {
	process.env.NPM_TOKEN = '123fake';
	process.env.AWS_SECRET_ACCESS_KEY = '123fake';
	process.env.PULUMI_ACCESS_TOKEN = '123fake';
	process.env.AWS_ACCESS_KEY_ID = '123fake';
	let output = '';
	await expect(
		program()
			.configureOutput({
				writeOut: s => (output += s),
			})
			.parseAsync(['xxx', 'ok', '--dryRun', 'true'])
	).resolves.not.toThrow();
});

it('should break when not in dryRun mode', async () => {
	process.env.NPM_TOKEN = '123fake';
	process.env.AWS_SECRET_ACCESS_KEY = '123fake';
	process.env.PULUMI_ACCESS_TOKEN = '123fake';
	process.env.AWS_ACCESS_KEY_ID = '123fake';
	await expect(program().parseAsync(['xxx', 'ok'])).rejects.toThrow();
});

it('should not have any errors', async () => {
	process.env.NPM_TOKEN = '123fake';
	process.env.AWS_SECRET_ACCESS_KEY = '123fake';
	process.env.PULUMI_ACCESS_TOKEN = '123fake';
	process.env.AWS_ACCESS_KEY_ID = '123fake';
	let output = '';
	await expect(
		program({
			onError: s => {
				throw new Error(s);
			},
		})
			.configureOutput({
				writeOut: s => (output += s),
			})
			.parseAsync(['xxx', 'ok', '--dryRun', 'true'])
	).resolves.not.toThrow();
});

test('releaseNotes', async () => {
	process.env.NPM_TOKEN = '123fake';
	process.env.AWS_SECRET_ACCESS_KEY = '123fake';
	process.env.PULUMI_ACCESS_TOKEN = '123fake';
	process.env.AWS_ACCESS_KEY_ID = '123fake';
	let ok: (v: string) => void;
	const output = new Promise(o => (ok = o));

	await expect(
		program({ outputReleaseNotes: ok! })
			.configureOutput({
				writeOut: s => console.error(s),
			})
			.parseAsync(['xxx', 'ok', '--dryRun', 'true'])
	).resolves.not.toThrow();

	expect(output).resolves.not.toBeFalsy();
});

describe('release', () => {
	it('should allow an operation to fail gracefully', async () => {
		let failureContent = '';
		const logFailure = (s: string) => (failureContent += s);

		let success = false;
		await expect(
			release(
				async () => ({
					kind: 'artifact',
					buildTag: 'fake',
					filename: 'fake',
					publish: async () => {
						throw new Error('failure 2');
					},
				}),

				async () => ({
					kind: 'npm_publication',
					buildTag: 'fake',
					package_name: 'fake',
					filename: 'fake',
					publish: async () => {
						throw new Error('failure');
					},
				}),

				async () => ({
					kind: 'artifact',
					buildTag: 'fake',
					filename: 'fake',
					publish: async () => {
						success = true;
					},
				})
			)({
				dryRun: false,
				async createRelease() {
					return { release_id: 1 };
				},
				releaseNotes: releaseNotes(logFailure),
				async uploadReleaseAsset() {
					return undefined;
				},
			})
		).resolves.toEqual(`Artifacts exported in this release:
- fake ⟶ fake

The following operations were requested:
- ❌ Upload fake as release artifact fake
- ❌ Upload fake to NPM
- ✔️ Upload fake as release artifact fake`);

		expect(
			success
				? "One operation was able to continue despite the other's failure."
				: 'An operation failed, and it caused cancellation of all other ops.'
		).toEqual(
			"One operation was able to continue despite the other's failure."
		);

		expect(failureContent).toContain('Error: failure');
		expect(failureContent).toContain('Error: failure 2');
		expect(failureContent).not.toContain('undefined');
	});
});
