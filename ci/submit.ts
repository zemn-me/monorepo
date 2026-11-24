import { deployToProduction } from '#root/ci/deploy/production.js';

deployToProduction().catch(e => {
	process.exitCode = 1;
	console.error(e);
});
