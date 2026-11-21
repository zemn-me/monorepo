import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@jest/globals';
import { By, type ThenableWebDriver } from 'selenium-webdriver';

export async function testDoomArena(driver: ThenableWebDriver, origin: string) {
	await driver.manage().setTimeouts({ implicit: 5000 });
	await driver.get(`${origin}/experiments/arena`);
	const svg = await driver.findElement(
		By.css('svg[aria-label="Doom E1M1 mesh"]')
	);
	const paths = () => svg.findElements(By.css('path:not([display="none"])'));
	const geometry = () =>
		driver.executeScript<string>(
			`return Array.from(arguments[0].querySelectorAll('path:not([display="none"])')).map(path => path.getAttribute("d")).join("");`,
			svg
		);
	await driver.wait(async () => (await paths()).length > 0, 10000);
	await driver.wait(
		async () =>
			await driver.executeScript(
				'return arguments[0].viewBox.baseVal.width === arguments[0].clientWidth;',
				svg
			),
		10000
	);
	const output = process.env.TEST_UNDECLARED_OUTPUTS_DIR;
	const overview = await geometry();
	expect(overview.length).toBeGreaterThan(10000);
	await driver
		.actions()
		.move({ origin: svg })
		.press()
		.move({ origin: svg, x: 100, y: 40, duration: 300 })
		.release()
		.perform();
	await driver.wait(
		async () => (await geometry()) !== overview,
		5000,
		'orbit changes the mesh'
	);
	const orbited = await geometry();
	await driver
		.findElement(By.xpath('//button[text()="Walk around"]'))
		.click();
	await driver.wait(
		async () => (await geometry()) !== orbited,
		5000,
		'walking starts at the player position'
	);
	await driver.wait(async () => (await paths()).length > 0, 5000);
	expect(
		(
			await svg.findElements(
				By.css('pattern image[href^="data:image/png"]')
			)
		).length
	).toBeGreaterThan(0);
	expect(await driver.findElements(By.css('canvas'))).toHaveLength(0);
	const start = await geometry();
	expect(start).not.toBe(overview);
	await driver.actions().keyDown('w').pause(300).keyUp('w').perform();
	await driver.wait(
		async () => (await geometry()) !== start,
		5000,
		'W moves the camera'
	);
	await driver.actions().keyDown('w').perform();
	let wall = await geometry();
	try {
		await driver.wait(
			async () => {
				await driver.actions().pause(500).perform();
				const current = await geometry();
				const stopped = current === wall;
				wall = current;
				return stopped;
			},
			30000,
			'walking stops at a solid wall'
		);
	} finally {
		await driver.actions().keyUp('w').perform();
	}
	await driver.actions().keyDown('w').pause(500).keyUp('w').perform();
	expect((await geometry()) === wall).toBe(true);
	await driver.findElement(By.xpath('//button[text()="Reset"]')).click();
	await driver.wait(
		async () => (await geometry()) === start,
		5000,
		'reset restores the player start'
	);
	if (output)
		await writeFile(
			join(output, 'doom-walking.png'),
			await driver.takeScreenshot(),
			'base64'
		);
	await driver.findElement(By.xpath('//button[text()="Overview"]')).click();
	await driver.wait(
		async () => (await geometry()) === overview,
		5000,
		'overview restores the whole map'
	);
	if (output)
		await writeFile(
			join(output, 'doom-desktop.png'),
			await driver.takeScreenshot(),
			'base64'
		);
	await driver.manage().window().setRect({ width: 390, height: 844 });
	await driver.wait(
		async () =>
			await driver.executeScript(
				'return arguments[0].viewBox.baseVal.width === arguments[0].clientWidth;',
				svg
			),
		5000,
		'mesh resizes to the viewport'
	);
	expect(
		await driver
			.findElement(By.css('a[aria-label="Back to experiments"]'))
			.isDisplayed()
	).toBe(true);
	if (output)
		await writeFile(
			join(output, 'doom-portrait.png'),
			await driver.takeScreenshot(),
			'base64'
		);
}
