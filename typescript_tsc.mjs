import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function projectArgIndex(args) {
	for (let i = 0; i < args.length; i += 1) {
		if (args[i] === '--project' || args[i] === '-p') {
			return i;
		}
	}
	return -1;
}

function withBazelRootPath(args) {
	const bindir = process.env.BAZEL_BINDIR;
	const index = projectArgIndex(args);
	if (!bindir || bindir === '.' || index === -1 || !args[index + 1]) {
		return args;
	}

	const original = path.resolve(process.cwd(), args[index + 1]);
	const config = JSON.parse(fs.readFileSync(original, 'utf8'));
	const compilerOptions = (config.compilerOptions ??= {});
	const paths = (compilerOptions.paths ??= {});
	const outputRoot = process.cwd().endsWith(bindir) ? '.' : `./${bindir}`;

	paths['#root/*.js'] = [
		`${outputRoot}/*.d.ts`,
		`${outputRoot}/*.ts`,
		...(paths['#root/*.js'] ?? []),
	];

	const generated = path.join(
		process.cwd(),
		`.${path.basename(original)}.${process.pid}.generated`
	);
	fs.writeFileSync(generated, JSON.stringify(config, null, '\t'));

	const nextArgs = [...args];
	nextArgs[index + 1] = generated;
	return nextArgs;
}

const packageJsonUrl = await import.meta.resolve('typescript7/package.json');
const packageDir = path.dirname(fileURLToPath(packageJsonUrl));
const tsc = path.join(packageDir, 'bin', 'tsc');

execFileSync(process.execPath, [tsc, ...withBazelRootPath(process.argv.slice(2))], {
	stdio: 'inherit',
});
