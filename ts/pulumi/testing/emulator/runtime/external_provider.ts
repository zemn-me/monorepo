/** GCP/npm fixtures and guarded OCI publishing into AWS Emulator. */

import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';

import { runfiles } from '@bazel/runfiles';
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
async function createOutputs(urn: string, inputs: Record<string, unknown>) {
	const result = outputs(urn, inputs);
	if (name !== 'command' || !urn.endsWith('_push')) return result;
	const interpreter = inputs['interpreter'];
	if (
		!Array.isArray(interpreter) ||
		!interpreter.every(value => typeof value === 'string')
	) {
		throw new Error(`Invalid image publisher interpreter: ${urn}`);
	}
	const executable = interpreter[0];
	const publisher = interpreter[4];
	if (executable !== 'sh' || typeof publisher !== 'string') {
		throw new Error(`Unexpected OCI publisher invocation: ${urn}`);
	}
	const arguments_ = interpreter.slice(1);
	arguments_[3] = path.isAbsolute(publisher)
		? publisher
		: runfiles.resolveWorkspaceRelative(publisher);
	const repository = new URL(`https://${interpreter[5]}`);
	const endpoint = new URL(process.env['AWS_ENDPOINT_URL'] ?? '');
	if (
		repository.hostname !== '127.0.0.1' ||
		repository.port !== endpoint.port
	) {
		throw new Error(
			`Image publishing must stay inside AWS Emulator: ${repository}`
		);
	}
	const environment = inputs['environment'] as Record<string, string>;
	const { stdout, stderr } = await promisify(execFile)(
		executable,
		[...arguments_, ''],
		{
			env: { ...process.env, ...environment },
			timeout: 30_000,
			maxBuffer: 1024 * 1024,
		}
	);
	return { ...result, stdout, stderr };
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
			outs: await createOutputs(urn, inputs),
		};
	},
	async read(id, urn, props) {
		return { id, props: outputs(urn, props ?? {}), inputs: props };
	},
	async diff() {
		return { changes: false };
	},
	async update(_id, urn, _olds, news) {
		return { outs: await createOutputs(urn, news) };
	},
	async delete() {
		// Fixtures have no external state to delete.
	},
};
await main(provider, process.argv.slice(2));
