/**
 * @fileoverview Performs a release.
 */

import fs from 'fs/promises';
import child_process from 'child_process';
import { promisify } from 'util';
import { context, getOctokit } from '@actions/github';
import { Command } from 'commander';
import { runfiles } from '@bazel/runfiles';

const Program = new Command();

interface Context {
	publish(filename: string, content: Buffer): Promise<void>;
	exec(filename: string): Promise<void>;
}

interface ArtifactInfo {
	kind: 'artifact';
	filename: string;
	buildTag: string;
	publish: (c: Context) => Promise<void>;
}

const artifact =
	(filename: string, buildTag: string) => async (): Promise<ArtifactInfo> => {
		return {
			kind: 'artifact',
			filename,
			buildTag,
			publish: async ({ publish }: Context) =>
				publish(
					filename,
					await fs.readFile(
						runfiles.resolveWorkspaceRelative(buildTag)
					)
				),
		};
	};

interface NpmPackageInfo {
	kind: 'npm_publication';
	package_name: string;
	buildTag: string;
	publish: (c: Context) => Promise<void>;
}

const npmPackage =
	(packageName: string, buildTag: string) =>
	async (): Promise<NpmPackageInfo> => {
		return {
			buildTag,
			kind: 'npm_publication',
			package_name: packageName,
			async publish({ exec }: Context) {
				if (!('NPM_TOKEN' in process.env))
					throw new Error(
						"Missing NPM_TOKEN. We won't be able to publish any NPM packages."
					);
				exec(runfiles.resolveWorkspaceRelative(buildTag));
			},
		};
	};

interface ReleaseProps {
	dryRun: boolean;
	releaseNotes: (items: (ArtifactInfo | NpmPackageInfo)[]) => string;
	createRelease(data: { body: string }): Promise<{ release_id: number }>;
	uploadReleaseAsset(data: {
		release_id: number;
		name: string;
		data: Buffer;
	}): Promise<void>;
}

export function releaseNotes(notes: (NpmPackageInfo | ArtifactInfo)[]) {
	const artifacts: ArtifactInfo[] = [];
	const npmPackages: NpmPackageInfo[] = [];

	for (const note of notes) {
		if (note.kind === 'artifact') {
			artifacts.push(note);
			continue;
		}
		if (note.kind === 'npm_publication') {
			npmPackages.push(note);
			continue;
		}
		throw new Error(`Unknown kind ${(note as any).kind}`);
	}

	return `${
		artifacts.length
			? `This release contains the following artifacts:\n ${artifacts
					.map(
						artifact =>
							` - ${artifact.buildTag} → ${artifact.filename}`
					)
					.join('\n')}`
			: ''
	}
${
	npmPackages.length
		? `This release contains the following NPM packages:\n ${npmPackages
				.map(
					pkg =>
						` - ${pkg.buildTag} → [${pkg.package_name}](https://npmjs.com/package/svgshot)`
				)
				.join('\n')}`
		: ''
}
`;
}

const release =
	(...fns: (() => Promise<ArtifactInfo | NpmPackageInfo>)[]) =>
	async ({
		dryRun,
		createRelease,
		releaseNotes,
		uploadReleaseAsset,
	}: ReleaseProps) => {
		const logInfo = await Promise.all(fns.map(f => f()));

		const { release_id } = await createRelease({
			body: releaseNotes(logInfo),
		});

		const publish: Context['publish'] = async (
			file: string,
			content: Buffer
		) =>
			uploadReleaseAsset({
				release_id,
				name: file,
				data: content,
			});

		const exec: Context['exec'] = dryRun
			? async (filename: string) => {
					if (filename == '')
						throw new Error('Request to exec empty string');
			  }
			: async (filename: string) =>
					void (await promisify(child_process.execFile)(filename));

		await Promise.all(
			logInfo.map(({ publish: p }) => p({ publish, exec }))
		);
	};

export const program = Program.name('release')
	.description(
		'performs the action of creating a github release, and associated actions'
	)
	.option('--dryRun <bool>', 'Perform a dry run.', false)
	.action(async dryRun => {
		const syntheticVersion = `v0.0.0-${new Date().getTime()}-${
			context.sha
		}`;

		const Github =
			dryRun == false
				? getOctokit(process.env['GITHUB_TOKEN']!)
				: undefined;

		const releaser = release(
			artifact(
				'recursive_vassals.zip',
				'//project/ck3/recursive-vassals/mod_zip.zip'
			),
			artifact(
				'recursive_vassals.patch',
				'//project/ck3/recursive-vassals/mod.patch'
			),
			artifact('svgshot.tar.gz', '//ts/cmd/svgshot/svgshot.tgz'),
			npmPackage('svgshot', '//ts/cmd/svgshot/npm_pkg.publish.sh')
		);

		if (!dryRun && Github === undefined)
			throw new Error('Unable to initialize Github API.');

		releaser({
			uploadReleaseAsset:
				dryRun == false && Github !== undefined
					? async ({ name, release_id, data }) =>
							void (await Github.rest.repos.uploadReleaseAsset({
								owner: context.repo.owner,
								repo: context.repo.repo,
								release_id: await release_id,
								name,
								// https://github.com/octokit/octokit.js/discussions/2087#discussioncomment-646569
								data: data as unknown as string,
							}))
					: async ({ name, release_id, data }) => {
							if (name === '') throw new Error('Name is empty');
							if (!release_id)
								throw new Error('Release_id is empty');
							if (!data) throw new Error('data is empty');
					  },

			createRelease:
				Github !== undefined
					? async ({ body }) => ({
							release_id: (
								await Github.rest.repos.createRelease({
									// could probably use a spread operator here
									// but i also think that would be uglier...
									owner: context.repo.owner,
									repo: context.repo.repo,

									tag_name: syntheticVersion,

									body,

									generate_release_notes: true,

									name: syntheticVersion,

									target_commitish: context.ref,
								})
							).data.id,
					  })
					: async ({ body }) => {
							if (body === '')
								throw new Error(`Release body is empty.`);
							return { release_id: 0 };
					  },
			dryRun: dryRun,

			releaseNotes,
		});
	});

export default program;
