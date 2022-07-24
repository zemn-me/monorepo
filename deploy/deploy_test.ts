import * as program from './program';

test('smoke', async () => {
	process.env.NPM_TOKEN = '123fake';
	await program.program.parseAsync(['xxx', 'ok', '--dryRun', 'true']);
});

test('releaseNotes', () => {
	expect(
		program.releaseNotes([
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
