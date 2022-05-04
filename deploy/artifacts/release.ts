/**
 * @fileoverview Takes a list of release artifacts as arguments,
 * and uploads them to github's release API.
 */

import fs from 'fs/promises';
import { context, getOctokit } from '@actions/github';

const Github = getOctokit(process.env['GITHUB_TOKEN']!);

async function main() {
	const release = Github.rest.repos.createRelease({
		// could probably use a spread operator here
		// but i also think that would be uglier...
		owner: context.repo.owner,
		repo: context.repo.repo,

		tag_name: context.ref,

		// TBD: maybe a desc?
		// body:

		generate_release_notes: true,

		name: context.sha,

		target_commitish: context.ref,
	});

	const mappings = process.argv.slice(2).map(v => v.split('='));

	const ab = await Promise.all(
		mappings.map(async ([name, file]) =>
			Github.rest.repos.uploadReleaseAsset({
				owner: context.repo.owner,
				repo: context.repo.repo,
				release_id: (await release).data.id,
				name,
				data: (await fs.readFile(file)).toString(),
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
}

main().catch(e => console.error(e));
