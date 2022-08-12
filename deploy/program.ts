/**
 * @fileoverview Performs a release.
 */

import fs from 'fs/promises';
import child_process from 'child_process';
import { promisify } from 'util';
import { context as githubCtx, getOctokit } from '@actions/github';
import { Command } from 'commander';
import { runfiles } from '@bazel/runfiles';
import { Github as mockGithub, context as mockContext } from './mocks';
import { isDefined } from 'monorepo/ts/guard';

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
					console.error(
						"Missing NPM_TOKEN. We won't be able to publish any NPM packages."
					);
				return void (await exec(
					runfiles.resolveWorkspaceRelative(buildTag)
				));
			},
		};
	};

type Operation = ArtifactInfo | NpmPackageInfo;

class OperationFailure<O extends Operation = Operation> extends Error {
	constructor(public readonly operation: O, public readonly error: Error) {
		super(
			`${operation.kind} ${operation.buildTag}: ${error.message}`,
			error.cause
		);
	}
}

type OperationOrFailure<O extends Operation = Operation> =
	| O
	| OperationFailure<O>;

interface ReleaseProps {
	dryRun: boolean;
	releaseNotes: (items: OperationOrFailure[]) => string;
	createRelease(data: { body: string }): Promise<{ release_id: number }>;
	uploadReleaseAsset(data: {
		release_id: number;
		name: string;
		data: Buffer;
	}): Promise<void>;
}

type NestedStringList = (string | NestedStringList)[];

function indent(s: string): string {
	return s.replace('\n', '\n    ');
}

function nestedListToMarkdown(nestedList: NestedStringList): string {
	return nestedList
		.map(item =>
			item instanceof Array
				? indent(nestedListToMarkdown(item))
				: indent(`- ${item}`)
		)
		.join('\n');
}

export function releaseNotes(notes: OperationOrFailure[]) {
	const operationAndFailure: [
		operation: Operation,
		error: Error | undefined
	][] = notes.map(item => {
		let op: Operation;
		let error: Error | undefined;

		if (item instanceof OperationFailure) {
			op = item.operation;
			error = item.error;
		} else op = item;

		return [op, error];
	});

	const paragraphs: NestedStringList = [];

	const artifactInfo = operationAndFailure
		.map(([op, error]) =>
			op.kind === 'artifact' && error === undefined
				? `${op.buildTag} ⟶ ${op.filename}`
				: undefined
		)
		.filter(isDefined);

	if (artifactInfo.length > 0)
		paragraphs.push(
			`Artifacts exported in this release:\n${nestedListToMarkdown(
				artifactInfo
			)}`
		);

	const npmInfo = operationAndFailure
		.map(([op, error]) =>
			op.kind === 'npm_publication' && error === undefined
				? `${op.buildTag} ⟶ [${op.package_name}](https://npmjs.com/package/${op.package_name})`
				: undefined
		)
		.filter(isDefined);

	if (npmInfo.length > 0)
		paragraphs.push(
			`NPM packages included in this release:\n${nestedListToMarkdown(
				npmInfo
			)}`
		);

	const operationInfo = operationAndFailure.map(([op, error]) => {
		const notes: NestedStringList = [];

		switch (op.kind) {
			case 'artifact':
				notes.push(
					`${error !== undefined ? '❌' : '✔️'} Upload ${
						op.buildTag
					} as release artifact ${op.filename}`
				);
				break;
			case 'npm_publication':
				notes.push(
					`${error !== undefined ? '❌' : '✔️'} Upload ${
						op.buildTag
					} to NPM`
				);
				break;
			default:
				throw new Error('invalid kind');
		}

		return notes;
	});

	if (operationInfo.length > 0)
		paragraphs.push(
			`The following operations were requested:\n${nestedListToMarkdown(
				operationInfo
			)}`
		);

	return paragraphs.join('\n\n');
}

export const release =
	(...fns: (() => Promise<ArtifactInfo | NpmPackageInfo>)[]) =>
	async ({
		dryRun,
		createRelease,
		releaseNotes,
		uploadReleaseAsset,
	}: ReleaseProps) => {
		const logInfo = await Promise.all(fns.map(f => f()));

		const releaseUploads: [file: string, content: Buffer][] = [];

		// defer publication until we have the release_id.
		// otherwise, we can't tell if publishing would break for the
		// release notes. This could be a promise, but it feels a bit
		// weird and unnecessary.
		const publish: Context['publish'] = async (
			file: string,
			content: Buffer
		) => void releaseUploads.push([file, content]);

		const exec: Context['exec'] = dryRun
			? async (filename: string) => {
					if (filename == '')
						throw new Error('Request to exec empty string');
			  }
			: async (filename: string) => {
					console.log('executing', filename);
					return void (await promisify(child_process.execFile)(
						filename
					));
			  };

		const results = await Promise.all(
			logInfo.map(async info => {
				try {
					await info.publish({ publish, exec });
					return info; // success
				} catch (e) {
					return new OperationFailure(
						info,
						e instanceof Error
							? e
							: new Error(
									`${e} was thrown but it is not an Error`
							  )
					);
				}
			})
		);

		const notes = releaseNotes(results);

		const { release_id } = await createRelease({
			body: releaseNotes(results),
		});

		for (const [file, content] of releaseUploads)
			await uploadReleaseAsset({
				release_id,
				name: file,
				data: content,
			});

		return notes;
	};

export const program = (outputReleaseNotes?: (notes: string) => void) =>
	new Command()
		.name('release')
		.description(
			'performs the action of creating a github release, and associated actions'
		)
		.option('--dryRun <bool>', 'Perform a dry run.', false)
		.action(async ({ dryRun }) => {
			const context = dryRun ? mockContext : githubCtx;
			const Github = dryRun
				? mockGithub
				: getOctokit(process.env['GITHUB_TOKEN']!);

			const syntheticVersion = `v0.0.0-${new Date().getTime()}-${
				context.sha
			}`;

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
				npmPackage('svgshot', '//ts/cmd/svgshot/npm_pkg.publish.sh'),
				artifact(
					'knowitwhenyouseeit.tar.gz',
					'//ts/knowitwhenyouseeit/knowitwhenyouseeit.tgz'
				),
				npmPackage(
					'knowitwhenyouseeit',
					'//ts/knowitwhenyouseeit/npm_pkg.publish.sh'
				)
			);

			const notes = await releaser({
				uploadReleaseAsset: async ({ name, release_id, data }) =>
					void (await Github.rest.repos.uploadReleaseAsset({
						owner: context.repo.owner,
						repo: context.repo.repo,
						release_id: await release_id,
						name,
						// https://github.com/octokit/octokit.js/discussions/2087#discussioncomment-646569
						data: data as unknown as string,
					})),

				createRelease: async ({ body }) => ({
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
				}),

				dryRun: dryRun,

				releaseNotes,
			});

			if (outputReleaseNotes) outputReleaseNotes(notes);
		});

export default program;
