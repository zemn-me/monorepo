/**
 * @fileoverview Performs a release.
 */

import { context as githubCtx, getOctokit } from '@actions/github';
import { UpResult } from '@pulumi/pulumi/automation';
import child_process from 'child_process';
import { Command } from 'commander';
import fs from 'fs/promises';
import { isDefined } from 'ts/guard';
import pulumiUp from 'ts/pulumi/run';
import { promisify } from 'util';

import { context as mockContext, Github as mockGithub } from './mocks';

export class Errors<T extends Error[]> extends Error {
	// must be nullable because we return
	// a single Error if provided with one.
	public readonly errors?: T;
	constructor(errors: T) {
		// should be able to check this statically but I don't know how yet.
		if (errors.length == 0) throw new Error('No errors provided');
		if (errors.length == 1) return errors[0];
		super(
			`Several errors occurred:\n${nestedListToMarkdown(
				errors.map(e => e.toString())
			)}`
		);

		this.errors = errors;
	}
}

interface Context {
	publish(filename: string, content: Buffer): Promise<void>;
	exec(filename: string): Promise<void>;
	dryRun: boolean;
}

interface ArtifactInfo {
	kind: 'artifact';
	filename: string;
	buildTag: string;
	publish: (c: Context) => Promise<void>;
}

const artifact =
	(filename: string, buildTag: string) =>
	async (): Promise<ArtifactInfo> => ({
		kind: 'artifact',
		filename,
		buildTag,
		publish: async ({ publish }: Context) =>
			await publish(filename, await fs.readFile(buildTag)),
	});

interface PulumiDeployInfo {
	kind: 'pulumi_deploy';
	publish: (c: Context) => Promise<UpResult | void>;
}

const pulumiDeploy = () => async (): Promise<PulumiDeployInfo> => ({
	kind: 'pulumi_deploy',
	async publish({ dryRun }: Context): Promise<UpResult> {
		if (!dryRun) return pulumiUp();

		return {
			stdout: 'some fake pulumi stdout',
			stderr: 'some fake pulumi stderr',
			summary: {
				kind: 'update',
				startTime: new Date(),
				message: 'this is fake!',
				environment: {},
				config: {},
				endTime: new Date(),
				result: 'succeeded',
				version: 90,
			},
			outputs: {
				abc: { value: 'something', secret: false },
				abc2: { value: 'something', secret: true },
			},
		};
	},
});

interface NpmPackageInfo {
	kind: 'npm_publication';
	package_name: string;
	buildTag: string;
	publish: (c: Context) => Promise<void>;
}

const npmPackage =
	(packageName: string, buildTag: string) =>
	async (): Promise<NpmPackageInfo> => {
		if (!buildTag.includes(packageName))
			throw new Error(
				`Build tag ${buildTag} does not include package name ${packageName}. Are you sure it's correct?`
			);
		return {
			buildTag,
			kind: 'npm_publication',
			package_name: packageName,
			async publish({ exec }: Context) {
				if (!('NPM_TOKEN' in process.env))
					console.error(
						"Missing NPM_TOKEN. We won't be able to publish any NPM packages."
					);
				return void (await exec(buildTag));
			},
		};
	};

type OperationData = UpResult | void;

type Operation = ArtifactInfo | NpmPackageInfo | PulumiDeployInfo;

class OperationFailure<O extends Operation = Operation> extends Error {
	constructor(
		public readonly operation: O,
		public readonly error: Error
	) {
		super(
			`${operation.kind}${
				'buildTag' in operation ? ' ' + operation.buildTag : ''
			}: ${error.message}`,
			{
				cause: error.cause,
			}
		);
	}
}

type OperationOrFailure<O extends Operation = Operation> = {
	info: O | OperationFailure<O>;
	data?: OperationData;
};

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
	return s.replace(/\n/g, '\n    ');
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

