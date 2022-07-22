import program from './program';

test('deploy', async () => {
	process.env.NPM_TOKEN = '123fake';
	await program.parseAsync(['xxx', 'ok', '--dryRun', 'true']);
});
