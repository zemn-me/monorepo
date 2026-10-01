import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import {
	access,
	cp,
	mkdir,
	mkdtemp,
	readdir,
	rename,
	rm,
	symlink,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import serve from 'serve-handler';

const [command, project, ...args] = process.argv.slice(2);
let root = path.resolve(project);
if (command === 'dev') {
	const compiledRoot = path.dirname(
		path.dirname(realpathSync(path.join(root, 'app/root.js')))
	);
	const temporary = path.join(compiledRoot, '.react-router');
	await mkdir(temporary, { recursive: true });
	const snapshot = await mkdtemp(path.join(temporary, 'dev-'));
	// Route files need stable real paths, but watching Bazel's output tree follows
	// test runfiles back into the entire workspace. Snapshot only declared app inputs.
	await cp(path.join(root, 'app'), path.join(snapshot, 'app'), {
		recursive: true,
		dereference: true,
	});
	for (const file of ['vite.config.mjs', 'react-router.config.mjs'])
		await cp(path.join(root, file), path.join(snapshot, file));
	if (
		await access(path.join(root, 'public')).then(
			() => true,
			() => false
		)
	)
		await symlink(path.join(root, 'public'), path.join(snapshot, 'public'));
	root = snapshot;
}
const portIndex = args.lastIndexOf('--port');
const port = portIndex < 0 ? 3000 : Number(args[portIndex + 1]);
if (command === 'start') {
	createServer((request, response) =>
		serve(request, response, {
			public: path.join(root, 'build'),
			cleanUrls: true,
		})
	).listen(port, 'localhost', () => console.log(`http://localhost:${port}`));
} else {
	const require = createRequire(import.meta.url);
	const cli = path.join(
		path.dirname(require.resolve('@react-router/dev/package.json')),
		'bin.cjs'
	);
	const child = spawn(
		process.execPath,
		[
			cli,
			command,
			...(command === 'dev'
				? ['--port', String(port), '--strictPort']
				: []),
		],
		{
			cwd: root,
			stdio: 'inherit',
			env: process.env,
		}
	);
	for (const signal of ['SIGINT', 'SIGTERM'])
		process.on(signal, () => child.kill(signal));
	child.on('exit', async code => {
		if (command === 'dev') await rm(root, { recursive: true, force: true });
		if (code !== 0) {
			process.exitCode = code ?? 1;
			return;
		}
		if (command !== 'build') return;
		const output = path.join(root, 'build');
		await mkdir(output, { recursive: true });
		await cp(path.join(root, '.react-router-build/client'), output, {
			recursive: true,
		});
		// CloudFront stores extensionless page keys; preserve the existing export contract.
		async function flatten(directory) {
			for (const entry of await readdir(directory, {
				withFileTypes: true,
			})) {
				if (entry.isDirectory())
					await flatten(path.join(directory, entry.name));
				else if (entry.name === 'index.html' && directory !== output) {
					const publicFile = path.join(
						root,
						'public',
						path.relative(output, directory),
						entry.name
					);
					if (
						await access(publicFile).then(
							() => true,
							() => false
						)
					)
						continue;
					await rename(
						path.join(directory, entry.name),
						`${directory}.html`
					);
				}
			}
		}
		await flatten(output);
		await rm(path.join(output, '__spa-fallback.html'), { force: true });
		await rm(path.join(output, '.vite'), { recursive: true, force: true });
	});
}
