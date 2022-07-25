import program from './program';

async function main() {
	await program().parseAsync(process.argv);
}

main().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
