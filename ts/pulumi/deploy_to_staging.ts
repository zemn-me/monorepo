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
import { staging } from 'ts/pulumi/stack';

export async function main() {
	let upError: unknown | undefined;
    let destroyError: unknown | undefined;

	const s = staging();
	try {
		await (await s).up({
			logToStdErr: true,
		});

		console.log(
			'Looks like we deployed to staging succesfully! Tearing it down again.'
		);
	} catch (err) {
		upError = err;
	}

    try {
        // this will always happen.
        await (await s).destroy();
        console.log('Destroyed successfully!');
    } catch (e) {
        destroyError = e;
    }

    let e: Error | undefined;
    switch (true){
    case upError === undefined && destroyError !== undefined:
        e = new Error("A deployment to staging completed successfully, but " +
            "tearing down the staging infrastructure after the fact failed.");
        e.cause = destroyError;
        break;
    case upError !== undefined && destroyError !== undefined:
        e = new Error("Both attempting to create the infrastructure, and attempting to destroy it failed.");
        if (destroyError instanceof Error) {
            destroyError.cause = upError
            e.cause = destroyError
        } else {
            e.cause = upError;
        }
        break;
    case upError !== undefined && destroyError == undefined:
        e = new Error("Attempting to create the infrastructure succeeded. However attempting to destroy it failed.");
        e.cause = upError;
        break;
    case upError === undefined && destroyError === undefined:
        break;
    default:
        throw new Error("Unhandled condition.");
    }

    if (e !== undefined) throw e;

}

export default main;
