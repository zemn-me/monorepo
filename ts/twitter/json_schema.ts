/* eslint-disable no-console */
import { zodToJsonSchema } from "zod-to-json-schema";

import { archivedTweetSchema } from "#root/ts/twitter/archive.js";

// Convert to JSON Schema
const jsonSchema = zodToJsonSchema(archivedTweetSchema);
console.log(JSON.stringify(jsonSchema, null, 2));

