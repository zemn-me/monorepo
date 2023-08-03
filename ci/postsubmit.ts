import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import util from 'node:util';

import { context, getOctokit } from '@actions/github';

/** an error that is safe to print online (i.e. no secrets) */
export class SafeForPublicReleaseError extends Error {
	constructor(
		message: string,
		public readonly error?: Error
	) {
		super(message);
	}
}

export class NpmPackageUploadFailureError extends SafeForPublicReleaseError {
	constructor(
		public readonly npmPackage: npmPackage,
		public readonly error?: Error
	) {
		super(`Failed to upload npm package: ${npmPackage.name}`);
	}
}

class npmPackage {
	constructor(
		public readonly name: string,
		public readonly publishScript: string
	) {}

	async publish() {
		const o = await util.promisify(child_process.execFile)(
			this.publishScript,
			[]
		);
		if (o.stderr != '') console.error(o.stderr);
		if (o.stdout != '') console.error(o.stdout);
		return this;
	}
}

function Maybe<A extends unknown[], O, E extends Error>(
	fn: (...a: A) => Promise<O>,
	err: (e: unknown) => E
): (...a: A) => Promise<O | E> {
	return async function Maybe(...a: A) {
		try {
			return await fn(...a);
		} catch (e) {
			return err(e);
		}

		throw new Error();
	};
}

const listify = (...s: readonly string[]) =>
	s.slice(0, -2).join(', ') + s.slice(-2).join(' and ');

async function main() {
	const npm_packages = await Promise.all(
		[
			new npmPackage('svgshot', 'ts/cmd/svgshot/npm_pkg.publish.sh'),
			new npmPackage('do-sync', 'ts/do-sync/npm_pkg.publish.sh'),
			new npmPackage(
				'knowitwhenyouseeit',
				'ts/knowitwhenyouseeit/npm_pkg.publish.sh'
			),
		].map(p =>
			Maybe(
				p.publish.bind(p),
				e =>
					new NpmPackageUploadFailureError(
						p,
						e instanceof Error ? e : undefined
					)
			)()
		)
	);

	const successful_npm_packages: npmPackage[] = [];
	const unsuccessful_npm_packages: npmPackage[] = [];
	const errors: SafeForPublicReleaseError[] = [];

	for (const v of npm_packages) {
		if (v instanceof NpmPackageUploadFailureError) {
			unsuccessful_npm_packages.push(v.npmPackage);
			errors.push(v);
			continue;
		}

		successful_npm_packages.push(v);
	}

	const github = getOctokit(process.env['GITHUB_TOKEN']!);

	const version = (await fs.readFile('VERSION/VERSION.version.txt')).toString(
		'utf-8'
	);

	const body = `${
		successful_npm_packages.length
			? `This release includes the following NPM packages: ${listify(
					...successful_npm_packages.map(
						pkg =>
							`[${pkg.name}](https://npmjs.com/package/${pkg.name})`
					)
			  )}.`
			: ''
	}.

${
	unsuccessful_npm_packages.length
		? `The following NPM packages attempted an upload but failed: ${listify(
				...unsuccessful_npm_packages.map(v => v.name)
		  )}. This does not usually indicate an issue, I haven't programmed in recognition of rejection due to no update.`
		: ''
}`;

	await github.rest.repos.createRelease({
		owner: context.repo.owner,
		repo: context.repo.repo,

		tag_name: version,

		body,

		generate_release_notes: true,

		name: version,

		target_commitish: context.ref,
	});

	if (errors) {
		console.error('Some errors occurred, they are as follows:');
		for (const error of errors) console.error(error);
	}
}

main().catch(e => {
	process.exitCode = 1;
	console.error(e);
});
