import path from 'node:path';

export function configuration() {
	const directory = process.env['TEST_TMPDIR'];
	if (!directory) throw new Error('TEST_TMPDIR is required');
	const ports: Record<string, number> = JSON.parse(
		process.env['ASSIGNED_PORTS'] ?? '{}'
	);
	const port = ports['@@//ts/pulumi/testing/emulator:service'];
	if (!port) throw new Error('AWS Emulator service port is missing');
	const home = path.join(directory, 'aws-emulator');
	const files = path.join(home, '.aws/emulator', String(port));
	return {
		directory,
		port,
		home,
		endpoint: `https://127.0.0.1:${port}`,
		certificate: path.join(files, 'ca.pem'),
		credentials: path.join(files, 'emulator_credentials'),
	};
}
