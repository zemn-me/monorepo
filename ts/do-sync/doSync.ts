/* eslint-disable no-console */
import { SpawnSyncOptions } from 'child_process';
import crossSpawn from 'cross-spawn';

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

type ResponseType = 'success' | 'failure';

interface Response {
	type: ResponseType;
	value: JSONValue;
}

/**
 * Value represents data that can safely be input to,
 * or returned from a doSync() function.
 * @public
 */
export type Value = JSONValue;

/**
 * An AsyncFn can be used with doSync().
 * @public
 */
export type AsyncFn<I extends Value[], O extends Value> = (
	...v: I
) => Promise<O>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gen: (input: Value[], fn: AsyncFn<any, any>) => string = (input, fn) => `
const main = async () => {
    console.log(JSON.stringify({ type: "success", value: await (${fn})(...${JSON.stringify(
		input
	)}) }));
}

main().catch(e => console.log(JSON.stringify({ type: "failure", value: e })));
`;

/**
 * DoSyncOptions is the set of options that can be used with {@link doSync}.
 *
 * It is a copy of {@link SpawnSyncOptions}.
 * @public
 */
export interface DoSyncOptions extends SpawnSyncOptions {}

/**
 * doSync returns a synchronous version of certian
 * special asynchronous functions by extracting them
 * and running them as a synchronous node subprocess.
 *
 * The input and output types of the function must be serializible
 * to JSON, and the function must not reference any parent
 * scopes (i.e. file-defined variables) to function.
 *
 * @public
 */
export const doSync: <I extends Value[], O extends Value>(
	f: AsyncFn<I, O>,
	opts?: DoSyncOptions
) => (...ip: I) => O =
	(fn, { maxBuffer = 1000 * 1024 * 1024, ...etc }: DoSyncOptions = {}) =>
	(...ip) => {
		const proc = crossSpawn.sync('node', ['-'], {
			input: gen(ip, fn),
			maxBuffer,
			...etc,
		});

		const stderr = proc.stderr.toString('utf-8').trim();
		if (stderr) console.error(stderr);
		if (proc.error) throw proc.error;

		const rsp: Response = JSON.parse(proc.stdout.toString('utf-8'));

		if (rsp.type == 'failure') throw rsp.value;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return rsp.value as any;
	};

export default doSync;
