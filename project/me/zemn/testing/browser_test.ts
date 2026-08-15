import { ChildProcess, spawn } from 'node:child_process';
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
		paths.sort();

		beforeAll(async () => {
			server = http
				.createServer((rq, rw) => {
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

		it('typing dream opens the Mansus card table and returns with a memory', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 1000 });
				await driver.get(`${origin}/`);
				await driver.findElement(By.css('body')).sendKeys('dream');

				const dialog = await driver.wait(
					until.elementLocated(
						By.css('[role="dialog"][aria-label="Dreaming"]')
					),
					5000
				);
				await driver.wait(async () => {
					const headings = await dialog.findElements(By.css('h1'));
					return (
						headings.length === 1 &&
						(await headings[0]!.getText()) === 'The table of dreams'
					);
				}, 3000);

				await dialog
					.findElement(
						By.css('button[aria-label="Place Passion in Dream"]')
					)
					.click();
				const dreamButton = await dialog.findElement(
					By.xpath(
						'.//button[normalize-space()="Dream with Passion"]'
					)
				);
				await driver.wait(() => dreamButton.isEnabled(), 3000);
				expect(
					await dialog
						.findElement(By.css('[aria-label="Dream card slot"]'))
						.getText()
				).toContain('Passion');
				await dreamButton.click();

				const mansus = await driver.wait(
					until.elementLocated(
						By.css('[role="region"][aria-label="The Mansus"]')
					),
					6000
				);
				const mansusHeading = await mansus.findElement(By.css('h2'));
				await driver.wait(
					until.elementTextIs(
						mansusHeading,
						'The Mansus has no walls.'
					),
					3000
				);
				const choices = await mansus.findElements(
					By.css('button[aria-label^="Draw Mansus card"]')
				);
				expect(choices).toHaveLength(3);
				await choices[0]!.click();

				const drawnCard = await driver.wait(
					until.elementLocated(
						By.css('article[aria-label="Drawn card"]')
					),
					3000
				);
				await driver.wait(
					until.elementTextContains(drawnCard, 'A Pale Passage'),
					3000
				);
				expect(await drawnCard.getText()).toContain('A Pale Passage');
				await mansus
					.findElement(
						By.xpath(
							'.//button[normalize-space()="Keep this memory and return"]'
						)
					)
					.click();

				await driver.wait(async () => {
					const counters = await dialog.findElements(
						By.xpath(
							'.//*[normalize-space()="Memories carried back: 1"]'
						)
					);
					return counters.length === 1;
				}, 3000);
				await dialog
					.findElement(
						By.xpath('.//button[normalize-space()="Wake"]')
					)
					.click();
				await driver.wait(
					async () =>
						(
							await driver.findElements(
								By.css('[role="dialog"][aria-label="Dreaming"]')
							)
						).length === 0,
					3000
				);
				expect(
					await driver
						.findElement(
							By.css('img[alt="Thomas Neil James Shadwell"]')
						)
						.isDisplayed()
				).toBe(true);
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
					By.css('nav[aria-label="Site navigation"] a[href^="/article"]')
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
				expect(await Promise.all(links.map(link => link.getText()))).toEqual([
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
				expect(await Promise.all(links.map(link => link.getText()))).toEqual([
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
				).toEqual([{ href: `${origin}/experiments`, text: 'Experiments' }]);
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
						(await driver.getCurrentUrl()) === `${origin}/experiments/rays`,
					5000
				);
			} finally {
				await driver.quit();
			}
		});

		it('2026/endings shows a homepage back link after the story text renders', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/2026/endings`);
				await driver.executeScript(
					'window.scrollTo(0, document.documentElement.scrollHeight);'
				);

				const backLink = await driver.findElement(
					By.css('a[aria-label="Back to homepage"]')
				);
				expect(await backLink.getText()).toBe('Back');

				await backLink.click();
				await driver.wait(
					async () => (await driver.getCurrentUrl()) === `${origin}/`,
					5000
				);
			} finally {
				await driver.quit();
			}
		});
	});
});
