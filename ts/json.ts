import { Err, Ok, Result } from "#root/ts/result.js";

/**
 * JSONPrimitive represents a primitive which can be safely transmitted over JSON.
 * @see {@link JSONObject}
 * @public
 */
export type JSONPrimitive = string | number | boolean | null | undefined;

/**
 * JSONValue represents a value which can be safely transmitted over JSON.
 * @see {@link JSONObject}
 * @public
 */
export type JSONValue = JSONObject | JSONArray | JSONPrimitive;

/**
 * JSONArray represents an array which can be safely transmitted over JSON.
 * @see {@link JSONObject}
 * @public
 */
export type JSONArray = JSONValue[];

/**
 * JSONObject represents an object which can be safely transmitted over JSON.
 * @public
 */
export interface JSONObject extends Record<string, JSONValue> {}


export function safeParseJSON(json: string): Result<unknown, SyntaxError> {
	return Ok(() => JSON.parse(json)).safely().unwrap_or_else(
		e => {
			if (e instanceof SyntaxError) return Err(e);

			throw new Error('JSON.parse() threw an error that was not SyntaxError!?');
		}
	)
}
