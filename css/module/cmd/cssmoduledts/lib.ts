import { transform } from 'lightningcss';

export function declaration(filename: string, css: string | Uint8Array): string {
	const result = transform({
		filename,
		code: Buffer.from(css),
		cssModules: true,
	});

	const names = Object.keys(result.exports ?? {}).sort();
	const lines = [
		'declare const styles: {',
		'\treadonly [key: string]: string;',
		...names.map((name) => `\treadonly ${JSON.stringify(name)}: string;`),
		'};',
		'export default styles;',
		'',
	];

	return lines.join('\n');
}
