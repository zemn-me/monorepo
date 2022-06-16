/**
 * @fileoverview Takes a list of release artifacts as arguments,
 * and uploads them to github's release API.
 */

import fs from 'fs/promises';
import child_process from 'child_process';
import { context, getOctokit } from '@actions/github';
import { Command } from 'commander';
import path from 'path';
const program = new Command();

const Github = getOctokit(process.env['GITHUB_TOKEN']!);

program
	.name('release')
	.description(
		'performs the action of creating a github release, and associated actions'
	)
	.argument('<files...>', 'Files to publish.')
	.requiredOption('--body <file>', 'Release notes etc.')
	.action(async (files, { body }) => {
		console.info('Publishing NPM packages...');

		const to_publish = [['svgshot', 'ts/cmd/svgshot/npm_pkg.publish.sh']];

		const published: string[] = [];
		try {
			if (!('NPM_TOKEN' in process.env))
				throw new Error(
					"Missing NPM_TOKEN. We won't be able to publish any npm packages."
				);
			for (const [name, target] of to_publish) {
				child_process.execFileSync(target, {
					stdio: 'pipe',
				});

				published.push(name);
			}
		} catch (e) {
			console.error(e);
		}

		const syntheticVersion = `v0.0.0-${new Date().getTime()}-${
			context.sha
		}`;
		const release = Github.rest.repos.createRelease({
			// could probably use a spread operator here
			// but i also think that would be uglier...
			owner: context.repo.owner,
			repo: context.repo.repo,

			tag_name: syntheticVersion,

			body:
				(await fs.readFile(body)).toString() +
				'\n' +
				`This release also includes the following published NPM packages:\n${published
					.map(name => `   - ${name}`)
					.join('\n')}`,

			generate_release_notes: true,

			name: syntheticVersion,

			target_commitish: context.ref,
		});

		const ab = await Promise.all(
			files.map(
				async (file: string) =>
					await Github.rest.repos.uploadReleaseAsset({
						owner: context.repo.owner,
						repo: context.repo.repo,
						release_id: (await release).data.id,
						name: path.basename(file),
						// https://github.com/octokit/octokit.js/discussions/2087#discussioncomment-646569
						data: (await fs.readFile(file)) as unknown as string,
					})
			)
		);

		for (const upload of ab) {
			console.log(
				'Uploaded release asset',
				upload.data.name,
				'as',
				upload.data.browser_download_url
			);
		}
	});

async function main() {
	await program.parseAsync(process.argv);
}

main().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
