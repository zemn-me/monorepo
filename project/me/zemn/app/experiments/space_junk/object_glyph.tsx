import type { SpaceObject } from './chart.js';

export function ObjectGlyph({ object }: { object: SpaceObject }) {
	const paths = {
		P: 'M-3 -4H3V4H-3Z M-10 -3H-5V3H-10Z M5 -3H10V3H5Z M-5 0H-3 M3 0H5',
		D: 'M-9 -4 1 -9 8 -3 4 6 -4 9Z M-9 -4 0 -1 1 -9 M0 -1 4 6 M0 -1 -4 9',
		C:
			object.id === 29257
				? 'M-6 -9H2V-2Q2 0 -1 1L-1 9H-3V1Q-6 0 -6 -2Z M-4 -7V-3 M-1 -7V-3'
				: 'M-8 -4 -2 -8 8 -3 8 4 2 8 -8 3Z M-8 -4 2 1 8 -3 M2 1V8',
		R: 'M-4 -7Q0 -10 4 -7V5H-4Z M-4 -5Q0 -3 4 -5 M-4 3H4 M-2 5 -4 9H4L2 5',
	};
	return (
		<svg aria-hidden="true" height="26" viewBox="-13 -13 26 26" width="26">
			<path
				d={paths[object.kind]}
				fill="none"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth="1.35"
				transform="rotate(-23)"
			/>
		</svg>
	);
}
