import puppeteer from 'puppeteer';
import * as tmp from 'tmp';
import { exec } from 'child_process';
import * as svgo from 'svgo';
import { writeFile, readFile } from 'fs/promises';
import { promisify } from 'util';
import { Command } from 'commander';

const program = new Command()
	.name('svgshot')
	.usage('<url>')
	.description(
		'take svg screenshots of webpages. requires the inkscape cli tool'
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
		'--out',
		'manually specify an output file name -- this fails if multiple URLs are to be recorded',
		undefined
	)
	.option(
		'--inkscapeBin',
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

const main = async (argv: string[] = process.argv) => {
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
		throw new Error('Out file specified and more than one URL to load.');
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

		const [pdfFile, svgFile] = await Promise.all(
			['.pdf', '.svg'].map(async (extension): Promise<string> => {
				return new Promise((ok, err) => {
					tmp.file({ postfix: extension }, (error, path) => {
						if (error) return err(error);
						return ok(path);
					});
				});
			})
		);

		await writeFile(pdfFile, pdf);

		const line = `${inkscapeBin} --without-gui ${pdfFile} --export-plain-svg ${svgFile}`;
		try {
			await promisify(exec)(line);
		} catch (e) {
			throw new Error(
				`failed to run ${line} with ${e} -- make sure you have inkscape installed and in your PATH`
			);
		}

		const title =
			out === undefined
				? ((await page.title()).trim() || page.url()).replace(
						/[^A-z_-]/g,
						'_'
				  )
				: out;

		const fileName = title + '.svg';

		const svgContents = await readFile(svgFile, 'utf8');
		const optimSvg = await svgo.optimize(svgContents.toString(), {
			path: svgFile,
		});

		if (optimSvg.error !== undefined) throw optimSvg.modernError;

		console.warn(
			`writing ${i + 1}/${args.length} ${fileName} (${width} x ${height})`
		);

		await writeFile(fileName, optimSvg.data);

		return fileName;
	});

	for await (const filepath of captures) {
		console.info('Wrote', filepath);
	}

	if (!headful) await browser.close();
};

export default main;
