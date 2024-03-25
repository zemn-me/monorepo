// @ts-expect-error won't be valid until generation
import * as module from '__modulename';
import type { Handler } from 'aws-lambda';

it('should be of the correct interface', () => {
	const x: Handler = module.handler;
	expect(x).not.toBeUndefined();
});
