import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import mime from 'mime';
import puppeteer, { ConsoleMessage, HTTPRequest } from 'puppeteer';
import { isNotNull, must } from 'ts/guard';

const basepath = 'project/zemn.me/next/out';

interface ResponseWithBody {
	code: number;
	body: string | Buffer;
	contentType: string;
}

interface ResponseWithNoBody {
	code: number;
	body?: undefined;
	contentType?: undefined;
}

type Response = ResponseWithBody | ResponseWithNoBody;

const errCodeMap = {
	[os.constants.errno.EACCES]: 401,
	[os.constants.errno.EISDIR]: 404,
	[os.constants.errno.ENOENT]: 404,
	[os.constants.errno.EPERM]: 401,
};

const errNoToHttp = (errNo: number) =>
	errNo in errCodeMap ? errCodeMap[errNo] : 500;

const fileServer =
	(basePath: string) =>
	async (r: HTTPRequest): Promise<Response> => {
		const filePath = path.relative(basePath, new URL(r.url()).pathname);

		let file: fs.FileHandle | undefined;
		let error: Error | undefined;
		try {
			file = await fs.open(filePath);
		} catch (e) {
			if (e instanceof Error) {
				error = e;
			} else throw e;
		}

		if (error === undefined) {
			if (file === undefined) throw new Error('this should never happen');
			return {
				code: 200, // OK
				body: (await file.read()).buffer,
				contentType: must(isNotNull)(mime.getType(filePath)),
			};
		}

		// it's possible that the error follows the node 'standard format'.
		if (!('code' in error) || typeof error.code !== 'number') {
			throw error;
		}

		console.log(error);

		return {
			code: errNoToHttp(error.code),
		};
	};

function server(f: (r: HTTPRequest) => Promise<Response>) {
	return async (r: HTTPRequest): Promise<void> => r.respond(await f(r));
}

test('smoke', async () => {
	const browser = await puppeteer.launch();

	const page = await browser.newPage();

	await page.setRequestInterception(true);

	page.on('request', async r => {
		const u = new URL(r.url());
		if (u.origin !== 'https://zemn.me') return r.continue();

		await server(fileServer(basepath))(r);
	});

	const consoleMessages: ConsoleMessage[] = [];

	page.on('console', e => {
		consoleMessages.push(e);
	});

	await page.goto('https://zemn.me');

	await page.waitForNavigation();

	expect(consoleMessages.map(v => `${v.type()}: ${v.text}`).join('')).toEqual(
		''
	);
});
