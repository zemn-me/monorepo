import { ChildProcess, spawn } from 'node:child_process';
import http from 'node:http';
import Path from 'node:path';
import { pathToFileURL } from 'node:url';

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
import { Browser, By, logging, ThenableWebDriver } from 'selenium-webdriver';
import handler from 'serve-handler';

import { Driver } from '#root/ts/selenium/webdriver.js';

const resolveRunfilesPath = (candidate: string): string => {
	const workspace = process.env.TEST_WORKSPACE ?? 'monorepo';
	return runfiles.resolve(`${workspace}/${candidate}`);
};

const base = resolveRunfilesPath('project/me/zemn/build');

const pathsThatMayError = new Set(['healthcheck/bad', 'poc/c/', 'callback']);

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
		paths.push('journal', 'admin', 'callback', 'key', 'healthz');
		paths.sort();

		beforeAll(async () => {
			const { handleRequest, createNodeListener, staticPaths } =
				await import(
					pathToFileURL(Path.join(base, '../server/handler.mjs')).href
				);
			const listener = createNodeListener(handleRequest);
			server = http
				.createServer((rq, rw) => {
					if (
						staticPaths.includes(
							new URL(rq.url!, 'http://localhost').pathname
						)
					)
						void handler(rq, rw, { public: base });
					else void listener(rq, rw);
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

				return logs.map(log => ({ url, endpoint, log }));
			} finally {
				await driver.quit();
			}
		};

		it.each(paths)('/%s should have no errors', async path => {
			const logs = await testEndpoint(path);
			if (pathsThatMayError.has(path)) return;
			expect(
				logs.filter(
					({ log }) => log.level.value >= logging.Level.SEVERE.value
				)
			).toEqual([]);
		});

		it.each([
			'/journal?wiki=all',
			'/journal/day?at=2026-10-03T12:00:00.000Z',
		])(
			'hydrates the production journal and survives navigation at %s',
			async path => {
				try {
					await driver.get(`${origin}${path}`);
					const assertJournalReady = async () => {
						await driver.wait(
							async () => {
								const headings = await driver.findElements(
									By.css('h1')
								);
								const text = await Promise.all(
									headings.map(h => h.getText())
								);
								expect(text).not.toContain(
									'Something went wrong'
								);
								const buttons = await driver.findElements(
									By.css(
										'button[aria-label="Authenticate with OIDC"]'
									)
								);
								return (
									text.includes('Journal') &&
									buttons.length === 1 &&
									(await buttons[0]!.isEnabled())
								);
							},
							15000,
							'Production journal did not become interactive'
						);
						expect(
							(
								await driver.manage().logs().get('browser')
							).filter(
								log =>
									log.level.value >=
									logging.Level.SEVERE.value
							)
						).toEqual([]);
					};
					// The server HTML alone can look correct while the browser's
					// HydrationBoundary reads a different React Query context.
					await assertJournalReady();
					await driver.navigate().refresh();
					await assertJournalReady();
					await driver
						.findElement(
							By.css('summary[aria-label="Open navigation menu"]')
						)
						.click();
					await driver
						.findElement(
							By.css(
								'nav[aria-label="Site navigation"] a[href="/article"]'
							)
						)
						.click();
					await driver.wait(
						async () =>
							(await driver
								.findElement(By.css('h1'))
								.getText()) === 'Articles.',
						10000
					);
					await driver.navigate().back();
					await assertJournalReady();
				} catch (error) {
					throw new Error(
						`Production journal browser logs: ${JSON.stringify(await driver.manage().logs().get('browser'))}`,
						{ cause: error }
					);
				} finally {
					await driver.quit();
				}
			}
		);

		it('api server /healthz returns OK', async () => {
			try {
				await driver.get(`${apiOrigin}/healthz`);
				const body = await driver.findElement(By.css('body')).getText();
				expect(body).toBe('"OK"');
			} finally {
				await driver.quit();
			}
		});

		it('homepage hero has a poster-coloured fallback background', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/`);

				const hero = await driver.findElement(By.css('figure'));
				const styleAttribute = await hero.getAttribute('style');
				expect(styleAttribute).toContain('background-color');

				const backgroundColor = (await driver.executeScript(
					'return getComputedStyle(arguments[0]).backgroundColor;',
					hero
				)) as string;
				expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
				expect(backgroundColor).not.toBe('transparent');
			} finally {
				await driver.quit();
			}
		});

		it.each(['/', '/article', '/experiments'])(
			'keeps the hero video mounted when using the menu from %s',
			async start => {
				try {
					await driver.manage().setTimeouts({ implicit: 5000 });
					await driver.get(`${origin}${start}`);
					// The static document is visible before its client handlers load.
					await driver.wait(
						async () => {
							const login = await driver.findElement(
								By.css(
									'nav[aria-label="Site navigation"] button'
								)
							);
							return login.isEnabled();
						},
						10000,
						'Login control did not become ready after hydration'
					);
					const video = await driver.findElement(
						By.css('figure video')
					);

					for (const destination of [
						'/article',
						'/experiments',
						'/',
					]) {
						if (destination === start) continue;
						await driver
							.findElement(
								By.css(
									'summary[aria-label="Open navigation menu"]'
								)
							)
							.click();
						await driver
							.findElement(
								By.css(
									`nav[aria-label="Site navigation"] a[href="${destination}"]`
								)
							)
							.click();
						await driver.wait(
							async () =>
								(await driver.getCurrentUrl()) ===
								`${origin}${destination}`,
							5000,
							`Navigation did not reach ${destination}`
						);
						// A remount or full-page navigation makes this original
						// WebElement stale, even if the replacement looks identical.
						expect(
							await driver.executeScript(
								'return arguments[0] === document.querySelector("figure video");',
								video
							)
						).toBe(true);
						await driver.wait(
							async () =>
								(await driver
									.findElement(
										By.css(
											'nav[aria-label="Site navigation"] details'
										)
									)
									.getAttribute('open')) === null,
							5000,
							`Navigation menu did not close after reaching ${destination}`
						);
					}
				} catch (error) {
					throw new Error(
						`Browser logs: ${JSON.stringify(await driver.manage().logs().get('browser'))}`,
						{ cause: error }
					);
				} finally {
					await driver.quit();
				}
			}
		);

		it('homepage profile photo has a sampled fallback background', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/`);

				const profilePhoto = await driver.findElement(
					By.css('img[alt="Thomas Neil James Shadwell"]')
				);
				const frame = await profilePhoto.findElement(By.xpath('..'));
				const styleAttribute = await frame.getAttribute('style');
				expect(styleAttribute).toContain('background-color');

				const backgroundColor = (await driver.executeScript(
					'return getComputedStyle(arguments[0]).backgroundColor;',
					frame
				)) as string;
				expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
				expect(backgroundColor).not.toBe('transparent');
			} finally {
				await driver.quit();
			}
		});

		it('article index lists every released article and opens one', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/article`);

				const heading = await driver.findElement(By.css('h1'));
				expect(await heading.getText()).toBe('Articles.');

				const menuButton = await driver.findElement(
					By.css('summary[aria-label="Open navigation menu"]')
				);
				await menuButton.click();
				const articleMenuLinks = await driver.findElements(
					By.css(
						'nav[aria-label="Site navigation"] a[href^="/article"]'
					)
				);
				expect(
					await Promise.all(
						articleMenuLinks.map(async link => ({
							href: await link.getAttribute('href'),
							text: await link.getText(),
						}))
					)
				).toEqual([{ href: `${origin}/article`, text: 'Articles' }]);
				await menuButton.click();

				const list = await driver.findElement(
					By.css('ol[aria-label="Published articles"]')
				);
				const links = await list.findElements(By.css('a'));
				expect(
					await Promise.all(links.map(link => link.getText()))
				).toEqual([
					'Letter to Kasimir',
					'The Hagiography of Clean',
					'Missing',
					"If CORS is just a header, why don't attackers just ignore it?",
					'When Security Generates Insecurity',
				]);

				await links[0]!.click();
				await driver.wait(
					async () =>
						(await driver.getCurrentUrl()) ===
						`${origin}/article/2026/kasimir`,
					5000
				);
			} finally {
				await driver.quit();
			}
		});

		it('experiment index lists every experiment and opens one', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/tool/elastictabs?input=hello`);
				await driver.wait(
					async () =>
						(await driver.getCurrentUrl()) ===
						`${origin}/experiments/elastictabs?input=hello`,
					5000
				);

				await driver.get(`${origin}/experiments`);

				const heading = await driver.findElement(By.css('h1'));
				expect(await heading.getText()).toBe('Experiments.');

				const list = await driver.findElement(
					By.css('ol[aria-label="Experiments"]')
				);
				const links = await list.findElements(By.css('a'));
				expect(
					await Promise.all(links.map(link => link.getText()))
				).toEqual([
					'Rays',
					'SVG Arena',
					'Platonic Stress',
					'Geometry of Music',
					'Elastic Tabstops',
					'Flag emoji',
					'Framing calculator',
					'Pitch Training',
					'Factorio',
					'Factorio blueprints',
					'Blueprint parser',
					'Requester chest generator',
					'Blueprint wall generator',
					'Blueprint book',
					'Cultist simulator',
				]);

				const menuButton = await driver.findElement(
					By.css('summary[aria-label="Open navigation menu"]')
				);
				await menuButton.click();
				const experimentMenuLinks = await driver.findElements(
					By.css(
						'nav[aria-label="Site navigation"] a[href^="/experiments"]'
					)
				);
				expect(
					await Promise.all(
						experimentMenuLinks.map(async link => ({
							href: await link.getAttribute('href'),
							text: await link.getText(),
						}))
					)
				).toEqual([
					{ href: `${origin}/experiments`, text: 'Experiments' },
				]);
				const omittedMenuLinks = await driver.findElements(
					By.css(
						'nav[aria-label="Site navigation"] a[href="/cv"], nav[aria-label="Site navigation"] a[href="/tool/elastictabs"]'
					)
				);
				expect(omittedMenuLinks).toHaveLength(0);
				await menuButton.click();

				await links[0]!.click();
				await driver.wait(
					async () =>
						(await driver.getCurrentUrl()) ===
						`${origin}/experiments/rays`,
					5000
				);
			} finally {
				await driver.quit();
			}
		});

		it('prerenders the Glade layout only for routes in its group', async () => {
			try {
				for (const path of ['/', '/article', '/2026/endings']) {
					const response = await fetch(`${origin}${path}`);
					expect(response.ok).toBe(true);
					const html = await response.text();
					expect(html.includes('data-glade-layout')).toBe(
						path !== '/2026/endings'
					);
				}
			} finally {
				await driver.quit();
			}
		});

		it.each([
			{ width: 1280, height: 900 },
			{ width: 390, height: 844 },
		])(
			'keeps Endings standalone and restores Glade on return at $width px',
			async size => {
				try {
					await driver.manage().setTimeouts({ implicit: 5000 });
					await driver.manage().window().setRect(size);
					await driver.get(`${origin}/2026/endings`);
					expect(
						await driver.findElements(
							By.css(
								'[data-glade-layout], nav[aria-label="Site navigation"], figure video'
							)
						)
					).toHaveLength(0);
					await driver.executeScript(
						'window.scrollTo(0, document.documentElement.scrollHeight);'
					);

					const backLink = await driver.findElement(
						By.css('a[aria-label="Back to homepage"]')
					);
					expect(await backLink.getText()).toBe('Back');

					await backLink.click();
					await driver.wait(
						async () =>
							(await driver.getCurrentUrl()) === `${origin}/`,
						5000
					);
					expect(
						await driver
							.findElement(By.css('figure video'))
							.isDisplayed()
					).toBe(true);
					expect(
						await driver.findElements(By.css('[data-glade-layout]'))
					).toHaveLength(1);
					await driver.navigate().back();
					await driver.wait(
						async () =>
							(await driver.getCurrentUrl()) ===
							`${origin}/2026/endings`,
						5000
					);
					expect(
						await driver.findElements(By.css('[data-glade-layout]'))
					).toHaveLength(0);
				} finally {
					await driver.quit();
				}
			}
		);
	});
});
