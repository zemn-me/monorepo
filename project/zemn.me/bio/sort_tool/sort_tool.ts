import fs from 'fs/promises';
import readline from 'readline';

const sort = async <T>(
	v: T[],
	test: (a: T, b: T) => Promise<-1 | 0 | 1>
): Promise<T[]> => {
	if (v.length <= 1) return v;

	const bigger: T[] = [],
		smaller: T[] = [];
	const pivotPos = Math.floor(v.length / 2);
	const [before, pivot, after] = [
		v.slice(0, pivotPos),
		v[pivotPos],
		v.slice(pivotPos + 1),
	];

	for (const itm of [...before, ...after]) {
		((await test(itm, pivot!)) === -1 ? smaller : bigger).push(itm);
	}

	return (await sort(smaller, test))
		.concat([pivot!])
		.concat(await sort(bigger, test));
};

const replace = async (
	s: string,
	re: RegExp & {
		hasIndices: true;
		global: true;
		lastIndex: 0;
	},
	f: (match: RegExpExecArray) => Promise<string>
): Promise<string> => {
	const match = re.exec(s);
	if (match === null) return s;
	const result = await f(match);
	re.lastIndex = 0;
	return s.replace(re, () => result);
};

async function main() {
	const target = process.argv.slice(2)[0];
	if (!target) {
		throw new Error('Missing target.');
	}

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stderr,
	});

	const segment =
		/(^\s+\/\/ BEGIN TOOL ASSISTED SORT\n)((?:.|\n)*\n)(^\s+\/\/ END TOOL ASSISTED SORT$)/gm as RegExp & {
			hasIndices: true;
			global: true;
			lastIndex: 0;
		};
	const endRecord = /^\s+},$/gm;

	console.log(
		await replace(
			(await fs.readFile(target)).toString(),
			segment,
			async ([, before, mid, after]: RegExpExecArray): Promise<string> =>
				before +
				(
					await sort<string>(mid!.split(endRecord), async (a, b) => {
						let out: -1 | 1 | 0 | undefined;
						while (out === undefined) {
							const choice = await new Promise<string>(ok =>
								rl.question(
									`is\n\t${JSON.stringify(
										a
									)}\nbetter than\n\t${JSON.stringify(
										b
									)}?\nY/N/S(ame)\n\t`,
									ok
								)
							);

							out = (
								{
									Y: 1,
									N: -1,
									S: 0,
								} as const
							)[choice];
						}

						return out;
					})
				).join('},') +
				after
		)
	);
}

main().catch(e => {
	console.error(e);
	process.exitCode = process.exitCode || 1;
});
