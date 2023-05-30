import { isDefined, must } from "ts/guard";
import child_process from 'node:child_process';
import * as readline from 'node:readline/promises';
import http from 'node:http';

test('next.js dev server launch!', async () => {
    throw process.version
    const next_server_binary = must(isDefined)(process?.env?.NEXT_SERVER_BINARY);
    const BAZEL_BINDIR = must(isDefined)(process?.env?.BAZEL_BINDIR);


    const proc = child_process.execFile(next_server_binary, {
        env: {BAZEL_BINDIR},
    });


    /*
    for await (const line of readline.createInterface({
        input: proc.stdout, // not really needed, we're not asking Qs.
        output: proc.stdout
    })) {
        const m = /https:\/\/localhost\:\d+/.exec(line)
        if (m?.[0]) {
            // attempt to connect to the port
            const resp: http.IncomingMessage = await new Promise(ok => http.get(m?.[0], resp => ok(resp)))
            expect(resp.statusCode).toBe(200);

            break;
        }
    }
    */


});