import program, { releaseNotes } from './program';

it('should not break when run in dryRun mode', async () => {
	process.env.NPM_TOKEN = '123fake';
	await expect(
		program().parseAsync(['xxx', 'ok', '--dryRun', 'true'])
	).resolves.not.toThrow();
});

it('should break when not in dryRun mode', async () => {
	process.env.NPM_TOKEN = '123fake';
	await expect(program().parseAsync(['xxx', 'ok'])).rejects.toThrow();
});

test('releaseNotes', () => {
	expect(
		releaseNotes([
			{
				kind: 'npm_publication',
				buildTag: 'xxx',
				package_name: 'something',
				publish: async () => void 0,
			},
			{
				kind: 'artifact',
				filename: 'egg',
				buildTag: 'whatever',
				publish: async () => void 0,
			},
		])
	).toEqual(`This release contains the following artifacts:
  - whatever → egg
This release contains the following NPM packages:
  - xxx → [something](https://npmjs.com/package/svgshot)
`);
});
