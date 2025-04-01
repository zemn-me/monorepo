/* eslint-disable comma-spacing */
'use client';

import { useCallback, useEffect, useMemo } from 'react';

const indexModulo =
	<T,>(A: T[]) =>
	(at: number) =>
		at % A.length;

export function Eeg() {
	// Define triggers for "goose" and "horse"
	const triggers = useMemo(() => [
		{
			word: [...'goose'],
			target: 'https://www.tiktok.com/@antonellamollica2.0/video/7308687953851632928?_r=1&_t=8jeNrsOARhR&social_sharing=1'
		},
		{
			word: [...'horse'],
			target: 'https://vm.tiktok.com/ZNd8cR2Mc'
		}
	], []);

	// Use the maximum length of the trigger words for the circular buffer
	const bufferLength = Math.max(...triggers.map(trigger => trigger.word.length));
	const buffer: string[] = useMemo(() => Array(bufferLength), [bufferLength]);
	let cursor: number = 0;

	const onKey = useCallback(
		(v: KeyboardEvent) => {
			buffer[indexModulo(buffer)(cursor++)] = v.key;

			triggers.forEach(trigger => {
				// Only check if the key matches the last character of the trigger word
				if (v.key !== trigger.word[trigger.word.length - 1]) return;
				// Check if the sequence matches
				for (let i = cursor - trigger.word.length, k = 0; i < cursor; i++, k++) {
					if (buffer[indexModulo(buffer)(i)] !== trigger.word[k]) return;
				}
				window.open(trigger.target, '_blank');
			});
		},
		[buffer, triggers]
	);

	useEffect(() => {
		window.addEventListener('keyup', onKey);
		return () => window.removeEventListener('keyup', onKey);
	}, [onKey]);

	return <></>;
}
