import fs from 'node:fs/promises';
import { describe, expect, test } from '@jest/globals';

import { parseAnkiPackage } from '#root/ts/anki/anki.js';

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
	return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function u16(bytes: Uint8Array, offset: number): number {
	return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
	return (
		bytes[offset]! |
		(bytes[offset + 1]! << 8) |
		(bytes[offset + 2]! << 16) |
		(bytes[offset + 3]! << 24)
	);
}

describe('pitch training Anki packages', () => {
	test('preview parser extracts valid WAV media from the generated deck', async () => {
		const bytes = await fs.readFile(
			'project/me/zemn/app/experiments/pitch_training/pitch_classes.apkg'
		);
		const deck = await parseAnkiPackage(arrayBuffer(bytes));
		const firstCard = deck.cards[0]!;
		expect(firstCard.audio?.fileName).toBe('pitch_C4_midi_60.wav');
		expect(firstCard.audio?.mimeType).toBe('audio/wav');
		expect(firstCard.audio).not.toBeNull();

		const audio = firstCard.audio!.bytes;
		expect(ascii(audio, 0, 4)).toBe('RIFF');
		expect(ascii(audio, 8, 4)).toBe('WAVE');
		expect(ascii(audio, 12, 4)).toBe('fmt ');
		expect(u16(audio, 20)).toBe(1);
		expect(u16(audio, 22)).toBe(1);
		expect(u32(audio, 24)).toBe(44_100);
		expect(u16(audio, 34)).toBe(16);
		expect(ascii(audio, 36, 4)).toBe('data');
		expect(u32(audio, 40)).toBeGreaterThan(0);
	});
});
