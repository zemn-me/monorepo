import { fileURLToPath } from 'node:url';
import sharedConfig from '#root/ts/remix/vite.mjs';

export default env => {
	const config = sharedConfig(env);
	return {
		...config,
		resolve: {
			...config.resolve,
			alias: [
				// Configure JIT-free validation before any dependency constructs schemas.
				{
					find: /^zod$/,
					replacement: fileURLToPath(new URL('./app/zod.js', import.meta.url)),
				},
				{
					find: /^zod\/(?:mini|v4-mini)$/,
					replacement: fileURLToPath(new URL('./app/zod_mini.js', import.meta.url)),
				},
				...Object.entries(config.resolve.alias).map(([find, replacement]) => ({ find, replacement })),
			],
		},
	};
};
