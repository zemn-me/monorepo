/* eslint-disable no-console */
import { toJSONSchema } from "zod";

import { archivedTweetSchema } from "#root/ts/twitter/archive.js";

// Convert to JSON Schema
const jsonSchema = toJSONSchema(archivedTweetSchema);
console.log(JSON.stringify(jsonSchema, null, 2));

