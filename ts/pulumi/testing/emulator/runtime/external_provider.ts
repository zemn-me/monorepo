/** Explicit GCP/npm and OCI publication fixtures. */

import { createHash, createHmac } from 'node:crypto';
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
	const repository = new URL(`https://${interpreter[5]}`);
	if (repository.hostname !== '127.0.0.1')
		throw new Error('Expected emulator registry');
	// The emulator cannot accept OCI uploads. Seed its real ECR metadata with a
	// synthetic manifest so Lambda provisioning still uses the real AWS provider.
	const configBlob = JSON.stringify({
		architecture: 'amd64',
		os: 'linux',
		config: {
			Labels: {
				'aws-emulator-fixture': urn,
				'bazel-image-digest': String(interpreter[6]).trim(),
			},
		},
	});
	const configDigest = `sha256:${createHash('sha256').update(configBlob).digest('hex')}`;
	const manifest = JSON.stringify({
		schemaVersion: 2,
		mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
		config: {
			mediaType: 'application/vnd.docker.container.image.v1+json',
			size: Buffer.byteLength(configBlob),
			digest: configDigest,
		},
		layers: [],
	});
	const endpoint = new URL(process.env['AWS_ENDPOINT_URL'] ?? '');

	const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
	const day = date.slice(0, 8);
	const api = async (action: string, input: unknown) => {
		const body = JSON.stringify(input);
		const target = `AmazonEC2ContainerRegistry_V20150921.${action}`;
		const hash = (value: string) =>
			createHash('sha256').update(value).digest('hex');
		const headers = `content-type:application/x-amz-json-1.1\nhost:${endpoint.host}\nx-amz-date:${date}\nx-amz-target:${target}\n`;
		const signed = 'content-type;host;x-amz-date;x-amz-target';
		const scope = `${day}/us-east-1/ecr/aws4_request`;
		let key = Buffer.from(`AWS4${process.env['AWS_SECRET_ACCESS_KEY']}`);
		for (const value of [day, 'us-east-1', 'ecr', 'aws4_request'])
			key = Buffer.from(createHmac('sha256', key).update(value).digest());
		const signature = createHmac('sha256', key)
			.update(
				`AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(`POST\n/\n\n${headers}\n${signed}\n${hash(body)}`)}`
			)
			.digest('hex');
		const response = await fetch(endpoint, {
			method: 'POST',
			body,
			headers: {
				'content-type': 'application/x-amz-json-1.1',
				'x-amz-date': date,
				'x-amz-target': target,
				authorization: `AWS4-HMAC-SHA256 Credential=${process.env['AWS_ACCESS_KEY_ID']}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
				'x-emulator-fixture': 'OCI.Publish',
			},
		});
		const text = await response.text();
		if (!response.ok) {
			const error = JSON.parse(text) as { __type?: string };
			// Identical fixture config blobs are shared by several images. ECR
			// documents this response when completing an already-present layer.
			if (
				action === 'CompleteLayerUpload' &&
				error.__type === 'LayerAlreadyExistsException'
			)
				return {};
			throw new Error(`ECR fixture ${action} failed: ${text}`);
		}
		return JSON.parse(text) as Record<string, unknown>;
	};
	const repositoryName = repository.pathname.slice(1);
	const { uploadId } = await api('InitiateLayerUpload', { repositoryName });
	await api('UploadLayerPart', {
		repositoryName,
		uploadId,
		partFirstByte: 0,
		partLastByte: Buffer.byteLength(configBlob) - 1,
		layerPartBlob: Buffer.from(configBlob).toString('base64'),
	});
	await api('CompleteLayerUpload', {
		repositoryName,
		uploadId,
		layerDigests: [configDigest],
	});
	const text = JSON.stringify(
		await api('PutImage', {
			repositoryName,
			imageManifest: manifest,
			imageTag: `fixture-${createHash('sha256').update(urn).digest('hex').slice(0, 16)}`,
		})
	);
	const image = JSON.parse(text) as {
		image: { imageId: { imageDigest: string } };
	};
	return {
		...result,
		stdout: `${repository.host}${repository.pathname}@${image.image.imageId.imageDigest}`,
		stderr: '',
	};
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
