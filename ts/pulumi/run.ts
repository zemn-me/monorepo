import { LocalWorkspace, Stack } from '@pulumi/pulumi/automation';

export async function stack(
	log: (...a: unknown[]) => void = (...a) => console.info(...a)
): Promise<Stack> {
	const stack = await LocalWorkspace.createOrSelectStack({
		stackName: 'prod',
		projectName: 'monorepo-2', // be very, very careful in changing this
		async program() {
			require('ts/pulumi/index');
		},
	});

	await stack.workspace.installPlugin('aws', 'v5.13.0'); // can I get rid of this? it seems stupid
	await stack.setConfig('aws:region', { value: 'us-east-1' });
	await stack.refresh({ onOutput: log, showSecrets: false });

	return stack;
}
