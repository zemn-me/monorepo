import Path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import { beforeAll, describe, expect, it } from '@jest/globals';
import glob from 'fast-glob';
import { Browser, By, ThenableWebDriver } from 'selenium-webdriver';

import { Driver } from '#root/ts/selenium/webdriver.js';

const base = runfiles.resolveWorkspaceRelative('project/zemn.me/out');

const pathsThatMayError = new Set(['healthcheck/bad', 'poc/c/']);


describe('zemn.me website', () => {
	describe('Endpoint Tests', () => {
                let origin: string;
                let driver: ThenableWebDriver;
		const paths = glob.sync(Path.join(base, '/**/*.html')).map(path =>
			Path.relative(base, path).replace(/index.html|.html$/g, '')
		);
		paths.sort();
                beforeAll(async () => {
					driver = Driver().forBrowser(Browser.CHROME).build();

					const ports = JSON.parse(process.env['ASSIGNED_PORTS']!);

					console.log(ports);

					origin = ports.something;
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
					expect.assertions(1);
                        const logs = await testEndpoint(path);
                        if (pathsThatMayError.has(path)) return;
                        expect(logs).toHaveLength(
                                0
                        );
                });

                it('api server /healthz returns OK', async () => {
                        try {
								expect.assertions(1);
                                const body = await driver.findElement(By.css('body')).getText();
                                expect(body).toBe('"OK"');
                        } finally {
                                await driver.quit();
                        }
                });
        });

});
