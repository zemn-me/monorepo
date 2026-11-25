import { useEffect, useMemo, useRef, useState } from 'react';

export interface TimeScale {
	min: number;
	max: number;
	position: (instant: number) => number;
	instant: (position: number) => number;
}

const milliseconds: TimeScale = {
	min: -Infinity,
	max: Infinity,
	position: time => time,
	instant: time => time,
};

export function useRulerClock(initial: number) {
	const [instant, publish] = useState(initial);
	const last = useRef(initial);
	const pending = useRef<{
		scale: TimeScale;
		position: number;
		frame: number;
	} | null>(null);
	const clock = useMemo(() => {
		function read() {
			const target = pending.current;
			return target
				? target.scale.instant(target.position)
				: last.current;
		}
		function cancel() {
			if (pending.current) cancelAnimationFrame(pending.current.frame);
			pending.current = null;
		}
		function commit(time: number) {
			cancel();
			last.current = time;
			publish(time);
		}
		return {
			read,
			cancel,
			commit,
			position(scale: TimeScale) {
				return pending.current?.scale === scale
					? pending.current.position
					: scale.position(read());
			},
			seek(position: number, scale = milliseconds) {
				// Retain one target in the active ruler's units. Wheel deltas add
				// to it and pointer moves replace it before the next paint.
				const frame =
					pending.current?.frame ??
					requestAnimationFrame(() => {
						const time = read();
						pending.current = null;
						commit(time);
					});
				pending.current = {
					frame,
					scale,
					position: Math.max(
						scale.min,
						Math.min(scale.max, position)
					),
				};
			},
		};
	}, []);
	useEffect(() => clock.cancel, [clock]);
	return { instant, clock };
}

export type RulerClock = ReturnType<typeof useRulerClock>['clock'];
