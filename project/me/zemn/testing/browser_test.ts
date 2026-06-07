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
import { Browser, By, ThenableWebDriver } from 'selenium-webdriver';
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

		it('availability shows a 5am ruler with a current-time marker', async () => {
			try {
				await driver.manage().setTimeouts({ implicit: 5000 });
				await driver.get(`${origin}/availability`);

				const firstRulerLabel = await driver.findElement(
					By.css('[data-availability-ruler-label]')
				);
				const expectedFirstRulerLabel = (await driver.executeScript(`
					const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
					const locales = [
						intlLocale,
						...navigator.languages.filter(locale => locale !== intlLocale),
					].filter(locale => locale !== '');
					const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
					return new Intl.DateTimeFormat(locales, {
						hour: 'numeric',
						minute: '2-digit',
						timeZone,
					}).format(new Date(2020, 0, 1, 5, 0));
				`)) as string;
				const marker = await driver.findElement(
					By.css('[data-availability-current-time-marker]')
				);
				const currentMinute = Number(
					await marker.getAttribute('data-availability-current-minute')
				);
				const expectedMinute = (await driver.executeScript(`
					const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
					const parts = new Intl.DateTimeFormat('en-GB', {
						hour: '2-digit',
						hour12: false,
						hourCycle: 'h23',
						minute: '2-digit',
						timeZone,
					}).formatToParts(new Date());
					const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
					const wallMinute = (Number(byType.hour) % 24) * 60 + Number(byType.minute);
					return (wallMinute - 5 * 60 + 1440) % 1440;
				`)) as number;
				const minuteDelta = Math.abs(currentMinute - expectedMinute);
				const wrappedMinuteDelta = Math.min(
					minuteDelta,
					1440 - minuteDelta
				);

				expect(await firstRulerLabel.getText()).toBe(
					expectedFirstRulerLabel
				);
				const rulerGeometry = (await driver.executeScript(`
					const week = document.querySelector('[aria-label="Availability calendar"]');
					const labels = document.querySelectorAll('[data-availability-ruler-label]');
					if (!(week instanceof HTMLElement) || labels.length < 5) {
						throw new Error('availability ruler geometry unavailable');
					}

					const probe = document.createElement('div');
					probe.style.position = 'absolute';
					probe.style.height = getComputedStyle(week).getPropertyValue('--hour-height');
					document.body.append(probe);
					const hourHeight = probe.getBoundingClientRect().height;
					probe.remove();

					return {
						actualFourHourDelta: labels[4].getBoundingClientRect().top - labels[0].getBoundingClientRect().top,
						expectedFourHourDelta: hourHeight * 4,
					};
				`)) as {
					actualFourHourDelta: number;
					expectedFourHourDelta: number;
				};
				expect(
					Math.abs(
						rulerGeometry.actualFourHourDelta -
							rulerGeometry.expectedFourHourDelta
					)
				).toBeLessThanOrEqual(1);
				const lineGeometry = (await driver.executeScript(`
					const rulerLane = document.querySelector('[data-availability-ruler-lane]');
					const dayLane = document.querySelector('[data-availability-day-lane]');
					const dayHalfHourLine = document.querySelector('[data-availability-day-half-hour-line]');
					const hourLines = document.querySelectorAll('[data-availability-day-hour-line]');
					const rulerHalfHourTick = document.querySelector('[data-availability-ruler-half-hour-tick]');
					if (
						!(rulerLane instanceof HTMLElement) ||
						!(dayLane instanceof HTMLElement) ||
						!(dayHalfHourLine instanceof HTMLElement) ||
						!(rulerHalfHourTick instanceof HTMLElement) ||
						hourLines.length < 5
					) {
						throw new Error('availability line geometry unavailable');
					}
					const dayLaneStyle = getComputedStyle(dayLane);
					const dayHalfHourLineStyle = getComputedStyle(dayHalfHourLine);
					const rulerHalfHourTickStyle = getComputedStyle(rulerHalfHourTick);

					return {
						actualFourHourDelta: hourLines[4].getBoundingClientRect().top - hourLines[0].getBoundingClientRect().top,
						dayLaneBackgroundImage: getComputedStyle(dayLane).backgroundImage,
						dayLaneBorderLeftStyle: dayLaneStyle.borderLeftStyle,
						dayLaneBorderLeftWidth: dayLaneStyle.borderLeftWidth,
						dayHalfHourBorderTopStyle: dayHalfHourLineStyle.borderTopStyle,
						rulerLaneBackgroundImage: getComputedStyle(rulerLane).backgroundImage,
						rulerHalfHourBorderTopStyle: rulerHalfHourTickStyle.borderTopStyle,
					};
				`)) as {
					actualFourHourDelta: number;
					dayLaneBackgroundImage: string;
					dayLaneBorderLeftStyle: string;
					dayLaneBorderLeftWidth: string;
					dayHalfHourBorderTopStyle: string;
					rulerLaneBackgroundImage: string;
					rulerHalfHourBorderTopStyle: string;
				};
				expect(lineGeometry.dayLaneBackgroundImage).toBe('none');
				expect(lineGeometry.dayLaneBorderLeftStyle).toBe('solid');
				expect(lineGeometry.dayLaneBorderLeftWidth).not.toBe('0px');
				expect(lineGeometry.dayHalfHourBorderTopStyle).toBe('dotted');
				expect(lineGeometry.rulerLaneBackgroundImage).toBe('none');
				expect(lineGeometry.rulerHalfHourBorderTopStyle).toBe('dotted');
				expect(
					Math.abs(
						lineGeometry.actualFourHourDelta -
							rulerGeometry.expectedFourHourDelta
					)
				).toBeLessThanOrEqual(1);
				expect(Number.isFinite(currentMinute)).toBe(true);
				expect(wrappedMinuteDelta).toBeLessThanOrEqual(1);
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
