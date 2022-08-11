import program, { releaseNotes } from './program';
import { release } from 'monorepo/deploy/releaser';

it('should not break when run in dryRun mode', async () => {
	process.env.NPM_TOKEN = '123fake';
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
	await expect(program().parseAsync(['xxx', 'ok'])).rejects.toThrow();
});

test('releaseNotes', async () => {
	process.env.NPM_TOKEN = '123fake';
	let ok: (v: string) => void;
	const output = new Promise(o => (ok = o));

	await expect(
		program(ok!)
			.configureOutput({
				writeOut: s => console.error(s),
			})
			.parseAsync(['xxx', 'ok', '--dryRun', 'true'])
	).resolves.not.toThrow();

	expect(output).resolves.toEqual(`Artifacts exported in this release:
- //project/ck3/recursive-vassals/mod_zip.zip ⟶ recursive_vassals.zip
- //project/ck3/recursive-vassals/mod.patch ⟶ recursive_vassals.patch
- //ts/cmd/svgshot/svgshot.tgz ⟶ svgshot.tar.gz

NPM packages included in this release:
- //ts/cmd/svgshot/npm_pkg.publish.sh ⟶ [svgshot](https://npmjs.com/package/svgshot)

The following operations were requested:
- ✔️ Upload //project/ck3/recursive-vassals/mod_zip.zip as release artifact recursive_vassals.zip
- ✔️ Upload //project/ck3/recursive-vassals/mod.patch as release artifact recursive_vassals.patch
- ✔️ Upload //ts/cmd/svgshot/svgshot.tgz as release artifact svgshot.tar.gz
- ✔️ Upload //ts/cmd/svgshot/npm_pkg.publish.sh to NPM`);
});

describe('release', () => {
	it('should allow an operation to fail gracefully', async () => {
		let success = false;
		await expect(
			release(
				async () => ({
					kind: 'artifact',
					buildTag: 'fake',
					filename: 'fake',
					publish: async () => {
						throw new Error('failure');
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
				releaseNotes,
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
	});
});
