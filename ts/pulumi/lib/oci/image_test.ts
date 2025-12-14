import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { OCIImage } from './image.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

describe('OCIImage runfiles resolution', () => {
	let envBackup: NodeJS.ProcessEnv;
	let tempRoots: string[] = [];

	beforeEach(() => {
		envBackup = { ...process.env };
		tempRoots = [];
	});

	afterEach(() => {
		process.env = envBackup;
		for (const dir of tempRoots) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	function makeTempDir(): string {
		const dir = fs.mkdtempSync(path.join(tmpdir(), 'oci-image-test-'));
		tempRoots.push(dir);
		return dir;
	}

	test('prefers RUNFILES_DIR/_main path when present', () => {
		const runfilesDir = makeTempDir();
		const runfilesMain = path.join(runfilesDir, '_main');
		fs.mkdirSync(runfilesMain, { recursive: true });

		const pushPath = path.join(runfilesMain, 'push.sh');
		fs.writeFileSync(pushPath, '');
		fs.writeFileSync(`${pushPath}.runfiles`, '');
		fs.writeFileSync(`${pushPath}.runfiles_manifest`, '');

		process.env.RUNFILES_DIR = runfilesDir;

		const instance = Object.create(OCIImage.prototype) as OCIImage;
		const resolved = (instance as any).resolvePushPath('push.sh');

		expect(resolved.path).toBe(pushPath);
		expect(resolved.runfilesDir).toBe(`${pushPath}.runfiles`);
		expect(resolved.runfilesManifest).toBe(`${pushPath}.runfiles_manifest`);
	});

	test('falls back to absolute path when provided', () => {
		const root = makeTempDir();
        const abs = path.join(root, 'push.sh');
		fs.writeFileSync(abs, '');
		fs.writeFileSync(`${abs}.runfiles_manifest`, '');

		const instance = Object.create(OCIImage.prototype) as OCIImage;
		const resolved = (instance as any).resolvePushPath(abs);

		expect(resolved.path).toBe(abs);
		expect(resolved.runfilesManifest).toBe(`${abs}.runfiles_manifest`);
	});
});
