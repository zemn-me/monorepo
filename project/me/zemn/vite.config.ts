import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	optimizeDeps: {
		entries: [
			'app/**/*.tsx',
			'components/**/*.tsx',
			'hook/**/*.tsx',
			'router/**/*.tsx',
		],
	},
	plugins: [reactRouter()],
	publicDir: 'public',
	server: {
		host: 'localhost',
		port: 3000,
		strictPort: true,
	},
});
