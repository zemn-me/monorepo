import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	optimizeDeps: {
		include: [
			'@tanstack/query-async-storage-persister',
			'@tanstack/react-query',
			'@tanstack/react-query-devtools',
			'@tanstack/react-query-persist-client',
			'base64-js',
			'classnames',
			'libphonenumber-js',
			'memoizee',
			'openapi-fetch',
			'openapi-react-query',
			'pako',
			'seedrandom',
		],
		noDiscovery: true,
	},
	plugins: [reactRouter()],
	publicDir: 'public',
	server: {
		host: 'localhost',
		port: 3000,
		strictPort: true,
	},
});
