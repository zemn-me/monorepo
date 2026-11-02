/* biome-ignore-all lint/suspicious/noConsole: this file intentionally writes to the console */
'use client';

export function BadClient() {
	console.error('This is a test error');
	return <>👍</>;
}
