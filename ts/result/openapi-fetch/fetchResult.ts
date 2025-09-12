import { FetchResponse, ParseAsResponse } from "openapi-fetch";
import { ErrorResponse, ResponseObjectMap, SuccessResponse } from "openapi-typescript-helpers";

import { Err, Ok, Result } from "#root/ts/result/result.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FailureResponse<T extends Record<string | number, any>> =
        ErrorResponse<ResponseObjectMap<T>>;

/**
 * Turns a response from openapi-fetch into a {@link Result}.
 */
/*#__NO_SIDE_EFFECTS__*/ export function fetchResult<
        Z,
        A extends Record<string | number, Z>,
        B,
        C extends `${string}/${string}`,
        E
>(
        r: FetchResponse<A, B, C>,
        err: (v: FailureResponse<A>) => E
): Result<
        ParseAsResponse<SuccessResponse<ResponseObjectMap<A>, C>, B>,
        E
> {
        if (r.error !== undefined)
                return Err(err(r.error));

        // i cant see how this would be undefined
        return Ok(r.data!)
}