export const releaseNotes =
	(logFailures?: (s: string) => void) => (notes: OperationOrFailure[]) => {
		const operationAndFailure: [
			operation: Operation,
			data: OperationData,
			error: Error | undefined,
		][] = notes.map(({ info: item, data }) => {
			let op: Operation;
			let error: Error | undefined;

			if (item instanceof OperationFailure) {
				op = item.operation;
				error = item.error;
			} else op = item;

			return [op, data, error];
		});

		const paragraphs: NestedStringList = [];

		const artifactInfo = operationAndFailure
			.map(([op /* data */, , error]) =>
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
			.map(([op /* data */, , error]) =>
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

		const operationInfo = operationAndFailure.map(
			([op /* data */, , error]) => {
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
					case 'pulumi_deploy':
						notes.push(
							`${error !== undefined ? '❌' : '✔️'} Deploy pulumi`
						);
						break;
					default:
						throw new Error('invalid kind');
				}

				return notes;
			}
		);

		if (operationInfo.length > 0)
			paragraphs.push(
				`The following operations were requested:\n${nestedListToMarkdown(
					operationInfo
				)}`
			);

		const pulumi_deploys = operationAndFailure.filter(
			([op]) => op.kind == 'pulumi_deploy'
		);

		if (pulumi_deploys.length) {
			for (const [, data] of pulumi_deploys) {
				const d = data;
				if (!d) {
					continue;
				}
				const items = [d.stdout, d.stderr].filter(isDefined);
				paragraphs.push(
					`A pulumi ${
						d.summary.kind
					} completed:\n${nestedListToMarkdown(items)}`
				);
			}
		}

		const out = paragraphs.join('\n\n');
		if (logFailures) {
			const errors = operationAndFailure
				.map(([, , err]) => err)
				.filter(isDefined);
			if (errors.length > 0) {
				logFailures(`${new Errors(errors)}`);
				logFailures(out);
			}
		}

		return out;
	};

export const release =
	(...fns: (() => Promise<Operation>)[]) =>
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
			? async (filename: string) => await fs.access(filename)
			: async (filename: string) =>
					void (await promisify(child_process.execFile)(filename));

		const results = await Promise.all(
			logInfo.map(
				async <T extends Operation>(
					info: T
				): Promise<OperationOrFailure<T>> => {
					try {
						const data = await info.publish({
							publish,
							exec,
							dryRun,
						});
						return { info, data }; // success
					} catch (e) {
						return {
							info: new OperationFailure(
								info,
								e instanceof Error
									? e
									: new Error(
											`${e} was thrown but it is not an Error`
									  )
							),
						};
					}
				}
			)
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

interface ProgramProps {
	outputReleaseNotes?(notes: string): void;
	onError?(error: string): void;
}

function memo<T>(f: () => T): () => T {
	let val: T;
	let has = false;

	return function memo() {
		if (!has) {
			val = f();
			has = true;
		}

		return val;
	};
}

export const program = ({
	outputReleaseNotes,
	onError = s => console.error(s),
}: ProgramProps = {}) =>
	new Command()
		.name('release')
		.description(
			'performs the action of creating a github release, and associated actions'
		)
		.option('--dryRun <bool>', 'Perform a dry run.', false)
		.action(async ({ dryRun }) => {
			const context = dryRun ? mockContext : githubCtx;
			const Github = dryRun
				? memo(() => mockGithub)
				: memo(() => getOctokit(process.env['GITHUB_TOKEN']!));

			const version = (
				await fs.readFile('VERSION/VERSION.version.txt')
			).toString('utf-8');

			const releaser = release(
				artifact(
					'recursive_vassals.zip',
					'project/ck3/recursive-vassals/mod_zip.zip'
				),
				artifact(
					'recursive_vassals.patch',
					'project/ck3/recursive-vassals/mod.patch'
				),
				artifact('svgshot.tar.gz', 'ts/cmd/svgshot/npm_pkg.tgz'),
				npmPackage('svgshot', 'ts/cmd/svgshot/npm_pkg.publish.sh'),
				npmPackage('do-sync', 'ts/do-sync/npm_pkg.publish.sh'),
				artifact('svgshot.tar.gz', 'ts/do-sync/npm_pkg.tgz'),
				artifact(
					'knowitwhenyouseeit.tar.gz',
					'ts/knowitwhenyouseeit/npm_pkg.tgz'
				),
				npmPackage(
					'knowitwhenyouseeit',
					'ts/knowitwhenyouseeit/npm_pkg.publish.sh'
				),
				pulumiDeploy()
			);

			const notes = await releaser({
				uploadReleaseAsset: async ({ name, release_id, data }) =>
					void (await Github().rest.repos.uploadReleaseAsset({
						owner: context.repo.owner,
						repo: context.repo.repo,
						release_id: await release_id,
						name,
						// https://github.com/octokit/octokit.js/discussions/2087#discussioncomment-646569
						data: data as unknown as string,
					})),

				createRelease: async ({ body }) => ({
					release_id: (
						await Github().rest.repos.createRelease({
							// could probably use a spread operator here
							// but i also think that would be uglier...
							owner: context.repo.owner,
							repo: context.repo.repo,

							tag_name: version,

							body,

							generate_release_notes: true,

							name: version,

							target_commitish: context.ref,
						})
					).data.id,
				}),

				dryRun: dryRun,

				releaseNotes: releaseNotes(onError),
			});

			if (outputReleaseNotes) outputReleaseNotes(notes);
		});

export default program;
