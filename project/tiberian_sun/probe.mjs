// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 Thomas Shadwell

import createProbe from './lcw_probe.js';

const button = document.querySelector('#run');
const source = document.querySelector('#source');
const result = document.querySelector('#result');

try {
    const probe = await createProbe();
    result.textContent = 'WebAssembly ready.';
    button.disabled = false;
    button.addEventListener('click', () => {
        const bytes = new TextEncoder().encode(source.value);
        if (bytes.length === 0 || bytes.length > probe._input_capacity()) {
            result.textContent = `Enter between 1 and ${probe._input_capacity()} UTF-8 bytes.`;
            return;
        }
        probe.HEAPU8.set(bytes, probe._input_data());
        const size = probe._round_trip(bytes.length);
        if (size !== bytes.length) {
            result.textContent = `Round trip failed (${size}).`;
            return;
        }
        const decoded = probe.HEAPU8.slice(probe._decoded_data(), probe._decoded_data() + size);
        result.textContent = `${size} bytes → ${probe._compressed_size()} compressed bytes → ${size} bytes.\nRecovered: ${new TextDecoder().decode(decoded)}`;
    });
} catch (error) {
    result.textContent = `Could not load WebAssembly: ${error.message}`;
}
