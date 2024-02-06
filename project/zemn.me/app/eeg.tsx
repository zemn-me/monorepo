/* eslint-disable comma-spacing */
'use client';

import { useCallback, useEffect, useMemo } from 'react';

/**
 * Get an item at an index in an array.
 *
 * Loops around instead of overflowing.
 */
const indexModulo =
	<T,>(A: T[]) =>
	(at: number) =>
		at % A.length;

const gooseTarget =
	'https://www.tiktok.com/@antonellamollica2.0/video/7308687953851632928?_r=1&_t=8jeNrsOARhR&social_sharing=1';

export function Eeg() {
	const toMatch = useMemo(() => [...'goose'], []);
	const buffer: string[] = useMemo(() => Array(toMatch.length), [toMatch]);
	let cursor: number = 0;

	const onGoose = useCallback(
		(v: KeyboardEvent) => {
			buffer[indexModulo(buffer)(cursor++)] = v.key;

			if (v.key != toMatch[toMatch.length - 1]) return;
			// walk backwards to see if we just typed 'goose'

			for (let i = cursor - toMatch.length, k = 0; i < cursor; i++, k++) {
				if (buffer[indexModulo(buffer)(i)] != toMatch[k]) return;
			}

			window.open(gooseTarget, '_blank');
		},
		[buffer, cursor, toMatch]
	);

	useEffect(() => {
		window.addEventListener('keyup', onGoose);

		return () => window.removeEventListener('keyup', onGoose);
	}, [onGoose]);

	return <></>;
}
