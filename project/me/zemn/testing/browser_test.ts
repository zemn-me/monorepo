import Path from 'node:path';

import { runfiles } from '@bazel/runfiles';
import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import glob from 'fast-glob';
import { Browser, By, Key, logging, ThenableWebDriver } from 'selenium-webdriver';
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
				const chartTime = () => driver.findElement(By.css('figcaption time')).getAttribute('datetime');
				await time.sendKeys(Key.ARROW_RIGHT);
				await driver.wait(async () => await chartTime() === '2006-08-01T12:01:00.000Z', 5000);
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
				const timestamp = () => time.getAttribute('value').then(Number);
				await driver.wait(async () => await timestamp() > Date.parse('2006-08-01T12:00Z'), 5000);
				const firstMove = await timestamp();
				await touch('touchMove', [{ x: x - 40, y }]);
				await driver.wait(async () => await timestamp() > firstMove, 5000);
				const scrubbed = await timestamp();
				await driver.wait(async () => await chartTime() === new Date(scrubbed).toISOString(), 5000);
				await touch('touchEnd', []);
				await chrome.sendDevToolsCommand('Emulation.setTouchEmulationEnabled', { enabled: false });
				expect(await timestamp()).toBe(scrubbed);
				expect(await driver.findElement(By.css('article input[type="search"]')).isDisplayed()).toBe(false);
				const wheel = await driver.findElement(By.css('svg[aria-label^="Face-on zodiac wheel"]'));
				expect(await wheel.getText()).toContain('ARIES');
				const captions = () => wheel.findElements(By.css('textPath'));
				expect(await captions()).toHaveLength(12);
				const letterRotation = await driver.executeScript<number>(`
					const text = arguments[0];
					return Math.abs(text.getRotationOfChar(0) - text.getRotationOfChar(text.getNumberOfChars() - 1));
				`, (await captions())[0]);
				expect(letterRotation).toBeGreaterThan(3);
				await driver.findElement(By.xpath('//button[.="Explore in 3D"]')).click();
				expect(await wheel.getAttribute('aria-label')).toContain('3D zodiac sky');
				expect(await driver.findElements(By.xpath('//button[.="Pan" or .="Return to wheel"]'))).toHaveLength(0);
				await wheel.sendKeys(Key.ARROW_UP.repeat(10));
				expect(await wheel.getAttribute('aria-label')).toContain('wheel from above');
				await wheel.sendKeys(Key.ARROW_DOWN.repeat(36));
				expect(await wheel.getAttribute('aria-label')).toContain('wheel from below');
				expect(await captions()).toHaveLength(12);
				await wheel.sendKeys(Key.ARROW_UP);
				expect(await wheel.getAttribute('aria-label')).toContain('3D zodiac sky');
				const earthView = await driver.findElement(By.css('button[aria-label="Earth orbits"]'));
				await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", earthView);
				await earthView.click();
				await driver.findElement(By.xpath('//summary[.="View controls"]')).click();
				const tilt = await driver.findElement(By.xpath('//label[normalize-space(.)="Tilt"]/input'));
				const scene = await driver.findElement(By.css('g[aria-label="Earth and orbiting debris"]'));
				const geometry = () => scene.findElements(By.css('path')).then(async paths =>
					(await Promise.all(paths.slice(0, 6).map(path => path.getAttribute('d')))).join('')
				);
				const original = await geometry();
				expect(original.length).toBeGreaterThan(0);
				await tilt.sendKeys(Key.ARROW_RIGHT);
				expect(await geometry()).not.toBe(original);
				await driver.findElement(By.xpath('//button[.="Reset view"]')).click();
				expect(await geometry()).toBe(original);

				await driver.findElement(By.xpath('//summary[.="Object catalogue"]')).click();
				expect(await driver.findElement(By.css('article ul')).getText()).toContain(
					'12 July 2006 – 29 September 2006'
				);
				expect(await driver.findElement(By.css('article [aria-label="Catalogue results"]')).getText()).toContain('1–12 of 6,989');
				await driver.findElement(By.xpath('//button[.="Next"]')).click();
				expect(await driver.findElement(By.css('article [aria-label="Catalogue results"]')).getText()).toContain('13–24 of 6,989');
				await driver.findElement(By.css('article input[type="search"]')).sendKeys('1976-126V');
				expect(await driver.findElement(By.css('article ul')).getText()).toContain('NORAD 9724');

			} finally {
				await driver.quit();
			}
		});

		it('switches traditional bodies and debris independently on the wheel and globe', async () => {
			try {
				await driver.get(`${origin}/experiments/space-junk`);
				const toggle = (name: string) => driver.findElement(By.xpath(
					`//label[normalize-space(.)="${name}"]/input[@role="switch"]`
				));
				const bodies = () => driver.findElements(By.css('svg g[aria-label="Zodiac bodies"] g[role="img"]'));
				await driver.wait(async () => (await bodies()).length === 7, 5000);
				await (await toggle('Space junk')).click();
				expect((await bodies()).length).toBe(7);
				expect(await driver.findElements(By.css('[aria-label="Chart coverage"]'))).toHaveLength(0);
				const moon = () => driver.findElement(By.css('svg g[aria-label^="Moon ·"]')).getAttribute('aria-label');
				const initial = await moon();
				await driver.findElement(By.name('day')).sendKeys(Key.ARROW_RIGHT);
				await driver.wait(async () => await moon() !== initial, 5000);
				await driver.findElement(By.css('button[aria-label="More bodies"]')).click();
				await (await toggle('Pluto')).sendKeys(Key.SPACE);
				expect((await bodies()).length).toBe(8);
				const wheelMoon = await moon();
				await driver.findElement(By.css('button[aria-label="Earth orbits"]')).click();
				const globe = await driver.findElement(By.id('orbital-globe'));
				const signs = () => globe.findElements(By.css('g[aria-label="Zodiac signs"] textPath'));
				expect(await signs()).toHaveLength(12);
				expect(await bodies()).toHaveLength(8);
				expect(await moon()).toBe(wheelMoon);
				const moonX = () => globe.findElement(By.css('g[aria-label^="Moon ·"] circle')).getAttribute('cx');
				const beforeTurn = await moonX();
				await globe.sendKeys(Key.ARROW_RIGHT);
				expect(await moonX()).not.toBe(beforeTurn);
				const zodiac = await toggle('Zodiac');
				await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", zodiac);
				await zodiac.click();
				expect(await (await bodies())[0]!.getAttribute('aria-label')).toMatch(/^Pluto ·/);
				expect((await bodies()).length).toBe(1);
				expect(await signs()).toHaveLength(0);
				await (await toggle('Pluto')).click();
				expect(await bodies()).toHaveLength(0);
				await (await toggle('Space junk')).click();
				expect(await bodies()).toHaveLength(0);
				await driver.findElement(By.css('button[aria-label="Zodiac wheel"]')).click();
				expect(await bodies()).toHaveLength(0);
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
				await day.sendKeys(Key.ARROW_LEFT);
				const july = Date.parse('2006-07-31T12:00Z');
				expect(await readings()).toEqual([july, july, july, july]);
				await day.sendKeys(Key.ARROW_RIGHT);
				const midnight = await driver.findElement(By.xpath('//*[local-name()="fieldset"]//*[local-name()="text" and .="1"]'));
				await midnight.click();
				await clock.sendKeys(Key.ARROW_LEFT);
				const end = Date.parse('2006-07-31T23:59Z');
				expect(await readings()).toEqual([end, end, end, end]);
				await driver.wait(async () =>
					(await driver.findElement(By.css('figcaption time')).getAttribute('datetime')) === new Date(end).toISOString(), 5000);

				const yearMark = (n: number) => driver.findElement(By.xpath(
					`//fieldset//*[local-name()="text" and .="${n}"]`
				));
				await yearMark(2006).click();
				const year = await driver.findElement(By.name('year'));
				const start = await yearMark(2006).getRect();
				const next = await yearMark(2007).getRect();
				const halfYear = Math.round((next.x - start.x) / 2);
				await driver.actions().move({ origin: year }).press()
					.move({ origin: year, x: -halfYear, y: 0 }).perform();
				const midyear = Date.parse('2006-07-01T00:00Z');
				await driver.wait(async () => (await readings()).every(t => t === midyear), 5000);
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
