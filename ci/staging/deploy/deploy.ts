import { pulumiCommand } from '#root/ts/pulumi/cli.js';
import deployToStaging from '#root/ts/pulumi/deploy_to_staging.js';

const [revision] = process.argv.slice(2);
switch (revision) {
	case 'verify':
		// Resolves the packaged CLI through runfiles and executes pulumi version.
		await pulumiCommand();
		break;
	case 'main':
	case 'candidate':
		await deployToStaging({
			doNotTearDown: true,
			overwrite: revision === 'main',
			skipRefresh: revision === 'candidate',
		});
		break;
	default:
		throw new Error('Expected main, candidate, or verify');
}
