/**
 * @fileoverview make an Owala purchase,
 * so my gf doesn't have to stay up late to
 * do it.
 */

import { By, until } from 'selenium-webdriver';
import { Chrome } from 'ts/selenium/webdriver';

const targetVariantId = '43679424774303';

const target = `https://owalalife.com/products/freesip?variant=${targetVariantId}`;

export async function main() {
	const chrome = Chrome().build();

	try {
		await chrome.get(target);
		const addToCartButton = await chrome.wait(
			until.elementsLocated(
				By.css('.addcart-button-group>.addcart-button.notify-btn')
			)
		);

		await addToCartButton[0]!.click();

		await chrome.get('https://owalalife.com/checkout');

		// check to see if we've successfully added it to our cart
		const innerHTML = await chrome.executeScript(function getInnerHTML() {
			return document.body.innerHTML;
		});
		if (typeof innerHTML !== 'string')
			throw new Error(`Got back ${typeof innerHTML}`);
		if (!(innerHTML.toString as () => string)().includes(targetVariantId))
			throw new Error('oh no!');

		await new Promise<void>(ok => setTimeout(() => ok(), 3000));
	} finally {
		await chrome.quit();
	}
}

void main();
