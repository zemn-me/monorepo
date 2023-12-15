import { exec } from 'child_process';
import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import puppeteer from 'puppeteer';
import * as svgo from 'svgo';
import * as tmp from 'tmp';
import { promisify } from 'util';

const program = new Command()
	.name('svgshot')
	.usage('<url>')
	.description(
		'take svg screenshots of webpages. requires the inkscape cli tool.'
	)
	.option(
		'-s, --scale <scale>',
		'scale of the render. must be between 1 and 2',
		'1'
	)
	.option('--no-background', 'do not render backgounds')
	.option(
		'--width <width>',
		'Width; using px, mm or in (as though printed)',
		'1000px'
	)
	.option(
		'--height <height>',
		'Height; using px, mm or in (as though printed)',
		'1000px'
	)
	.option('--media <media>', 'CSS @page media', 'screen')
	.option(
		'--timeout <milliseconds>',
		'Maximum time to wait for page to become idle before taking screenshot',
		'10000'
	)
	.option(
		'--block',
		"make text invisible for presentation (it's still in the file though)",
		false
	)
	.option(
		'--headful',
		'run in a visible chromium instance (useful for debugging). also implicitly retains the chromium instance',
		false
	)
	.option(
		'--out <fileName>',
		'manually specify an output file name -- this fails if multiple URLs are to be recorded',
		undefined
	)
	.option(
		'--inkscapeBin <location>',
		'specify the location of the inkscape binary',
		'inkscape'
	);

const isValidMedia = (s: string): s is 'screen' | 'print' =>
	s == 'screen' || s == 'print';

type Eventually<T> = T | Promise<T>;

type EventuallyIterable<T> = Iterable<T> | AsyncIterable<T>;

const map: <T, O>(
	v: EventuallyIterable<T>,
	f: Eventually<(v: T, i: number) => Eventually<O>>
) => EventuallyIterable<O> = async function* (iter, f) {
	let n = 0;
	for await (const value of iter) yield (await f)(value, n++);
};

const tempFile = (ext: string) =>
	new Promise<[filepath: string, destructor: () => void]>((ok, fail) =>
		tmp.file(
			{
				tmpdir: process.env['TEST_TMPDIR'] || undefined,
				postfix: ext,
			},
			(error, path, _, cleanup) => {
				if (error) return fail(error);
				return ok([path, cleanup]);
			}
		)
	);

/**
 * @public
 * Svgshot is a command-line program for generating SVG files.
 */
export const main = async (argv: string[] = process.argv) => {
	let {
		background,
		width,
		height,
		media,
		scale,
		timeout,
		block,
		headful,
		inkscapeBin,
		out,
	} = program.parse(argv).opts();

	scale = +scale;

	const args = program.args;

	if (!isValidMedia(media))
		throw new Error(
			`invalid media type ${media}; must be "screen" or "print"`
		);

	const browser = await puppeteer.launch({
		headless: !headful,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-dev-shm-usage',
			'--disable-gpu',
		], // unfortunate, but needed to work with wsl...
	});

	if (out !== undefined && args.length > 1) {
		throw new Error(
			`Out file specified and more than one URL (${args}) to load.`
		);
	}

	const captures = map(args, async (url, i) => {
		console.warn('loading', url);

		const loading = setInterval(() => {
			console.warn('still loading', url);
		}, timeout / 2);

		const page = await browser.newPage();

		try {
			await page.goto(url, {
				waitUntil: 'networkidle2',
				timeout,
			});
		} catch (e) {
			// if the network doesn't go idle, we still take the screenshot
		}

		clearInterval(loading);

		if (block) {
			const loading = setInterval(() => {
				console.warn('waiting for injected style...', url);
			}, timeout / 2);

			await page.evaluate(() => {
				const s = document.createElement('style');
				s.innerHTML = `* { color: transparent !important }`;
				document.head.appendChild(s);
			});

			clearInterval(loading);
		}

		await page.emulateMediaType(media);

		const pdf = await page.pdf({
			scale: scale,
			printBackground: background,
			width: width,
			height: height,
			margin: { top: 0, right: 0, left: 0, bottom: 0 },
		});

		const [pdfFile, cleanup1] = await tempFile('.pdf');
		const [svgFile, cleanup2] = await tempFile('.svg');

		const cleanup = () => {
			cleanup1();
			cleanup2();
		};

		if (pdf.length === 0) {
			throw new Error('Failed to generate PDF.');
		}

		await writeFile(pdfFile, pdf);

		const line =
			`${inkscapeBin} --without-gui ${pdfFile} ` +
			`--export-type=svg --export-plain-svg --export-filename=${svgFile}`;
		console.warn('running', line);
		try {
			const result = await promisify(exec)(line);
			if (result.stderr.length > 0) console.warn(result.stderr);
			console.info(result.stdout);
		} catch (e) {
			throw new Error(
				`failed to run ${line} with ${e} -- make sure you have inkscape installed and in your PATH`
			);
		}

		const fileName =
			out === undefined
				? ((await page.title()).trim() || page.url()).replace(
						// https://github.com/zemn-me/monorepo/security/code-scanning/1
						// All non-letter unicode bits.
						// nodejs is not really aware of what parts of the path
						// are dangerous.
						/\P{L}/gu,
						'_'
					) + '.svg'
				: out;

		const svgContents = (await readFile(svgFile, 'utf8')).toString();

		if (svgContents.length === 0) {
			throw new Error('Failed to generate SVG.');
		}

		const optimSvg = await svgo.optimize(svgContents, {
			multipass: true,
			path: svgFile,
		});

		if (!optimSvg.data) {
			throw new Error('Failed to optimize SVG.');
		}

		console.warn(
			`writing ${i + 1}/${args.length} ${fileName} (${width} x ${height})`
		);

		await writeFile(fileName, optimSvg.data);

		cleanup();

		return fileName;
	});

	for await (const filepath of captures) {
		console.info('Wrote', filepath);
	}

	if (!headful) await browser.close();
};

export default main;
