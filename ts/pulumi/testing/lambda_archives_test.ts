import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from '@jest/globals';
import * as pulumi from '@pulumi/pulumi';
import JSZip from 'jszip';
import { lambdaArchiveViolations } from './lambda_archives.js';

const directories: string[] = [];
afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map(directory => rm(directory, { recursive: true, force: true }))
	);
});
async function directory() {
	const result = await mkdtemp(path.join(tmpdir(), 'lambda-archive-'));
	directories.push(result);
	return result;
}
const resource = (
	code: pulumi.asset.Archive
): pulumi.runtime.MockResourceArgs => ({
	type: 'aws:lambda/function:Function',
	name: 'arbitrary_component',
	custom: true,
	inputs: { code },
});

test('rejects empty deployment archives, including nested directories and ZIPs', async () => {
	const root = await directory();
	const empty = path.join(root, 'empty');
	await mkdir(path.join(empty, 'nested'), { recursive: true });
	const zip = path.join(root, 'empty.zip');
	await writeFile(
		zip,
		await new JSZip().generateAsync({ type: 'nodebuffer' })
	);
	for (const archive of [
		new pulumi.asset.AssetArchive({}),
		new pulumi.asset.AssetArchive({
			nested: new pulumi.asset.AssetArchive({}),
		}),
		new pulumi.asset.FileArchive(empty),
		new pulumi.asset.FileArchive(zip),
	]) {
		expect(await lambdaArchiveViolations([resource(archive)])).toEqual([
			expect.stringContaining('contains no files'),
		]);
	}
});

test('catches symlinked Bazel runfiles and accepts explicit file assets', async () => {
	const root = await directory();
	const bundle = path.join(root, 'handler.mjs');
	await writeFile(bundle, 'export const handler = () => {};');
	const runfiles = path.join(root, 'runfiles');
	await mkdir(runfiles);
	const link = path.join(runfiles, 'handler.mjs');
	await symlink(bundle, link);
	expect(
		await lambdaArchiveViolations([
			resource(new pulumi.asset.FileArchive(runfiles)),
		])
	).toEqual([expect.stringContaining('contains symlink')]);
	// A regular file must not hide a missing symlinked handler.
	await writeFile(path.join(runfiles, 'package.json'), '{}');
	expect(
		await lambdaArchiveViolations([
			resource(new pulumi.asset.FileArchive(runfiles)),
		])
	).toEqual([expect.stringContaining('contains symlink')]);
	expect(
		await lambdaArchiveViolations([
			resource(
				new pulumi.asset.AssetArchive({
					'handler.mjs': new pulumi.asset.FileAsset(link),
				})
			),
		])
	).toEqual([]);
	const nested = path.join(root, 'nested');
	await mkdir(nested);
	await symlink(runfiles, path.join(nested, 'server'));
	expect(
		await lambdaArchiveViolations([
			resource(new pulumi.asset.FileArchive(nested)),
		])
	).toEqual([expect.stringContaining('contains symlink')]);
});

test('accepts real directory, ZIP, string and nested file assets', async () => {
	const root = await directory();
	await writeFile(
		path.join(root, 'handler.mjs'),
		'export const handler = () => {};'
	);
	const zip = new JSZip().file(
		'handler.mjs',
		'export const handler = () => {};'
	);
	const file = path.join(root, 'code.zip');
	await writeFile(file, await zip.generateAsync({ type: 'nodebuffer' }));
	for (const code of [
		new pulumi.asset.FileArchive(root),
		new pulumi.asset.FileArchive(file),
		new pulumi.asset.AssetArchive({
			'index.js': new pulumi.asset.StringAsset(
				'exports.handler = () => {};'
			),
		}),
		new pulumi.asset.AssetArchive({
			nested: new pulumi.asset.AssetArchive({
				'handler.mjs': new pulumi.asset.FileAsset(
					path.join(root, 'handler.mjs')
				),
			}),
		}),
	])
		expect(await lambdaArchiveViolations([resource(code)])).toEqual([]);
});

test('reports missing assets and corrupt ZIPs with the component name', async () => {
	const root = await directory();
	const corrupt = path.join(root, 'invalid.zip');
	await writeFile(corrupt, 'not a ZIP');
	for (const code of [
		new pulumi.asset.AssetArchive({
			'handler.mjs': new pulumi.asset.FileAsset(
				path.join(root, 'missing')
			),
		}),
		new pulumi.asset.FileArchive(corrupt),
	]) {
		const errors = await lambdaArchiveViolations([resource(code)]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toContain('arbitrary_component');
	}
});

test('does not mistake container or S3-backed Lambdas for local archives', async () => {
	expect(
		await lambdaArchiveViolations([
			{
				...resource(new pulumi.asset.AssetArchive({})),
				inputs: { packageType: 'Image', imageUri: 'example/image' },
			},
			{
				...resource(new pulumi.asset.AssetArchive({})),
				inputs: { s3Bucket: 'example', s3Key: 'code.zip' },
			},
		])
	).toEqual([]);
});
