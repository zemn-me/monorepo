import Path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import glob from 'fast-glob';
import { Browser, By, Key, logging, ThenableWebDriver, until } from 'selenium-webdriver';
import type { Driver as ChromeDriver } from 'selenium-webdriver/chrome';

import { Driver } from '#root/ts/selenium/webdriver.js';

const resolveRunfilesPath = (candidate: string): string => {
	const workspace = process.env.TEST_WORKSPACE ?? 'monorepo';
	return runfiles.resolve(`${workspace}/${candidate}`);
};

const base = resolveRunfilesPath('project/me/zemn/build');

const pathsThatMayError = new Set(['healthcheck/bad', 'poc/c/', 'callback']);

describe('zemn.me website', () => {
	describe('Endpoint Tests', () => {
		let origin: string;
		let apiOrigin: string;
		let driver: ThenableWebDriver;
		const paths = glob
			.sync(Path.join(base, '/**/*.html'))
			.map(path =>
				Path.relative(base, path).replace(/index.html|.html$/g, '')
			);
		paths.push('journal', 'admin', 'callback', 'key', 'healthz');
		paths.sort();

		beforeAll(() => {
			const ports = JSON.parse(process.env['ASSIGNED_PORTS'] ?? '{}') as Record<
				string,
				string
			>;
			const serviceOrigin = (service: string): string => {
				const port = ports[service];
				if (!port) throw new Error(`Missing assigned port for ${service}`);
				return `http://localhost:${port}`;
			};
			origin = serviceOrigin(
				'@@//project/me/zemn:itest_service_calendar_fixture'
			);
			apiOrigin = serviceOrigin(
				'@@//project/me/zemn/api/cmd/localserver:localserver_calendar_fixture_itest_service'
			);
		});

		beforeEach(async () => {
			driver = Driver().forBrowser(Browser.CHROME).build();
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
			['America/Los_Angeles', '/'],
			['Asia/Tokyo', '/'],
			['America/Los_Angeles', '/article/2026/kasimir'],
			['Asia/Tokyo', '/article/2026/kasimir'],
		]) (
			'hydrates structured data in %s on %s',
			async (timezoneId, path) => {
				try {
					await (driver as unknown as ChromeDriver).sendDevToolsCommand('Emulation.setTimezoneOverride', { timezoneId });
					await driver.manage().setTimeouts({ implicit: 5000 });
					await driver.get(`${origin}${path}`);
					await driver.wait(async () =>
						(await driver.findElement(By.css('nav[aria-label="Site navigation"] button'))).isEnabled(),
						10000
					);
					const schema = await driver.findElement(By.css('script[type="application/ld+json"]'));
					expect(JSON.parse((await schema.getAttribute('textContent'))!)).toMatchObject({ '@type': path === '/' ? 'ProfilePage' : 'Article' });
					const logs = await driver.manage().logs().get('browser');
					expect(logs.filter(log => log.level.value >= logging.Level.SEVERE.value)).toEqual([]);
				} finally {
					await driver.quit();
				}
			}
		);

		it('blocks HTML and script injection without breaking text rendering', async () => {
			try {
				await driver.get(`${origin}/`);
				await driver.wait(async () =>
					(await driver.findElement(By.css('nav[aria-label="Site navigation"] button'))).isEnabled(),
					10000
				);
				expect(await driver.executeScript(`
					const rejected = operation => {
						try { operation(); return false; }
						catch (error) { return error instanceof TypeError; }
					};
					const element = document.createElement('div');
					element.textContent = '<b>plain text</b>';
					return {
						html: rejected(() => { element.innerHTML = '<b>HTML</b>'; }),
						htmlAfterScript: rejected(() => { element.innerHTML = '<script></script><b>HTML</b>'; }),
						jsonAsHtml: rejected(() => { element.innerHTML = '{"name":"JSON is data"}'; }),
						document: rejected(() => new DOMParser().parseFromString('<b>HTML</b>', 'text/html')),
						script: rejected(() => { document.createElement('script').text = 'alert(1)'; }),
						url: rejected(() => { document.createElement('script').src = '/injected.js'; }),
						policy: rejected(() => trustedTypes.createPolicy('bypass', { createHTML: value => value })),
						text: element.textContent,
						defaultPolicy: trustedTypes.defaultPolicy !== null,
					};
				`)).toEqual({ html: true, htmlAfterScript: true, jsonAsHtml: true, document: true, script: true, url: true, policy: true,
					text: '<b>plain text</b>', defaultPolicy: true });
			} finally {
				await driver.quit();
			}
		});

		it('initializes availability dates after hydration', async () => {
			try {
				const response = await fetch(`${origin}/availability`);
				const html = await response.text();
				// Prerendered dates can be stale before the document is served.
				expect(html).toContain('Loading your local calendar');
				await driver.get(`${origin}/availability`);
				await driver.wait(async () => {
					const headers = await driver.findElements(
						By.css('section[aria-label="Availability calendar"] header')
					);
					return headers.length === 63;
				}, 10000);
				const logs = await driver.manage().logs().get('browser');
				expect(logs.filter(log => log.level.value >= logging.Level.SEVERE.value)).toEqual([]);
			} finally {
				await driver.quit();
			}
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
				const schema = await driver.findElement(By.css('script[type="application/ld+json"]'));
				expect(JSON.parse((await schema.getAttribute('textContent'))!)).toMatchObject({
					'@type': 'Article',
					headline: 'Letter to Kasimir',
				});
				const logs = await driver.manage().logs().get('browser');
				expect(logs.filter(log => log.level.value >= logging.Level.SEVERE.value)).toEqual([]);
			} finally {
				await driver.quit();
			}
		});

		it('lists every experiment and draws a birthday chart from the index', async () => {
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
					'Star Chart',
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
					'Red Alert',
					'Command & Conquer',
					'Tiberian Sun',
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

				await list.findElement(By.linkText('Star Chart')).click();
				await driver.wait(
					async () =>
						(await driver.getCurrentUrl()) ===
						`${origin}/experiments/space-junk`,
					5000
				);
				const time = await driver.findElement(By.name('time'));
				const timestamp = () => time.getAttribute('value').then(Number);
				const sources = await driver.findElement(By.css('section[aria-labelledby="chart-sources"]'));
				expect(await sources.findElement(By.linkText('CC BY 4.0')).isDisplayed()).toBe(true);
				expect(await driver.findElements(By.css('article figcaption, summary#chart-birthplace'))).toHaveLength(0);
				await time.sendKeys(Key.ARROW_RIGHT);
				await driver.wait(async () => await timestamp() === Date.parse('2006-08-01T12:01:00.000Z'), 5000);
				await time.sendKeys(Key.ARROW_LEFT);

				const chrome = driver as unknown as ChromeDriver;
				const { x, y } = await driver.executeScript<{ x: number; y: number }>(`
					arguments[0].scrollIntoView({block: 'center'});
					const r = arguments[0].getBoundingClientRect();
					return {x: r.left + r.width / 2, y: r.top + r.height / 2};
				`, time);
				await chrome.sendDevToolsCommand('Emulation.setTouchEmulationEnabled', { enabled: true });
				const touch = (type: string, touchPoints: { x: number; y: number }[]) =>
					chrome.sendDevToolsCommand('Input.dispatchTouchEvent', { type, touchPoints });
				await touch('touchStart', [{ x, y }]);
				await touch('touchMove', [{ x: x - 20, y }]);
				await driver.wait(async () => await timestamp() > Date.parse('2006-08-01T12:00Z'), 5000);
				const firstMove = await timestamp();
				await touch('touchMove', [{ x: x - 40, y }]);
				await driver.wait(async () => await timestamp() > firstMove, 5000);
				const scrubbed = await timestamp();
				await touch('touchEnd', []);
				await chrome.sendDevToolsCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
				expect(await timestamp()).toBe(scrubbed);
				const scrollTop = () => driver.executeScript<number>('return window.scrollY');
				const beforeScroll = await scrollTop();
				await chrome.sendDevToolsCommand('Input.dispatchMouseEvent', {
					type: 'mouseWheel', x, y, deltaX: 0, deltaY: 120,
				});
				await driver.wait(async () => await scrollTop() > beforeScroll, 5000, 'Scrolling over the time ruler moves the page');
				expect(await timestamp()).toBe(scrubbed);
				const search = await driver.findElement(By.css('article input[aria-label^="Search by name"]'));
				expect(await search.getProperty('value')).toBe('spatula');
				const objects = await driver.findElements(By.css('ul[aria-label="Objects in orbit"] li'));
				expect(objects).toHaveLength(1);
				expect(await objects[0]!.getText()).toContain('EVA debris (spatula)');
				await driver.wait(until.elementLocated(By.css('svg [aria-label="Selected object · EVA debris (spatula)"]')), 10000);
				await search.sendKeys(Key.END, Key.BACK_SPACE.repeat('spatula'.length));
				expect(await driver.findElements(By.css('article details > summary')).then(items => Promise.all(items.map(item => item.getText())))).toEqual([]);
				expect(await driver.findElements(By.xpath('//button[.="Reset view"]'))).toHaveLength(0);
				const wheel = await driver.findElement(By.css('svg[aria-label^="Face-on zodiac wheel"]'));
				expect(await wheel.getText()).toContain('ARIES');
				const captions = () => wheel.findElements(By.css('textPath'));
				expect(await captions()).toHaveLength(12);
				const letterRotation = await driver.executeScript<number>(`
					const text = arguments[0];
					return Math.abs(text.getRotationOfChar(0) - text.getRotationOfChar(text.getNumberOfChars() - 1));
				`, (await captions())[0]);
				expect(letterRotation).toBeGreaterThan(3);
				const projection = (label: string) => driver.wait(async () =>
					(await wheel.getAttribute('aria-label'))?.includes(label), 5000, `Expected the camera to reach ${label}`);
				const initialRotation = await driver.findElement(By.xpath('//label[normalize-space(.)="Auto-rotate"]/input'));
				await initialRotation.sendKeys(Key.SPACE);
				expect(await initialRotation.isSelected()).toBe(false);
				const centre = await driver.executeScript<{ x: number; y: number; width: number }>(`
					arguments[0].scrollIntoView({block: 'center', behavior: 'instant'});
					const r = arguments[0].getBoundingClientRect();
					return {x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width};
				`, wheel);
				const mouse = (type: string, dy: number, buttons: number) =>
					chrome.sendDevToolsCommand('Input.dispatchMouseEvent', {
						type, x: centre.x, y: centre.y + dy, button: 'left', buttons, clickCount: 1,
					});
				// A fixed screen position stays meaningful throughout the uninterrupted drag.
				expect(await driver.findElements(By.css('button[aria-label="Earth orbits"],button[aria-label="Zodiac wheel"]'))).toHaveLength(0);
				const moonDot = await wheel.findElement(By.css('g[aria-label^="Moon ·"] circle'));
				const initialX = await moonDot.getAttribute('cx');
				const debrisLinks = () => wheel.findElements(By.css('g[aria-label="Selected object aspects and ascendant"] line title'))
					.then(lines => Promise.all(lines.map(line => line.getAttribute('textContent'))));
				await driver.wait(async () => (await debrisLinks()).length > 0, 10000);
				const wheelLinks = await debrisLinks();
				await mouse('mousePressed', 0, 1);
				await mouse('mouseMoved', 72, 1);
				await projection('Earth and orbital chart');
				await driver.wait(async () => await moonDot.getAttribute('cx') !== initialX, 5000);
				expect(await debrisLinks()).toEqual(wheelLinks);
				await mouse('mouseMoved', 0, 1);
				await mouse('mouseReleased', 0, 0);
				await projection('wheel from above');
				await driver.wait(async () => await moonDot.getAttribute('cx') === initialX, 5000);
				// Release on either side of the midpoint of the near-pole blend.
				for (const [fraction, endpoint] of [[0.04, 'wheel'], [0.105, 'globe']] as const) {
					const dy = Math.round(centre.width * fraction);
					await mouse('mousePressed', 0, 1);
					await mouse('mouseMoved', dy, 1);
					await projection('Earth and orbital chart');
					expect(await wheel.getText()).not.toContain('km');
					await mouse('mouseReleased', dy, 0);
					if (endpoint === 'wheel') {
						await projection('wheel from above');
						expect(await moonDot.getAttribute('cx')).toBe(initialX);
					} else {
						await driver.wait(async () => (await wheel.getText()).includes('km'), 5000);
					}
				}
				await wheel.sendKeys(Key.HOME);
				await wheel.sendKeys(Key.ARROW_DOWN.repeat(36));
				await projection('wheel from below');
				await wheel.sendKeys(Key.ARROW_UP);
				await projection('Earth and orbital chart');
				await wheel.sendKeys(Key.HOME);
				await projection('wheel from above');

				const tilt = await driver.findElement(By.css('input[type="range"][aria-label="Tilt"]'));
				const wheelX = await moonDot.getAttribute('cx');
				await tilt.sendKeys(Key.ARROW_LEFT);
				await projection('Earth and orbital chart');
				await projection('wheel from above');
				expect(await moonDot.getAttribute('cx')).toBe(wheelX);
				await wheel.sendKeys(Key.ARROW_DOWN.repeat(4));
				await driver.wait(async () => (await wheel.getText()).includes('km'), 5000,
					'Releasing twenty degrees from the pole settles into the full orbital view');
				expect(await tilt.getAttribute('value')).toBe('60');
				const scene = await driver.findElement(By.css('g[aria-label="Earth and orbiting objects"]'));
				const geometry = () => driver.executeScript<string>(`
					const visible = arguments[0].querySelectorAll('path[fill="#454545"]:not([display="none"])');
					return Array.from(visible, path => path.getAttribute('d')).join('');
				`, scene);

				const tiltTrack = await tilt.findElement(By.xpath('..'));
				const bands = await tiltTrack.findElements(By.css('g[pointer-events="none"] text'));
				expect(await Promise.all(bands.map(label => label.getProperty('textContent')))).toEqual(['Wheel', 'Orbit →', '← Orbit', 'Wheel']);
				await tiltTrack.findElement(By.xpath('.//*[local-name()="text" and .="45°"]')).click();
				await driver.wait(async () => await tilt.getAttribute('value') === '45', 5000);
				const original = await geometry();
				expect(original.length).toBeGreaterThan(0);
				await tilt.sendKeys(Key.ARROW_RIGHT);
				await driver.wait(async () => await geometry() !== original, 5000);
				await tilt.sendKeys(Key.ARROW_LEFT);
				await driver.wait(async () => await geometry() === original, 5000, 'Returning the tilt ruler restores the Earth grid');

				expect(await driver.findElement(By.css('ul[aria-label="Objects in orbit"]')).getText()).toContain(
					'12 July 2006 – 29 September 2006'
				);
				expect(await driver.findElement(By.css('article [aria-label="Catalogue results"]')).getText()).toMatch(/^1–12 of [\d,]+ orbiting objects$/);
				await driver.findElement(By.xpath('//button[.="Next"]')).click();
				expect(await driver.findElement(By.css('article [aria-label="Catalogue results"]')).getText()).toMatch(/^13–24 of [\d,]+ orbiting objects$/);
				await wheel.sendKeys(Key.HOME);
				await projection('wheel from above');
				const markerCount = () => driver.executeScript<number>(`
					const paths = arguments[0].querySelectorAll('g[aria-label="Earth and orbiting objects"] path');
					return Array.from(paths).filter(p => !p.closest('[display="none"]')).reduce((n, p) =>
						n + (p.getAttribute('d').match(/M/g) || []).length, 0);
				`, wheel);
				const unfiltered = await markerCount();
				await search.sendKeys('MoToR');
				const motors = await markerCount();
				expect(motors).toBeGreaterThan(12);
				expect(motors).toBeLessThan(unfiltered);
				await driver.findElement(By.xpath('//button[.="Next"]')).click();
				expect(await markerCount()).toBe(motors);
				await search.sendKeys('xyz');
				expect(await markerCount()).toBe(0);
				await search.sendKeys(Key.END, Key.BACK_SPACE.repeat(8));
				expect(await markerCount()).toBe(unfiltered);
				await search.sendKeys('1976-126V');
				expect(await driver.findElement(By.css('ul[aria-label="Objects in orbit"]')).getText()).toContain('NORAD 9724');
				expect(await markerCount()).toBe(1);

			} finally {
				await driver.quit();
			}
		});

		it('switches traditional bodies and debris independently on the wheel and globe', async () => {
			try {
				await driver.get(`${origin}/experiments/space-junk`);
				const toggle = (name: string) => driver.findElement(By.xpath(
					`//label[.//text()[normalize-space(.)="${name}"]]/input[@type="checkbox"]`
				));
				const bodies = () => driver.findElements(By.css('svg g[aria-label="Zodiac bodies"] g[role="img"]'));
				await driver.wait(async () => (await bodies()).length === 7, 5000);
				await (await toggle('Space junk')).click();
				expect((await bodies()).length).toBe(7);
				expect(await driver.findElements(By.css('ul[aria-label="Objects in orbit"]'))).toHaveLength(0);
				const moon = () => driver.findElement(By.css('svg g[aria-label^="Moon ·"]')).getAttribute('aria-label');
				const placements = () => driver.findElements(By.css('ul[aria-label="Natal placements"] li'));
				expect(await placements()).toHaveLength(7);
				const sun = (await placements())[0]!;
				expect(await sun.findElement(By.css('h3')).getAccessibleName()).toBe('Sun');
				expect(await sun.findElement(By.css('header > span')).getText()).toMatch(/^Leo \d+° \d+′ \d+″$/);
				const initial = await moon();
				await driver.findElement(By.name('day')).sendKeys(Key.ARROW_RIGHT);
				await driver.wait(async () => await moon() !== initial, 5000);
				const planets = await driver.findElement(By.css('div[role="group"][aria-label="Planetary bodies"]'));
				const switches = await planets.findElements(By.css('input[role="switch"]'));
				expect(switches).toHaveLength(10);
				const moonToggle = await toggle('Moon');
				expect(await moonToggle.getAccessibleName()).toBe('Moon');
				expect(await moonToggle.findElement(By.xpath('..')).getText()).toContain('☽');
				const zodiacGroup = await planets.findElement(By.css('[role="group"][aria-label="Zodiac"]'));
				expect(await zodiacGroup.findElements(By.css('input[role="switch"]'))).toHaveLength(7);
				expect(await Promise.all(switches.map(input => input.isDisplayed()))).not.toContain(false);
				expect(await driver.findElements(By.css('section[aria-labelledby="object-catalogue"] [aria-label="Man-made bodies"]'))).toHaveLength(1);
				await (await toggle('Moon')).click();
				expect(await bodies()).toHaveLength(6);
				expect(await placements()).toHaveLength(6);
				expect(await (await toggle('Zodiac')).getProperty('indeterminate')).toBe(true);
				await (await toggle('Zodiac')).click();
				expect(await bodies()).toHaveLength(7);
				await (await toggle('Pluto')).sendKeys(Key.SPACE);
				expect((await bodies()).length).toBe(8);
				const master = await toggle('Planetary bodies');
				expect(await master.getProperty('indeterminate')).toBe(true);
				await master.sendKeys(Key.SPACE);
				expect(await bodies()).toHaveLength(10);
				expect(await master.isSelected()).toBe(true);
				expect(await master.getProperty('indeterminate')).toBe(false);
				await master.sendKeys(Key.SPACE);
				expect(await bodies()).toHaveLength(0);
				expect(await master.isSelected()).toBe(false);
				expect(await master.getProperty('indeterminate')).toBe(false);
				await (await toggle('Zodiac')).sendKeys(Key.SPACE);
				expect(await bodies()).toHaveLength(7);
				expect(await master.getProperty('indeterminate')).toBe(true);
				await (await toggle('Pluto')).sendKeys(Key.SPACE);
				const wheelMoon = await moon();
				const globe = await driver.findElement(By.id('star-chart'));
				const signs = () => globe.findElements(By.css('g[aria-label="Zodiac signs"] textPath'));
				const captions = () => signs().then(all => Promise.all(all.map(sign => sign.getAttribute('textContent'))));
				const wheelCaptions = await captions();
				const planetLinks = () => globe.findElements(By.css('g[aria-label="Zodiac bodies"] > line title'))
					.then(lines => Promise.all(lines.map(line => line.getAttribute('textContent'))));
				const wheelLinks = await planetLinks();
				expect(wheelLinks.length).toBeGreaterThan(0);
				expect(wheelCaptions).toHaveLength(12);
				expect(wheelCaptions).toContain('SAGITTARIUS');
				await globe.sendKeys(Key.ARROW_DOWN.repeat(12));
				await driver.wait(async () => (await globe.getText()).includes('km'), 5000);
				expect(await captions()).toEqual(wheelCaptions);
				expect(await bodies()).toHaveLength(8);
				expect(await moon()).toBe(wheelMoon);
				const moonX = () => globe.findElement(By.css('g[aria-label^="Moon ·"] circle')).getAttribute('cx');
				const beforeTurn = await moonX();
				await globe.sendKeys(Key.ARROW_RIGHT);
				await driver.wait(async () => await moonX() !== beforeTurn, 5000);
				const zoom = await driver.findElement(By.css('input[type="range"][aria-label="Orbit view width"]'));
				expect(await zoom.getAttribute('value')).toBe('100');
				const zoomExtent = () => zoom.getAttribute('aria-valuetext');
				const close = await zoomExtent();
				expect(close).toBe('24,300 km across at Earth’s centre');
				const junk = await toggle('Space junk');
				await junk.sendKeys(Key.SPACE);
				expect(await zoomExtent()).toBe(close);
				await junk.sendKeys(Key.SPACE);
				expect(await zoomExtent()).toBe(close);
				const closeX = await moonX();
				await zoom.sendKeys(Key.HOME);
				await driver.wait(async () => await moonX() !== closeX, 5000);
				expect(await planetLinks()).toEqual(wheelLinks);
				const earth = await globe.findElement(By.css('g[aria-label="Earth"] text'));
				expect(await earth.getText()).toBe('⊕');
				const far = await zoomExtent();
				expect(far).toBe('153 AU across at Earth’s centre');
				const zodiac = await toggle('Zodiac');
				await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", zodiac);
				await zodiac.click();
				expect(await (await bodies())[0]!.getAttribute('aria-label')).toMatch(/^Pluto ·/);
				expect((await bodies()).length).toBe(1);
				expect(await signs()).toHaveLength(0);
				await (await toggle('Pluto')).click();
				expect(await bodies()).toHaveLength(0);
				expect(await zoomExtent()).toBe(far);
				expect(await earth.isDisplayed()).toBe(true);
				await zoom.sendKeys(Key.END);
				await driver.wait(async () => await zoomExtent() === close, 5000);
				await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", junk);
				await junk.click();
				expect(await bodies()).toHaveLength(0);
				await driver.findElement(By.css('button[aria-label="Choose man-made bodies"]')).click();
				await (await toggle('Space junk')).click();
				await (await toggle('Rocket stages')).click();
				expect(await (await toggle('Space junk')).getProperty('indeterminate')).toBe(true);
				const search = await driver.findElement(By.css('article input[aria-label^="Search by name"]'));
				await search.sendKeys(Key.END, Key.BACK_SPACE.repeat('spatula'.length));
				const catalogueRows = () => driver.findElements(By.css('ul[aria-label="Objects in orbit"] li'));
				const onlyKind = async (kind: string) => {
					const rows = await catalogueRows();
					return rows.length > 0 && (await Promise.all(rows.map(row => row.getText()))).every(text => text.includes(kind));
				};
				await driver.wait(() => onlyKind('Rocket stage'), 5000);
				await (await toggle('Spacecraft payloads')).sendKeys(Key.SPACE);
				await (await toggle('Space junk')).sendKeys(Key.SPACE);
				await (await toggle('Space junk')).sendKeys(Key.SPACE);
				expect(await (await toggle('Spacecraft payloads')).isSelected()).toBe(true);
				await driver.wait(() => onlyKind('Spacecraft payload'), 5000);
				await driver.wait(async () => (await driver.findElements(By.css('ul[aria-label="Objects in orbit"] a[href="#star-chart"]'))).length > 0, 10000);
				await globe.sendKeys(Key.HOME);
				expect(await bodies()).toHaveLength(0);
			} finally {
				await driver.quit();
			}
		});

		it('rotates the idle wheel and Earth and respects the rotation and reduced-motion controls', async () => {
			try {
				await driver.get(`${origin}/experiments/space-junk`);
				await driver.findElement(By.xpath('//label[normalize-space(.)="Space junk"]/input')).click();
				const globe = await driver.findElement(By.id('star-chart'));
				await globe.sendKeys(Key.ARROW_DOWN.repeat(12));
				await driver.wait(async () => (await globe.getText()).includes('km'), 5000);
				const rotation = await driver.findElement(By.css('input[type="range"][aria-label="Rotation"]'));
				const spin = await driver.findElement(By.xpath('//label[normalize-space(.)="Auto-rotate"]/input'));
				const angle = () => rotation.getAttribute('value');
				const time = await driver.findElement(By.name('time'));
				const birthday = await time.getAttribute('value');
				const initial = await angle();
				await driver.wait(async () => await angle() !== initial, 5000);
				await spin.click();
				const stopped = await angle();
				const chrome = driver as unknown as ChromeDriver;
				const reducedMotion = (value: string) => chrome.sendDevToolsCommand('Emulation.setEmulatedMedia', {
					features: [{name: 'prefers-reduced-motion', value}],
				});
				await driver.sleep(800);
				expect(await angle()).toBe(stopped);
				await spin.click();
				await reducedMotion('reduce');
				const reduced = await angle();
				// At three degrees per second this spans more than two visible degree ticks.
				await driver.sleep(800);
				expect(await angle()).toBe(reduced);
				await reducedMotion('no-preference');
				await driver.wait(async () => await angle() !== reduced, 5000);
				expect(await time.getAttribute('value')).toBe(birthday);
				await globe.sendKeys(Key.HOME);
				await driver.wait(async () => (await globe.getAttribute('aria-label'))?.includes('wheel from above'), 5000);
				const moon = await globe.findElement(By.css('g[aria-label^="Moon ·"] circle'));
				const wheelX = await moon.getAttribute('cx');
				await driver.wait(async () => await moon.getAttribute('cx') !== wheelX, 5000, 'The face-on wheel rotates while idle');
			} finally {
				await driver.quit();
			}
		});

		it('restores a shared Star Chart and saves edits to the same URL', async () => {
			try {
				const params = new URLSearchParams({
					time: '2006-08-01T04:15:16.789Z', city: '1880252', bodies: 'Sun,Pluto',
					kinds: 'C,R', q: 'motor', rotation: '-32', tilt: '12', zoom: '80', spin: 'false',
				});
				await driver.get(`${origin}/experiments/space-junk?${params}#star-chart`);
				const field = (label: string) => driver.findElement(By.css(`input[aria-label="${label}"]`));
				const city = await driver.findElement(By.css('input[role="combobox"]'));
				await driver.wait(async () => (await city.getAttribute('value'))?.includes('Singapore'), 10000);
				const time = await driver.findElement(By.name('time'));
				expect(await time.getAttribute('aria-valuetext')).toContain('12:15:16');
				expect(await time.getAttribute('value')).toBe(String(Date.parse(params.get('time')!)));
				const placements = () => driver.findElements(By.css('ul[aria-label="Natal placements"] h3')).then(headings => Promise.all(headings.map(h => h.getText())));
				expect((await placements()).join(' ')).toMatch(/Sun.*Pluto.*Rising sign/);
				expect(await placements()).toHaveLength(3);
				for (const [label, value] of [['Rotation', '-32'], ['Tilt', '12'], ['Orbit view width', '80']] as const)
					expect(await (await field(label)).getAttribute('value')).toBe(value);
				const search = await driver.wait(until.elementLocated(By.css('article input[aria-label^="Search by name"]')), 10000);
				expect(await search.getAttribute('value')).toBe('motor');
				await search.clear();
				await search.sendKeys('spat');
				await (await field('Rotation')).sendKeys(Key.ARROW_RIGHT);
				await driver.wait(async () => {
					const url = new URL(await driver.getCurrentUrl());
					return url.searchParams.get('q') === 'spat' && url.searchParams.get('rotation') === '-31' && url.hash === '#star-chart';
				}, 5000);
				await driver.navigate().refresh();
				expect(await (await field('Rotation')).getAttribute('value')).toBe('-31');
				expect(await (await driver.wait(until.elementLocated(By.css('article input[aria-label^="Search by name"]')), 10000)).getAttribute('value')).toBe('spat');
			} finally {
				await driver.quit();
			}
		});

		it('pins the birthplace to the visible surface of Earth as the globe turns', async () => {
			try {
				await (driver as unknown as ChromeDriver).sendDevToolsCommand('Emulation.setEmulatedMedia', {
					features: [{name: 'prefers-reduced-motion', value: 'reduce'}],
				});
				await driver.get(`${origin}/experiments/space-junk`);
				const globe = await driver.findElement(By.id('star-chart'));
				await globe.sendKeys(Key.ARROW_DOWN.repeat(12));
				await driver.wait(async () => (await globe.getText()).includes('km'), 5000);
				const pin = By.css('g[role="img"][aria-label^="Birthplace ·"] > line:last-of-type');
				expect(await globe.findElements(pin)).toHaveLength(0);
				const birthplace = await driver.findElement(By.css('input[role="combobox"]'));
				await birthplace.sendKeys('Singapore');
				await (await driver.wait(until.elementLocated(By.css('[role="listbox"] [role="option"]')), 10000)).click();
				const marker = await driver.wait(until.elementLocated(pin), 5000);
				const natal = await driver.findElement(By.css('ul[aria-label="Natal placements"]'));
				const rising = await natal.findElement(By.xpath('.//li[.//h3[.="Rising sign"]]'));
				expect(await rising.getText()).toMatch(/\w+ \d+° \d+′ \d+″ · House 1\b/);
				const center = Number(await marker.getAttribute('x1'));
				expect(await driver.executeScript<number>('return arguments[0].getTotalLength()', marker)).toBeLessThan(0.1);
				await globe.sendKeys(Key.ARROW_RIGHT.repeat(4));
				await driver.wait(async () => Number(await marker.getAttribute('x1')) < center, 5000);
				const segments = await driver.executeScript<{ along: number; across: number }[]>(`
					const tip = arguments[0], box = tip.ownerSVGElement.viewBox.baseVal;
					const rx = tip.x1.baseVal.value - box.width / 2;
					const ry = tip.y1.baseVal.value - box.height / 2;
					const r = Math.hypot(rx, ry);
					return Array.from(tip.parentElement.querySelectorAll('line'), line => {
						const dx = line.x2.baseVal.value - line.x1.baseVal.value;
						const dy = line.y2.baseVal.value - line.y1.baseVal.value;
						return { along: (rx * dx + ry * dy) / r, across: (rx * dy - ry * dx) / r };
					});
				`, marker);
				expect(segments).toHaveLength(2);
				expect(segments[0]!.along).toBeLessThan(-1);
				expect(segments[1]!.along).toBeGreaterThan(1);
				for (const segment of segments) expect(Math.abs(segment.across)).toBeLessThan(0.01);
				await globe.sendKeys(Key.ARROW_RIGHT.repeat(20));
				await driver.wait(async () => (await globe.findElements(pin)).length === 0, 5000);
				await globe.sendKeys(Key.ARROW_LEFT.repeat(24));
				await driver.wait(async () => (await globe.findElements(pin)).length > 0 && Math.abs(Number(await globe.findElement(pin).getAttribute('x1')) - center) < 0.01, 5000);
				await birthplace.sendKeys(Key.END, Key.BACK_SPACE.repeat('Singapore'.length));
				await driver.wait(async () => !(await globe.findElements(pin)).length, 5000, 'The marker should disappear when the birth city is cleared');
			} finally {
				await driver.quit();
			}
		});

		it('uses local midnight for the day ruler before a birth city is chosen', async () => {
			try {
				await (driver as unknown as ChromeDriver).sendDevToolsCommand('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Kathmandu' });
				await driver.get(`${origin}/experiments/space-junk`);
				const city = await driver.findElement(By.css('input[role="combobox"]'));
				expect(await city.getAccessibleName()).toBe('City of birth');
				const clock = await driver.findElement(By.name('time'));
				await driver.wait(async () => (await clock.getAttribute('aria-valuetext'))?.includes('17:45:00'), 5000);
				const midnight = await driver.findElement(By.xpath('//fieldset//*[local-name()="text" and .="1"]'));
				await midnight.click();
				await driver.wait(async () => Number(await clock.getAttribute('value')) === Date.parse('2006-07-31T18:15:00.000Z'), 5000);
				expect(await clock.getAttribute('aria-valuetext')).toContain('00:00:00');
			} finally {
				await driver.quit();
			}
		});

		it('serves numeric month ticks before localizing them in the browser', async () => {
			try {
				const chrome = driver as unknown as ChromeDriver;
				await chrome.sendDevToolsCommand('Emulation.setScriptExecutionDisabled', { value: true });
				await driver.get(`${origin}/experiments/space-junk`);
				const ticks = By.css('input[name="month"] + svg text');
				const labels = async () => Promise.all((await driver.findElements(ticks)).map(tick => tick.getProperty('textContent')));
				const initial = await labels();
				expect(initial).toContain('9');
				expect(initial.every(label => /^\d+$/.test(label))).toBe(true);
				await chrome.sendDevToolsCommand('Emulation.setScriptExecutionDisabled', { value: false });
				await driver.navigate().refresh();
				const september = await driver.executeScript<string>(`
					return new Intl.DateTimeFormat(navigator.languages, {calendar:'gregory', month:'short', timeZone:'UTC'})
						.format(Date.UTC(2000, 8, 1));
				`);
				await driver.wait(async () => (await labels()).includes(september), 5000);
			} finally {
				await driver.quit();
			}
		});

		it.each([
			['en-US', 'August'],
			['en-GB', 'August'],
			['ja-JP', '8月'],
		])('scrubs the birthday rulers in %s', async (locale, monthName) => {
			try {
				await (driver as unknown as ChromeDriver).sendDevToolsCommand('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
				await (driver as unknown as ChromeDriver).sendDevToolsCommand('Network.setUserAgentOverride', {
					userAgent: await driver.executeScript<string>('return navigator.userAgent'),
					acceptLanguage: locale,
				});
				await driver.get(`${origin}/experiments/space-junk`);
				await driver.wait(async () => (await driver.findElements(By.css('fieldset input[type="range"]'))).length === 4, 5000);
				const rulers = await driver.findElements(By.css('fieldset input[type="range"]'));
				expect(await Promise.all(rulers.map(r => r.getAttribute('name')))).toEqual(['year', 'month', 'day', 'time']);
				const month = await driver.findElement(By.name('month'));
				await driver.wait(async () => (await month.getAttribute('aria-valuetext'))?.includes(monthName), 5000);
				const day = await driver.findElement(By.name('day'));
				const clock = await driver.findElement(By.name('time'));
				const readings = () => Promise.all(rulers.map(r => r.getAttribute('value').then(Number)));
				const waitForRulers = (instant: number) => driver.wait(
					async () => (await readings()).every(t => t === instant),
					5000, `Waiting for all four rulers to show ${new Date(instant).toISOString()}`
				);
				await day.sendKeys(Key.ARROW_LEFT);
				const july = Date.parse('2006-07-31T12:00Z');
				await waitForRulers(july);
				await day.sendKeys(Key.ARROW_RIGHT);
				await waitForRulers(Date.parse('2006-08-01T12:00Z'));
				const midnight = await driver.findElement(By.xpath('//*[local-name()="fieldset"]//*[local-name()="text" and .="1"]'));
				await midnight.click();
				await clock.sendKeys(Key.ARROW_LEFT);
				const end = Date.parse('2006-07-31T23:59Z');
				await waitForRulers(end);

				const yearMark = (n: number) => driver.findElement(By.xpath(
					`//fieldset//*[local-name()="text" and .="${n}"]`
				));
				await yearMark(2006).click();
				await waitForRulers(Date.parse('2006-01-01T00:00Z'));
				const year = await driver.findElement(By.name('year'));
				const start = await yearMark(2006).getRect();
				const next = await yearMark(2007).getRect();
				const halfYear = Math.round((next.x - start.x) / 2);
				await driver.actions().move({ origin: year }).press()
					.move({ origin: year, x: -halfYear, y: 0 }).perform();
				const midyear = Date.parse('2006-07-01T00:00Z');
				await waitForRulers(midyear);
				await driver.actions().release().perform();
				expect(await readings()).toEqual([midyear, midyear, midyear, midyear]);
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
