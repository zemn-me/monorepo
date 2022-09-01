import { LocalWorkspace } from '@pulumi/pulumi/automation';

export const run = async () => {
	const logs: any[][] = [];

	function log(...a: any[]) {
		logs.push(a);
	}

	try {
		const stack = await LocalWorkspace.createOrSelectStack({
			stackName: 'prod',
			projectName: 'monorepo-2', // be very, very careful in changing this
			async program() {
				require('monorepo/ts/pulumi/index');
			},
		});

		await stack.workspace.installPlugin('aws', 'v5.13.0'); // can I get rid of this? it seems stupid
		await stack.setConfig('aws:region', { value: 'us-east-1' });
		await stack.refresh({ onOutput: log, showSecrets: false });

		// uncomment at your peril
		//await stack.destroy({ onOutput: log });

		const upRes = await stack.up({ onOutput: log, showSecrets: false });

		return upRes;
	} catch (e) {
		logs.forEach(a => console.info(...a));
		throw e;
	}
};

export default run;
