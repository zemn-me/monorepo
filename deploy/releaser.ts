import child_process from 'child_process';
import fs from 'fs/promises';
import { promisify } from 'util';
import { ReleaseProps, OperationFailure, NpmPackageInfo, ArtifactInfo, Context } from 'monorepo/deploy/types';
import { runfiles } from '@bazel/runfiles';

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

export const artifact =
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

export const npmPackage =
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