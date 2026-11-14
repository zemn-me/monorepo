/** Fixtures for providers outside AWS Emulator's scope. Never executes commands. */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { main, type Provider } from '@pulumi/pulumi/provider/index.js';

const require = createRequire(import.meta.url);
const name = process.env['FIXTURE_PROVIDER'];
if (name !== 'gcp' && name !== 'command')
	throw new Error('Unknown fixture provider');
const { version } = JSON.parse(
	readFileSync(require.resolve(`@pulumi/${name}/package.json`), 'utf8')
) as { version: string };
const gcpTypes = new Set([
	'gcp:projects/service:Service',
	'gcp:iam/workloadIdentityPool:WorkloadIdentityPool',
	'gcp:iam/workloadIdentityPoolProvider:WorkloadIdentityPoolProvider',
	'gcp:serviceaccount/iAMMember:IAMMember',
	'gcp:secretmanager/secret:Secret',
	'gcp:secretmanager/secretIamMember:SecretIamMember',
]);
function outputs(urn: string, inputs: Record<string, unknown>) {
	const type = urn.split('::').at(-2)?.split('$').at(-1);
	if (name === 'gcp' && type && gcpTypes.has(type)) return inputs;
	if (name === 'command' && type === 'command:local:Command') {
		const interpreter = inputs['interpreter'];
		const isImage = urn.endsWith('_push');
		if (!Array.isArray(interpreter))
			throw new Error(`Missing interpreter: ${urn}`);
		if (!isImage && !urn.endsWith('_publish'))
			throw new Error(`Unclassified external command: ${urn}`);
		return {
			...inputs,
			stdout: isImage
				? `${interpreter[5]}@${String(interpreter[6]).trim()}`
				: '',
			stderr: '',
		};
	}
	throw new Error(`No non-AWS fixture for ${urn}`);
}
const provider: Provider = {
	version,
	async check(urn, _olds, news) {
		outputs(urn, news);
		return { inputs: news };
	},
	async create(urn, inputs) {
		return {
			id: urn.split('::').at(-1) ?? urn,
			outs: outputs(urn, inputs),
		};
	},
	async read(id, urn, props) {
		return { id, props: outputs(urn, props ?? {}), inputs: props };
	},
	async diff() {
		return { changes: false };
	},
	async update(_id, urn, _olds, news) {
		return { outs: outputs(urn, news) };
	},
	async delete() {
		// Fixtures have no external state to delete.
	},
};
await main(provider, process.argv.slice(2));
