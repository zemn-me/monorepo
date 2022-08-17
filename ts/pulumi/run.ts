import spawn from 'cross-spawn';

const pulumi_bin = process.env['PULUMI_BIN'];

if (pulumi_bin == undefined) throw new Error('Missing env PULUMI_BIN');

const main = async () => {
	let args = process.argv.slice(2);

	if (args.length == 0) args = ['up', '--yes', '--non-interactive'];

	spawn.sync(
		pulumi_bin,
		['--emoji', '--cwd', 'ts/pulumi', '--logtostderr', ...args],
		{ stdio: 'inherit' }
	);
};

main().catch(e => console.error(e));
