import { afterEach, expect, it } from '@jest/globals';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { useJournalAudio } from './use_journal_audio.js';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
	configurable: true,
	value: true,
});

function Player({ capturing = false }: { readonly capturing?: boolean }) {
	return <audio ref={useJournalAudio(capturing)} />;
}

afterEach(() => {
	Reflect.deleteProperty(navigator, 'audioSession');
});

it('uses ambient playback and yields the audio session to microphone capture', async () => {
	const session = { type: 'auto' };
	Object.defineProperty(navigator, 'audioSession', {
		configurable: true,
		value: session,
	});
	const container = document.createElement('div');
	const root = createRoot(container);
	await act(() => root.render(<Player />));
	const audio = container.querySelector('audio')!;
	expect(session.type).toBe('ambient');
	expect(audio.muted).toBe(false);

	await act(() => root.render(<Player capturing />));
	expect(session.type).toBe('auto');
	expect(audio.muted).toBe(true);

	await act(() => root.render(<Player />));
	expect(session.type).toBe('ambient');
	expect(audio.muted).toBe(false);

	await act(() => root.unmount());
	expect(session.type).toBe('auto');
	expect(audio.muted).toBe(true);
});

it('keeps the player available in browsers without audio sessions', async () => {
	const container = document.createElement('div');
	const root = createRoot(container);
	await act(() => root.render(<Player />));
	expect(container.querySelector('audio')?.muted).toBe(false);
	await act(() => root.unmount());
});
