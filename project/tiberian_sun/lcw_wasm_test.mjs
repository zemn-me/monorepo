// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 Thomas Shadwell

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import createProbe from './lcw_probe.js';

const wasmBinary = await readFile(new URL('./lcw_probe.wasm', import.meta.url));
const probe = await createProbe({ wasmBinary });
const capacity = probe._input_capacity();

function roundTrip(input) {
    probe.HEAPU8.set(input, probe._input_data());
    assert.equal(probe._round_trip(input.length), input.length);
    assert.deepEqual(
        probe.HEAPU8.slice(probe._decoded_data(), probe._decoded_data() + input.length),
        input,
    );
    const size = probe._compressed_size();
    assert.ok(size > 0 && size <= input.length + Math.floor(input.length / 4) + Math.floor(input.length / 128) + 4);
    return probe.HEAPU8.slice(probe._compressed_data(), probe._compressed_data() + size);
}

test('loads and executes compiled OpenTS code with a known LCW literal vector', () => {
    assert.deepEqual(roundTrip(new Uint8Array([65])), new Uint8Array([0x81, 65, 0x80]));
});

test('preserves binary data at literal, run, and maximum buffer boundaries', () => {
    for (const length of [1, 2, 3, 63, 64, 65, 255, 256, 8192, capacity]) {
        roundTrip(new Uint8Array(length));
        roundTrip(Uint8Array.from({ length }, (_, i) => i % 256));
        let state = 0x12345678;
        roundTrip(Uint8Array.from({ length }, () => {
            state ^= state << 13;
            state ^= state >>> 17;
            state ^= state << 5;
            return state & 255;
        }));
    }
});

test('compresses repetitive text and preserves UTF-8 bytes', () => {
    const bytes = new TextEncoder().encode('Tiberium grows. 火 🌱 '.repeat(100));
    assert.ok(roundTrip(bytes).length < bytes.length);
});

test('rejects invalid sizes and clears stale output length', () => {
    for (const length of [0, -1, capacity + 1, 2147483647]) {
        roundTrip(new Uint8Array([42]));
        assert.equal(probe._round_trip(length), -1);
        assert.equal(probe._compressed_size(), 0);
    }
});
