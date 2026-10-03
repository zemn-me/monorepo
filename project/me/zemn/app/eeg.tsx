'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { DreamTable } from '#root/project/me/zemn/app/dream.js';

const externalTriggers = [
	{
		word: 'goose',
		target: 'https://www.tiktok.com/@antonellamollica2.0/video/7308687953851632928?_r=1&_t=8jeNrsOARhR&social_sharing=1',
	},
	{
		word: 'horse',
		target: 'https://vm.tiktok.com/ZNd8cR2Mc',
	},
] as const;

const triggerLength = Math.max(
	'dream'.length,
	...externalTriggers.map(trigger => trigger.word.length)
);

type DreamState = 'closed' | 'dreaming' | 'waking';

function acceptsSecretWords(target: EventTarget | null) {
	return !(
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
	);
}

export function Eeg() {
	const typed = useRef('');
	const wakeTimer = useRef<number>();
	const [dreamState, setDreamState] = useState<DreamState>('closed');

	const enterDream = useCallback(() => {
		window.clearTimeout(wakeTimer.current);
		setDreamState('dreaming');
	}, []);

	const wake = useCallback(() => {
		setDreamState('waking');
		window.clearTimeout(wakeTimer.current);
		wakeTimer.current = window.setTimeout(
			() => setDreamState('closed'),
			900
		);
	}, []);

	useEffect(() => {
		if (dreamState === 'closed') {
			delete document.documentElement.dataset.dreamState;
			return;
		}
		document.documentElement.dataset.dreamState = dreamState;
		return () => {
			delete document.documentElement.dataset.dreamState;
		};
	}, [dreamState]);

	useEffect(
		() => () => {
			window.clearTimeout(wakeTimer.current);
			delete document.documentElement.dataset.dreamState;
		},
		[]
	);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (
				dreamState !== 'closed' ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.key.length !== 1 ||
				!acceptsSecretWords(event.target)
			) {
				return;
			}

			typed.current = `${typed.current}${event.key.toLowerCase()}`.slice(
				-triggerLength
			);
			if (typed.current.endsWith('dream')) {
				typed.current = '';
				enterDream();
				return;
			}
			for (const trigger of externalTriggers) {
				if (typed.current.endsWith(trigger.word)) {
					typed.current = '';
					window.open(trigger.target, '_blank');
					return;
				}
			}
		};

		window.addEventListener('keyup', onKey);
		return () => window.removeEventListener('keyup', onKey);
	}, [dreamState, enterDream]);

	if (dreamState === 'closed') return null;
	return createPortal(
		<DreamTable leaving={dreamState === 'waking'} onWake={wake} />,
		document.body
	);
}
