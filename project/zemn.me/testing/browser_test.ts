import { ChildProcess, spawn } from 'node:child_process';
import Path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import glob from 'fast-glob';
import { Browser, By, ThenableWebDriver } from 'selenium-webdriver';

import { Driver } from '#root/ts/selenium/webdriver.js';

const base = runfiles.resolveWorkspaceRelative('project/zemn.me/out');

const pathsThatMayError = new Set(['healthcheck/bad', 'poc/c/']);


describe('zemn.me website', () => {
	describe('Endpoint Tests', () => {
                let webProc: ChildProcess;
                let origin: string;
                let apiProc: ChildProcess;
                let apiOrigin: string;
                let driver: ThenableWebDriver;
		const paths = glob.sync(Path.join(base, '/**/*.html')).map(path =>
			Path.relative(base, path).replace(/index.html|.html$/g, '')
		);
		paths.sort();

                beforeAll(async () => {
                        const apiBin = runfiles.resolveWorkspaceRelative(
                                'project/zemn.me/api/cmd/localserver/localserver_/localserver'
                        );
                        apiProc = spawn(apiBin, {
                                stdio: ['ignore', 'pipe', 'inherit'],
                        });
                        apiOrigin = await new Promise<string>((resolve, reject) => {
                                apiProc.stdout!.on('data', chunk => {
                                        const m = /PORT=(\d+)/.exec(chunk.toString());
                                        if (m) {
                                                resolve(`http://localhost:${m[1]}`);
                                        }
                                });
                                apiProc.once('error', reject);
                                setTimeout(() => reject(new Error('api server did not start')), 10000);
                        });

                        const nextBin = runfiles.resolveWorkspaceRelative('project/zemn.me/start_/start');
                        webProc = spawn(nextBin, {
                                stdio: ['ignore', 'pipe', 'inherit'],
                                env: {
                                        ...process.env,
                                        PORT: '0',
                                        NEXT_PUBLIC_ZEMN_ME_API_BASE: apiOrigin,
                                },
                        });
                        origin = await new Promise<string>((resolve, reject) => {
                                webProc.stdout!.on('data', chunk => {
                                        const m = /localhost:(\d+)/.exec(chunk.toString());
                                        if (m) {
                                                resolve(`http://localhost:${m[1]}`);
                                        }
                                });
                                webProc.once('error', reject);
                                setTimeout(() => reject(new Error('next server did not start')), 20000);
                        });
                });

		beforeEach(async () => {
			driver = Driver().forBrowser(Browser.CHROME).build();
		});

                afterAll(async () => {
                        apiProc.kill();
                        webProc.kill();
                });

		const testEndpoint = async (endpoint: string) => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/${endpoint}`);
				await new Promise<void>(ok => setTimeout(ok, 1000));
				const logs = await driver.manage().logs().get('browser');
				const url: string = await driver.getCurrentUrl();
				if (new URL(url).origin !== origin) return [];

				return logs.length ? logs.map(log => ({ url, endpoint, log })) : logs;
			} finally {
				await driver.quit();
			}
		};

                it.each(paths)('/%s should have no errors', async path => {
                        const logs = await testEndpoint(path);
                        if (pathsThatMayError.has(path)) return;
                        expect(logs).toHaveLength(
                                0
                        );
                });

                it('api server /healthz returns OK', async () => {
                        try {
                                await driver.get(`${apiOrigin}/healthz`);
                                const body = await driver.findElement(By.css('body')).getText();
                                expect(body).toBe('"OK"');
                        } finally {
                                await driver.quit();
                        }
                });
        });

});
