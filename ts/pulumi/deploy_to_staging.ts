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
    let e: unknown | undefined;

    const s = staging();
    try {
        (await s).up({
            logToStdErr: true
        });

        console.log("Looks like we deployed to staging succesfully! Tearing it down again.");
    } catch (err) {
        e = err
    }

    // this will always happen.
    (await s).destroy()

    console.log("Destroyed successfully!");

    if (e !== undefined) {
        const e2 = new Error("Unable to up pulumi to staging");
        e2.cause = e;
        throw e2;
    }

}

export default main;