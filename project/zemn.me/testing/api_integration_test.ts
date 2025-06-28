import child_process from 'node:child_process';
import * as readline from 'node:readline/promises';

import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { runfiles } from '@bazel/runfiles';
import createFetchClient from 'openapi-fetch';

import type { paths } from '#root/project/zemn.me/api/api_client.gen';

describe('zemn.me api', () => {
  let proc: child_process.ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    const bin = runfiles.resolveWorkspaceRelative('project/zemn.me/api/cmd/local/local_/local');
    proc = child_process.spawn(bin, { env: { ADDR: '127.0.0.1:0' } });

    const rl = readline.createInterface({ input: proc.stdout! });
    for await (const line of rl) {
      const m = /listening on (http:\/\/\S+)/.exec(line.toString());
      if (m) {
        baseUrl = m[1];
        break;
      }
    }
  });

  afterAll(async () => {
    proc.kill();
  });

  it('healthz returns OK', async () => {
    const client = createFetchClient<paths>({ baseUrl });
    const { data, error } = await client.GET('/healthz');
    expect(error).toBeUndefined();
    expect(data).toBe('OK');
  });
});
