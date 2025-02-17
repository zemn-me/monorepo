import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path'
import { promisify } from "node:util";

import { afterEach, beforeEach, expect, test } from '@jest/globals';

import { copybaraBin } from "#root/ts/cmd/copybara/copybara.js";

test('smoke', () => {
	expect(copybaraBin).toBeDefined();
})

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'jest-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

test('execsmoke', async () => {
	expect.assertions(2);

	// should be set by bazel
	expect(tempDir).toBeDefined();

	await expect(promisify(execFile)(
		copybaraBin,
		["version"],
		{
			env: {
				HOME: tempDir
			}
		}
	)).resolves.toBeDefined();
})
