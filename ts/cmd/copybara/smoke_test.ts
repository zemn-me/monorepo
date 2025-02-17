import { expect, test } from "@jest/globals";

import { copybaraBin } from "#root/ts/cmd/copybara/copybara.js";

test('smoke', () => {
	expect(copybaraBin).toBeDefined();
})
