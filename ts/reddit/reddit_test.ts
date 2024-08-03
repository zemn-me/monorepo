import { expect, it } from '@jest/globals';

import { RedditSearchResponse } from '#root/ts/reddit/reddit.js';
import { response_example } from '#root/ts/reddit/response_example.js';

it('should parse an example response correctly', () => {
	expect(() => RedditSearchResponse.parse(response_example)).not.toThrow();
});
