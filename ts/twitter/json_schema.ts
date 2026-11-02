/* biome-ignore-all lint/suspicious/noConsole: this file intentionally writes to the console */
import { toJSONSchema } from 'zod';

import { archivedTweetSchema } from '#root/ts/twitter/archive.js';

// The Go validator supports draft-07. Newer tuple keywords are ignored there.
// Type generation has a separate compatibility projection in BUILD.bazel.
const jsonSchema = toJSONSchema(archivedTweetSchema, { target: 'draft-7' });
console.log(JSON.stringify(jsonSchema, null, 2));
