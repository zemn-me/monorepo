import { spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import {
	access,
	cp,
	mkdir,
	mkdtemp,
	readdir,
	rename,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build as bundle } from 'esbuild';
import serve from 'serve-handler';
import { createNodeListener } from '#root/ts/remix/server.mjs';

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
if (command === 'start' && args.includes('--server')) {
	const { handleRequest, staticPaths } = await import(
		pathToFileURL(path.join(root, 'server/handler.mjs')).href
	);
	const listener = createNodeListener(handleRequest);
	createServer(async (request, response) => {
		const url = new URL(request.url, 'http://localhost');
		if (staticPaths.includes(url.pathname))
			return serve(request, response, {
				public: path.join(root, 'build'),
				cleanUrls: false,
			});
		return listener(request, response);
	}).listen(port, 'localhost', () => console.log(`http://localhost:${port}`));
} else if (command === 'start') {
	const serverFile = path.join(root, 'server_build/handler.mjs');
	const renderer = existsSync(serverFile)
		? await import(pathToFileURL(serverFile))
		: undefined;
	createServer(async (request, response) => {
		if (!renderer || request.url.startsWith('/assets/')) {
			return serve(request, response, {
				public: path.join(root, 'build'),
				cleanUrls: true,
			});
		}
		try {
			const result = await renderer.fetchPage(
				new Request(
					new URL(request.url, `http://${request.headers.host}`),
					{ method: request.method }
				),
				{ apiOrigin: process.env.API_ORIGIN }
			);
			response.writeHead(
				result.status,
				Object.fromEntries(result.headers)
			);
			response.end(Buffer.from(await result.arrayBuffer()));
		} catch (error) {
			console.error(error);
			response.writeHead(500);
			response.end('Unable to render page');
		}
	}).listen(port, 'localhost', () => console.log(`http://localhost:${port}`));
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
		const serverEntryIndex = args.indexOf('--server-entry');
		if (serverEntryIndex !== -1) {
			const { build } = await import('esbuild');
			await build({
				stdin: {
					contents: `import {createHandler} from ${JSON.stringify(path.join(root, args[serverEntryIndex + 1]))}; import * as build from ${JSON.stringify(path.join(root, '.react-router-build/server/index.js'))}; export const {handler, fetchPage} = createHandler(build);`,
					resolveDir: root,
					sourcefile: 'server-entry.mjs',
				},
				outfile: path.join(root, 'server_build/handler.mjs'),
				bundle: true,
				platform: 'node',
				format: 'esm',
				target: 'node24',
				banner: {
					js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
				},
				define: { 'process.env.NODE_ENV': '"production"' },
			});
		}
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
		if (args.includes('--server')) {
			const server = path.join(root, 'server');
			await mkdir(server, { recursive: true });
			const prerendered = {};
			const staticPaths = [];
			async function collect(directory) {
				for (const entry of await readdir(directory, {
					withFileTypes: true,
				})) {
					const file = path.join(directory, entry.name);
					if (entry.isDirectory()) {
						await collect(file);
						continue;
					}
					const relative = path.relative(output, file);
					const isPublic = await access(
						path.join(root, 'public', relative)
					).then(
						() => true,
						() => false
					);
					if (
						!isPublic &&
						/\.(html|data)$/.test(relative) &&
						!['404.html', '__spa-fallback.html'].includes(relative)
					) {
						const route =
							relative === 'index.html'
								? '/'
								: '/' + relative.replace(/\.html$/, '');
						prerendered[route] = relative;
						await mkdir(
							path.dirname(
								path.join(server, 'prerendered', relative)
							),
							{ recursive: true }
						);
						await cp(
							file,
							path.join(server, 'prerendered', relative)
						);
					} else if (
						!relative.startsWith('.vite/') &&
						relative !== '404.html'
					)
						staticPaths.push('/' + relative);
				}
			}
			await collect(output);
			// Public directories are reserved asset namespaces in CloudFront.
			const assetPatterns = [
				...new Set(
					staticPaths.map(value => {
						const slash = value.indexOf('/', 1);
						return slash < 0 ? value : value.slice(0, slash) + '/*';
					})
				),
			];
			await writeFile(
				path.join(server, 'assets.json'),
				JSON.stringify(assetPatterns)
			);
			await bundle({
				stdin: {
					contents: `import * as build from ${JSON.stringify(path.join(root, '.react-router-build/server/index.js'))};
import { createApp, createLambdaHandler } from ${JSON.stringify(path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs'))};
export { createNodeListener } from ${JSON.stringify(path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs'))};
export const staticPaths = ${JSON.stringify(staticPaths)};
export const handleRequest = createApp(build, ${JSON.stringify(prerendered)}, new URL('./prerendered/', import.meta.url));
export const handler = createLambdaHandler(handleRequest);`,
					resolveDir: root,
				},
				outfile: path.join(server, 'handler.mjs'),
				bundle: true,
				platform: 'node',
				target: 'node24',
				format: 'esm',
				define: { 'process.env.NODE_ENV': '"production"' },
				banner: {
					js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
				},
			});
		}
		await rm(path.join(output, '__spa-fallback.html'), { force: true });
		await rm(path.join(output, '.vite'), { recursive: true, force: true });
	});
}
