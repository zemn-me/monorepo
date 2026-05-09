import { ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import Path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from '@jest/globals';
import glob from 'fast-glob';
import { Browser, By, ThenableWebDriver, until } from 'selenium-webdriver';
import handler from 'serve-handler';

import { Driver } from '#root/ts/selenium/webdriver.js';

const resolveRunfilesPath = (candidate: string): string => {
	const workspace = process.env.TEST_WORKSPACE ?? 'monorepo';
	return runfiles.resolve(`${workspace}/${candidate}`);
};

const base = resolveRunfilesPath('project/me/zemn/build/client');

const pathsThatMayError = new Set(['healthcheck/bad', 'poc/c/', 'callback']);

const queryStateRoutes = [
	'/experiments/factorio/blueprint/parse',
	'/experiments/frame',
	'/tool/elastictabs',
];

function staticDocumentExists(pathname: string): boolean {
	const path = Path.resolve(base, `.${pathname}`);
	if (path !== base && !path.startsWith(`${base}${Path.sep}`)) return false;

	return [path, `${path}.html`, Path.join(path, 'index.html')].some(
		candidate => fs.existsSync(candidate)
	);
}

function spaFallbackUrl(requestUrl: string): string | undefined {
	const url = new URL(requestUrl, 'http://localhost');
	if (Path.extname(url.pathname) !== '') return;
	if (staticDocumentExists(url.pathname)) return;
	return `/__spa-fallback.html${url.search}`;
}

describe('zemn.me website', () => {
	describe('Endpoint Tests', () => {
		let server: http.Server;
		let origin: string;
		let apiProc: ChildProcess;
		let apiOrigin: string;
		let driver: ThenableWebDriver;
		const paths = glob
			.sync(Path.join(base, '/**/*.html'))
			.map(path =>
				Path.relative(base, path).replace(/index.html|.html$/g, '')
			);
		paths.sort();

		beforeAll(async () => {
			server = http
				.createServer((rq, rw) => {
					if (rq.url !== undefined) {
						rq.url = spaFallbackUrl(rq.url) ?? rq.url;
					}
					void handler(rq, rw, { public: base });
				})
				.listen();

			const addressInfo = server.address();

			if (addressInfo == null || typeof addressInfo === 'string') {
				throw new Error('Not AddressInfo');
			}

			origin = `http://localhost:${addressInfo.port}`;

			const apiBin = resolveRunfilesPath(
				'project/me/zemn/api/cmd/localserver/localserver_/localserver'
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
				setTimeout(
					() => reject(new Error('api server did not start')),
					10000
				);
			});
		});

		beforeEach(async () => {
			driver = Driver().forBrowser(Browser.CHROME).build();
		});

		afterAll(async () => {
			apiProc.kill();
			await new Promise<void>((resolve, reject) => {
				server.close(err => (err ? reject(err) : resolve()));
			});
		});

		const testEndpoint = async (endpoint: string) => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/${endpoint}`);
				await new Promise<void>(ok => setTimeout(ok, 1000));
				const logs = await driver.manage().logs().get('browser');
				const url: string = await driver.getCurrentUrl();
				if (new URL(url).origin !== origin) return [];

				return logs.length
					? logs.map(log => ({ url, endpoint, log }))
					: logs;
			} finally {
				await driver.quit();
			}
		};

		const expectNoSevereBrowserLogs = async () => {
			const logs = await driver.manage().logs().get('browser');
			expect(
				logs.filter(log => log.level.name === 'SEVERE')
			).toHaveLength(0);
		};

		it.each(paths)('/%s should have no errors', async path => {
			const logs = await testEndpoint(path);
			if (pathsThatMayError.has(path)) return;
			expect(
				logs.filter(log =>
					'log' in log
						? log.log.message.includes('Ignoring event: localhost')
						: false
				)
			).toHaveLength(0);
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

		it.each(queryStateRoutes)(
			'%s serves without browser errors',
			async path => {
				try {
					await driver.manage().setTimeouts({ implicit: 5000 });
					await driver.get(`${origin}${path}`);
					await driver.wait(until.elementLocated(By.css('h1')), 5000);
					await expectNoSevereBrowserLogs();
				} finally {
					await driver.quit();
				}
			}
		);

		it('/experiments/frame keeps inherited metadata', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/experiments/frame`);
				await driver.wait(until.elementLocated(By.css('h1')), 5000);

				const head = (await driver.executeScript(`
					return {
						canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
						description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
						formatDetection: document.querySelector('meta[name="format-detection"]')?.getAttribute('content'),
						themeColors: Array.from(document.querySelectorAll('meta[name="theme-color"]')).map(meta => meta.getAttribute('content')),
						title: document.title,
						twitterCreator: document.querySelector('meta[name="twitter:creator"]')?.getAttribute('content'),
					};
				`)) as {
					readonly canonical?: string;
					readonly description?: string;
					readonly formatDetection?: string;
					readonly themeColors: readonly string[];
					readonly title: string;
					readonly twitterCreator?: string;
				};

				expect(head).toEqual({
					canonical: 'https://zemn.me/experiments/frame',
					description:
						'Does some of the calculations for using a matteboard cutter.',
					formatDetection: 'telephone=no, email=no, url=no',
					themeColors: ['#010', '#fff'],
					title: expect.stringMatching(/^Framer.*zemn\.me$/),
					twitterCreator: '@zemnmez',
				});
				await expectNoSevereBrowserLogs();
			} finally {
				await driver.quit();
			}
		});

		it('letterhead homepage link is not styled like a content hyperlink', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/experiments/frame`);
				await driver.wait(
					until.elementLocated(
						By.css('a[aria-label="Go to homepage"]')
					),
					5000
				);

				const style = (await driver.executeScript(`
					const link = document.querySelector('a[aria-label="Go to homepage"]');
					const linkStyle = getComputedStyle(link);
					return {
						bodyColor: getComputedStyle(document.body).color,
						color: linkStyle.color,
						textDecorationLine: linkStyle.textDecorationLine,
					};
				`)) as {
					readonly bodyColor: string;
					readonly color: string;
					readonly textDecorationLine: string;
				};

				expect(style).toEqual({
					bodyColor: style.bodyColor,
					color: style.bodyColor,
					textDecorationLine: 'none',
				});
				await expectNoSevereBrowserLogs();
			} finally {
				await driver.quit();
			}
		});

		it('/experiments/frame keeps form state in the URL', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(
					`${origin}/experiments/frame?frame_width=10in`
				);

				await driver.wait(async () => {
					const value = await driver
						.findElement(By.css('input[aria-label="Frame width"]'))
						.getAttribute('value');
					return value === '10in';
				}, 5000);
				const minimumCutDepth = await driver.findElement(
					By.css('input[aria-label="Minimum cut depth"]')
				);

				await minimumCutDepth.sendKeys('2cm');
				await driver.wait(async () => {
					const url = new URL(await driver.getCurrentUrl());
					return url.searchParams.get('minimum_cut_depth') === '2cm';
				}, 5000);

				await driver.navigate().refresh();
				await driver.wait(
					until.elementLocated(
						By.css('input[aria-label="Frame width"]')
					),
					5000
				);
				expect(
					await driver
						.findElement(
							By.css('input[aria-label="Minimum cut depth"]')
						)
						.getAttribute('value')
				).toBe('2cm');
				await expectNoSevereBrowserLogs();
			} finally {
				await driver.quit();
			}
		});

		it('/tool/elastictabs keeps text and flags in the URL', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/tool/elastictabs`);

				const input = await driver.findElement(
					By.css('textarea[aria-label="Elastic tabstops input"]')
				);
				await input.sendKeys('alpha beta');

				const collapseSpaces = await driver.findElement(
					By.css('input[aria-label="Collapse spaces to tabs"]')
				);
				await collapseSpaces.click();

				await driver.wait(async () => {
					const url = new URL(await driver.getCurrentUrl());
					return (
						decodeURIComponent(
							url.searchParams.get('input') ?? ''
						) === 'alpha beta' &&
						url.searchParams.get('collapseSpaces') === 'true'
					);
				}, 5000);

				await driver.navigate().refresh();
				await driver.wait(
					async () =>
						(await driver
							.findElement(
								By.css(
									'textarea[aria-label="Elastic tabstops input"]'
								)
							)
							.getAttribute('value')) === 'alpha beta',
					5000
				);
				expect(
					await driver
						.findElement(
							By.css(
								'textarea[aria-label="Elastic tabstops input"]'
							)
						)
						.getAttribute('value')
				).toBe('alpha beta');
				expect(
					await driver
						.findElement(
							By.css(
								'input[aria-label="Collapse spaces to tabs"]'
							)
						)
						.isSelected()
				).toBe(true);
				await expectNoSevereBrowserLogs();
			} finally {
				await driver.quit();
			}
		});
	});
});
