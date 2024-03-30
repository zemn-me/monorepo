import { RedditSearchResponse } from '#root/ts/reddit/reddit';
import { response_example } from '#root/ts/reddit/response_example';

it('should parse an example response correctly', () => {
	expect(() => RedditSearchResponse.parse(response_example)).not.toThrow();
});
