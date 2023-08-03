import { LocalWorkspace, UpResult } from '@pulumi/pulumi/automation';
import * as monorepo from 'ts/pulumi';

export async function run(): Promise<UpResult>;

export async function run(
	interactive: true | false,
	preview: true
): Promise<void>;

export async function run(
	interactive?: boolean,
	preview?: boolean
): Promise<UpResult | void> {
	const logs: unknown[][] = [];

	let log = function log(...a: unknown[]) {
		logs.push(a);
	};

	if (interactive) log = (...a: unknown[]) => console.info(...a);

	try {
		const stack = await LocalWorkspace.createOrSelectStack({
			stackName: 'prod',
			projectName: 'monorepo-2', // be very, very careful in changing this
			async program() {
				new monorepo.Component('monorepo', { staging: false });
			},
		});

		await stack.workspace.installPlugin('aws', 'v5.13.0'); // can I get rid of this? it seems stupid
		await stack.setConfig('aws:region', { value: 'us-east-1' });
		await stack.refresh({ onOutput: log, showSecrets: false });

		// uncomment at your peril
		//await stack.destroy({ onOutput: log });

		if (preview) {
			await stack.preview({ onOutput: log });
			return;
		}

		const upRes = await stack.up({ onOutput: log, showSecrets: false });

		return upRes;
	} catch (e) {
		logs.forEach(a => console.info(...a));
		throw e;
	}
}

export default run;
