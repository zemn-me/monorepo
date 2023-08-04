/**
 * @fileoverview a test binary which deploys the Pulumi configuration
 * to staging and then destroys it.
 *
 * It can only be run with the proper tokens and an internet connection.
 *
 * Because this causes a bunch of important state changes in external state
 * and most importantly requires punching through the sandbox in various ways
 * to work, this is not exposed as a normal jest test.
 */
import * as pulumi from '@pulumi/pulumi/automation';
import { staging } from 'ts/pulumi/stack';

const millisecond = 1;
const second = 1000 * millisecond;
const minute = 60 * second;

async function waitForLock<T>(
	f: () => Promise<T>,
	cause?: string
): Promise<T | Error> {
	const results: (T | Error)[] = [];
	let lastResult: T | Error;
	const startTime = +new Date();
	const timeLimit = 10 * minute;
	const step = 2 * minute;

	do {
		lastResult = await attempt(f);
		results.push(lastResult);
	} while (
		lastResult instanceof Error &&
		lastResult instanceof pulumi.ConcurrentUpdateError &&
		+new Date() - startTime < timeLimit &&
		(await new Promise<boolean>(ok => {
			console.log(
				`${cause} could not acquire lock. Backing off for ${
					step / minute
				} minutes.`
			);
			setTimeout(() => ok(true), step);
		}))
	);

	// if there was eventual success, just ignore the errors.

	if (!(lastResult instanceof Error)) {
		return lastResult;
	}

	// otherwise, accumulate the errors.

	let error: Error = new MultiError(
		results.filter(<T>(v: Error | T): v is Error => v instanceof Error)
	);

	// if we failed due to timeout, wrap with a timeout error.

	if (+new Date() - startTime > 10 * minute) {
		const e = new Error(`${cause} timed out`);
		e.cause = error;

		error = e;
	}

	return error;
}

async function attempt<T>(
	f: () => Promise<T>,
	cause?: string
): Promise<T | Error> {
	let ret: T | Error;
	try {
		ret = await f();
	} catch (e) {
		const base = e instanceof Error ? e : new Error(`${e}`);

		ret = new Error(`${cause} failed`);
		ret.cause = base;
	}

	return ret;
}

class MultiError extends Error {
	constructor(public readonly errors: Error[]) {
		super(errors.map(e => `${e}`).join('; '));
	}
}

interface Args {
	/**
	 * Don't destroy the infra once it's turned up.
	 */
	doNotTearDown: boolean;
}

export async function main(args: Args) {
	const baseConfig = {
		onOutput(output: string) {
			console.info(output);
		},
		logToStdErr: true,
	};

	const s = staging();

	const e1 = await waitForLock(
		async () => s.then(v => v.refresh(baseConfig)),
		'refreshing state'
	);

	const e2 = !args.doNotTearDown
		? await waitForLock(
				async () => s.then(v => v.destroy(baseConfig)),
				'destroying old state'
		  )
		: undefined;
	const e3 = await waitForLock(
		async () => s.then(v => v.up(baseConfig)),
		'deploying'
	);
	const e4 = await waitForLock(
		async () => s.then(v => console.log(v.outputs())),
		'outputs testing'
	);
	const e5 = !args.doNotTearDown
		? await waitForLock(
				async () => s.then(v => v.destroy(baseConfig)),
				'destroy new state'
		  )
		: undefined;

	const errors = [e1, e2, e3, e4, e5].filter(
		<T>(v: T | Error): v is Error => v instanceof Error
	);

	if (errors.length > 0) throw new MultiError(errors);
}

export default main;
