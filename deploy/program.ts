/**
 * @fileoverview Performs a release.
 */

import { context as githubCtx, getOctokit } from '@actions/github';
import { Command } from 'commander';
import { Github as mockGithub, context as mockContext } from './mocks';
import { isDefined } from 'monorepo/ts/guard';
import {
	OperationOrFailure,
	Operation,
	OperationFailure,
} from 'monorepo/deploy/types';
import release from 'monorepo/deploy/config';

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

			const notes = await release({
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
