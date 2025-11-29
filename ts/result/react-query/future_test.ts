import { describe, expect, it } from "@jest/globals";

import * as future from "#root/ts/result/react-query/future.js";
import {error, pending, success} from "#root/ts/result/react-query/future.js";


describe('zipped', () => {
	it.each([
		[pending(), pending(), pending()],
		[pending(), success(1 as const), pending()],
		[pending(), error(1 as const), error(1 as const)],
		[success(1 as const), pending(), pending()],
		[success(1 as const), success(2 as const), success(1 as const)],
		[success(1 as const), error(2 as const), error(2 as const)],
		[error(1 as const), pending(), error(1 as const)],
		[error(1 as const), success(2 as const), error(1 as const)],
		[error(1 as const), error(2 as const), error(1 as const)]
	])(
		' should work as expected', (a: future.Future<1|2, 1|2>, b: future.Future<1|2, 1|2>, eq: future.Future<1|2, 1|2>) => {
			const stringifyNumber = (v: number) => v.toString();
			const stringify = (f: future.Future<1 | 2, 1 | 2>) => future.stringify(
				f, stringifyNumber, stringifyNumber,
			);

			const _aStr = stringify(a);
			const _bStr = stringify(b);
			const result = future.zipped(a, b, a => a);
			const resultStr = stringify(result);

			expect(resultStr).toEqual(stringify(eq))
		}
	)
})
