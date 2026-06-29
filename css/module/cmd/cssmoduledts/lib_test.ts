import assert from 'node:assert/strict';
import { declaration } from './lib.js';

const output = declaration(
	'test.module.css',
	`
.shell { display: block; }
.button-primary:hover { color: red; }
:global(.external) { color: blue; }
.composed {
	composes: shell;
	color: green;
}
`
);

assert.match(output, /readonly "button-primary": string;/);
assert.match(output, /readonly "composed": string;/);
assert.match(output, /readonly "shell": string;/);
assert.doesNotMatch(output, /readonly "external": string;/);
assert.match(output, /readonly \[key: string\]: string;/);
assert.match(output, /export default styles;/);
