import { StringDecoder } from 'node:string_decoder';

/**
 * Drink bytes from the Readable, returning each line.
 */
export async function* byLine(r: AsyncIterable<string | Buffer>) {
	const decoder = new StringDecoder('utf8');
	let pending = '';
	for await (const chunk of r) {
		const lines = (pending + decoder.write(Buffer.from(chunk))).split(/\r?\n/g);
		pending = lines.pop() ?? '';
		yield* lines;
	}
	pending += decoder.end();
	if (pending.length !== 0) yield pending;
}

