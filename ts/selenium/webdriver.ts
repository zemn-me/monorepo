/**
 * @fileoverview wires up selenium webdriver
 */
import * as Selenium from 'selenium-webdriver';
import SeleniumChrome from 'selenium-webdriver/chrome';
import { chromeDriverPath } from 'ts/bin/host/chromedriver/path';
import { chromiumPath } from 'ts/bin/host/chromium/path';

/**
 * @returns a Chrome ServiceBuilder injected with defaults.
 */
export const chromeService = (): SeleniumChrome.ServiceBuilder =>
	new SeleniumChrome.ServiceBuilder(chromeDriverPath);

/**
 * Returns a Selenium WebDriver set up with defaults.
 *
 */
export const Driver = (): Selenium.Builder =>
	new Selenium.Builder()
		.setChromeService(chromeService())
		.setChromeOptions(
			new SeleniumChrome.Options()
				.setChromeBinaryPath(chromiumPath)
				.addArguments('--disable-dev-shm-usage')
		);

export const Chrome = (): Selenium.Builder =>
	Driver().forBrowser(Selenium.Browser.CHROME);
