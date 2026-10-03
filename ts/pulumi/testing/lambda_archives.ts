import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import * as pulumi from '@pulumi/pulumi';
import JSZip from 'jszip';

// Pulumi's directory archive walker omits symlinks, including Bazel runfiles.
// Explicit FileAssets follow them instead. Reject silent omissions even when
// other files would keep the resulting ZIP nonempty.
async function directoryFileCount(directory: string): Promise<number> {
	let count = 0;
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const file = path.join(directory, entry.name);
		if (entry.isSymbolicLink()) {
			throw new Error(
				`directory FileArchive contains symlink ${file}; use explicit FileAssets in an AssetArchive`
			);
		}
		if (entry.isDirectory()) count += await directoryFileCount(file);
		else if (entry.isFile()) count++;
	}
	return count;
}

async function archiveFileCount(value: unknown): Promise<number> {
	if (value instanceof pulumi.asset.AssetArchive) {
		const counts = await Promise.all(
			Object.values(await value.assets).map(archiveFileCount)
		);
		return counts.reduce((total, count) => total + count, 0);
	}
	if (value instanceof pulumi.asset.StringAsset) return 1;
	if (value instanceof pulumi.asset.FileAsset) {
		const file = await value.path;
		if (!(await stat(file)).isFile())
			throw new Error(`FileAsset is not a regular file: ${file}`);
		return 1;
	}
	if (value instanceof pulumi.asset.FileArchive) {
		const file = await value.path;
		if ((await stat(file)).isDirectory()) return directoryFileCount(file);
		const zip = await JSZip.loadAsync(await readFile(file));
		return Object.values(zip.files).filter(entry => !entry.dir).length;
	}
	throw new Error(
		'archive cannot be inspected offline; use local ZIPs, directory FileArchives, or explicit AssetArchives'
	);
}

/** Check every locally supplied Lambda ZIP, independent of its site or component. */
export async function lambdaArchiveViolations(
	resources: readonly pulumi.runtime.MockResourceArgs[]
): Promise<string[]> {
	const violations: string[] = [];
	for (const resource of resources) {
		if (
			resource.type !== 'aws:lambda/function:Function' ||
			resource.inputs['code'] === undefined
		)
			continue;
		try {
			const code: unknown = resource.inputs['code'];
			if (!pulumi.asset.Archive.isInstance(code))
				throw new Error('code must be an archive');
			if ((await archiveFileCount(code)) === 0)
				throw new Error('deployment archive contains no files');
		} catch (error) {
			violations.push(
				`${resource.type} ${JSON.stringify(resource.name)}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	return violations;
}
