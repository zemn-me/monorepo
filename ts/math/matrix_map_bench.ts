import { performance } from 'node:perf_hooks';

import * as matrix from '#root/ts/math/matrix.js';

type Options = {
	height: number;
	samples: number;
	warmup: number;
	width: number;
};

type Benchmark = {
	name: string;
	run: () => number;
};

function readPositiveIntegerOption(
	name: keyof Options,
	fallback: number
): number {
	const prefix = `--${name}=`;
	const raw = process.argv.find(arg => arg.startsWith(prefix))?.slice(
		prefix.length
	);
	if (raw === undefined) return fallback;

	const value = Number(raw);
	if (!Number.isFinite(value) || value < 1) {
		throw new Error(`--${name} must be a positive integer`);
	}

	return Math.trunc(value);
}

function readOptions(): Options {
	return {
		height: readPositiveIntegerOption('height', 512),
		samples: readPositiveIntegerOption('samples', 30),
		warmup: readPositiveIntegerOption('warmup', 5),
		width: readPositiveIntegerOption('width', 512),
	};
}

function makeFlatMatrix(
	width: number,
	height: number
): matrix.Matrix<number, number> {
	return matrix.fromFunction(
		width,
		height,
		([i, j]) => (j * width + i) % 251
	);
}

function mapValue(
	value: number,
	[i, j]: readonly [i: number, j: number]
): number {
	return value * 1.0001 + i * 0.5 - j * 0.25;
}

function flatChecksum(m: matrix.Matrix<number, number>): number {
	return m((width, height, content) => {
		const middle = Math.floor(height / 2) * width + Math.floor(width / 2);
		const last = (height - 1) * width + (width - 1);
		return (
			(content[0] ?? 0) +
			(content[middle] ?? 0) +
			(content[last] ?? 0)
		);
	});
}

function assertEquivalentOutputs(flatInput: matrix.Matrix<number, number>) {
	const flatLoop = matrix.content(matrix.map(flatInput, mapValue));
	const flatArrayMap = matrix.content(matrix.mapWithArrayMap(flatInput, mapValue));

	if (flatLoop.length !== flatArrayMap.length) {
		throw new Error('flat matrix map implementations returned different sizes');
	}

	for (let index = 0; index < flatLoop.length; index++) {
		if (flatLoop[index] !== flatArrayMap[index]) {
			throw new Error('flat matrix map implementations returned different values');
		}
	}
}

function percentile(sortedSamples: number[], p: number): number {
	return sortedSamples[Math.floor((sortedSamples.length - 1) * p)] ?? 0;
}

function measure(
	benchmark: Benchmark,
	samples: number,
	warmup: number
): {
	guard: number;
	mean: number;
	min: number;
	p50: number;
	p95: number;
} {
	let guard = 0;
	for (let i = 0; i < warmup; i++) guard += benchmark.run();

	const timings: number[] = [];
	for (let i = 0; i < samples; i++) {
		const start = performance.now();
		guard += benchmark.run();
		timings.push(performance.now() - start);
	}

	const sorted = timings.toSorted((a, b) => a - b);
	const mean = timings.reduce((acc, value) => acc + value, 0) / timings.length;

	return {
		guard,
		mean,
		min: sorted[0] ?? 0,
		p50: percentile(sorted, 0.5),
		p95: percentile(sorted, 0.95),
	};
}

function formatMs(n: number): string {
	return `${n.toFixed(3)}ms`;
}

function main() {
	const options = readOptions();
	const flatInput = makeFlatMatrix(options.width, options.height);

	assertEquivalentOutputs(flatInput);

	const benchmarks: Benchmark[] = [
		{
			name: 'flat matrix.map',
			run: () => flatChecksum(matrix.map(flatInput, mapValue)),
		},
		{
			name: 'flat matrix.mapWithArrayMap',
			run: () => flatChecksum(matrix.mapWithArrayMap(flatInput, mapValue)),
		},
	];

	process.stdout.write(
		`matrix map benchmark: ${options.width}x${options.height}, ${options.samples} samples, ${options.warmup} warmups\n`
	);

	for (const benchmark of benchmarks) {
		const result = measure(benchmark, options.samples, options.warmup);
		process.stdout.write(
			`${benchmark.name.padEnd(28)} min=${formatMs(result.min)} p50=${formatMs(
				result.p50
			)} p95=${formatMs(result.p95)} mean=${formatMs(
				result.mean
			)} guard=${result.guard.toFixed(2)}\n`
		);
	}
}

main();
