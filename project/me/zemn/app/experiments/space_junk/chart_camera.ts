import { parseAsBoolean, useQueryState, useQueryStates } from 'nuqs';
import {
	type KeyboardEvent,
	type PointerEvent,
	useCallback,
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { boundedNumber } from './chart_query.js';
import type { Marker } from './globe_geometry.js';
import { height, width } from './globe_scene.js';
import { degrees } from './zodiac.js';

export const defaultTurn = 12;
export const flat = { turn: defaultTurn, tilt: 90, panX: 0, panY: 0 };
export type Camera = typeof flat;
export type PickMarker = (point: {
	x: number;
	y: number;
}) => Marker | undefined;
const clamp = (n: number, limit: number) =>
	Math.max(-limit, Math.min(limit, n));
export const wrap = (turn: number) => degrees(turn + 180) - 180;
const revolutionMs = 120_000;

// Ease symmetrically into the disc near either pole.
export const orbitalTiltLimit = 60;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
function orbitalBlend(tilt: number) {
	const t = Math.min(1, (90 - Math.abs(tilt)) / (90 - orbitalTiltLimit));
	return smoothstep(t);
}

const poseParams = {
	turn: boundedNumber(-180, 180).withDefault(flat.turn),
	tilt: boundedNumber(-90, 90).withDefault(flat.tilt),
	panX: boundedNumber(-width / 2, width / 2).withDefault(0),
	panY: boundedNumber(-height / 2, height / 2).withDefault(0),
};
const spinParam = parseAsBoolean.withDefault(true);
export function useChartCamera() {
	const [pose, setPose] = useQueryStates(poseParams, {
		urlKeys: { turn: 'rotation' },
	});
	const saved = useRef<Camera | null>(null);
	const savePose = useCallback(
		(next: Camera) => {
			saved.current = next;
			void setPose(next);
		},
		[setPose]
	);
	const svg = useRef<SVGSVGElement>(null);
	const [camera, render] = useState(pose);
	const latest = useRef(pose);
	const frame = useRef<number | null>(null);
	const settleFrame = useRef<number | null>(null);
	const rangePointers = useRef(new Set<number>());
	const resumeAt = useRef(0);
	const fingers = useRef(new Map<number, { x: number; y: number }>());
	const drag = useRef<{
		x: number;
		y: number;
		camera: Camera;
		pan: boolean;
		moved: boolean;
	} | null>(null);
	const [spin, setAutoRotate] = useQueryState('spin', spinParam);
	function setSpin(enabled: boolean) {
		savePose(latest.current);
		void setAutoRotate(enabled);
	}
	const faceOn = Math.abs(camera.tilt) === 90;
	const unfold = orbitalBlend(camera.tilt);
	const orbiting = unfold === 1;

	const stopSettling = useCallback(() => {
		if (settleFrame.current !== null)
			cancelAnimationFrame(settleFrame.current);
		settleFrame.current = null;
	}, []);

	function settle(delay = 0) {
		stopSettling();
		const start = latest.current.tilt;
		const blend = orbitalBlend(start);
		if (
			blend === 0 ||
			blend === 1 ||
			fingers.current.size ||
			rangePointers.current.size
		)
			return;
		const target = Math.sign(start) * (blend < 0.5 ? 90 : orbitalTiltLimit);
		const since = performance.now() + delay;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		function tick(now: number) {
			if (now >= since) {
				const t = motion.matches
					? 1
					: Math.min(1, (now - since) / 1000);
				latest.current = {
					...latest.current,
					tilt:
						t === 1
							? target
							: start + (target - start) * smoothstep(t),
				};
				render(latest.current);
				if (t === 1) {
					savePose(latest.current);
					settleFrame.current = null;
					return;
				}
			}
			settleFrame.current = requestAnimationFrame(tick);
		}
		settleFrame.current = requestAnimationFrame(tick);
	}

	const settleRestoredPose = useEffectEvent(() => settle());
	// Restore an incoming link or history entry without feeding animation frames back into the URL.
	useLayoutEffect(() => {
		const previous = saved.current;
		if (
			previous &&
			pose.turn === previous.turn &&
			pose.tilt === previous.tilt &&
			pose.panX === previous.panX &&
			pose.panY === previous.panY
		)
			return;
		stopSettling();
		if (frame.current !== null) cancelAnimationFrame(frame.current);
		frame.current = null;
		saved.current = latest.current = pose;
		render(pose);
		settleRestoredPose();
	}, [pose, stopSettling]);

	// Keys accumulate and absolute drags replace the target, including between paints.
	const move = useCallback(
		(next: Camera) => {
			stopSettling();
			resumeAt.current = performance.now() + 1500;
			latest.current = next;
			frame.current ??= requestAnimationFrame(() => {
				frame.current = null;
				render(latest.current);
				savePose(latest.current);
			});
		},
		[stopSettling, savePose]
	);
	useEffect(
		() => () => {
			stopSettling();
			if (frame.current !== null) cancelAnimationFrame(frame.current);
			frame.current = null;
		},
		[stopSettling]
	);

	useEffect(() => {
		if (!spin || !orbiting) return;
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let visible = false;
		let animation: number | undefined;
		let last: number | undefined;
		function tick(now: number) {
			animation = requestAnimationFrame(tick);
			if (
				fingers.current.size ||
				rangePointers.current.size ||
				now < resumeAt.current ||
				Math.abs(latest.current.tilt) > orbitalTiltLimit
			) {
				last = undefined;
				return;
			}
			last ??= now;
			const elapsed = now - last;
			// The SVG world is reprojected for every camera change. At this
			// speed 30 samples/second move the coastline by a fraction of a pixel.
			if (elapsed < 1000 / 30 - 1) return;
			last = now;
			const next = latest.current;
			latest.current = {
				...next,
				turn: wrap(next.turn + (elapsed * 360) / revolutionMs),
			};
			render(latest.current);
		}
		function sync() {
			if (animation !== undefined) cancelAnimationFrame(animation);
			last = undefined;
			animation =
				visible && !document.hidden && !motion.matches
					? requestAnimationFrame(tick)
					: undefined;
		}
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry?.isIntersecting ?? false;
			sync();
		});
		observer.observe(svg.current!);
		motion.addEventListener('change', sync);
		document.addEventListener('visibilitychange', sync);
		return () => {
			observer.disconnect();
			motion.removeEventListener('change', sync);
			document.removeEventListener('visibilitychange', sync);
			if (animation !== undefined) cancelAnimationFrame(animation);
		};
	}, [orbiting, spin]);

	function center() {
		const [a, b] = fingers.current.values();
		return b ? { x: (a!.x + b.x) / 2, y: (a!.y + b.y) / 2 } : a!;
	}
	function pointerDown(e: PointerEvent<SVGSVGElement>) {
		if (
			e.button !== 0 ||
			fingers.current.size >= 2 ||
			(!e.isPrimary && e.pointerType !== 'touch')
		)
			return;
		stopSettling();
		fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
		const two = fingers.current.size === 2;
		drag.current = {
			...center(),
			camera: latest.current,
			pan: e.shiftKey || two,
			moved: two,
		};
		e.currentTarget.setPointerCapture(e.pointerId);
	}
	function pointerMove(e: PointerEvent<SVGSVGElement>) {
		const start = drag.current;
		if (!start || !fingers.current.has(e.pointerId)) return;
		fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
		const pos = center();
		const dx = pos.x - start.x,
			dy = pos.y - start.y;
		if (!start.moved && Math.hypot(dx, dy) < 4) return;
		start.moved = true;
		const scale = width / e.currentTarget.getBoundingClientRect().width;
		const v = start.camera;
		if (start.pan) {
			move({
				...v,
				panX: clamp(v.panX + dx * scale, width / 2),
				panY: clamp(v.panY + dy * scale, height / 2),
			});
		} else {
			const delta = dy * scale * 0.5;
			const tilt =
				v.tilt === 90
					? 90 - Math.abs(delta)
					: v.tilt === -90
						? -90 + Math.abs(delta)
						: v.tilt - delta;
			move({
				...v,
				turn: wrap(v.turn - dx * scale * 0.6),
				tilt: clamp(tilt, 90),
			});
		}
	}
	function endPointer(e: PointerEvent<SVGSVGElement>) {
		if (!fingers.current.delete(e.pointerId)) return;
		resumeAt.current = performance.now() + 1500;
		drag.current = fingers.current.size
			? { ...center(), camera: latest.current, pan: false, moved: true }
			: null;
		settle();
	}
	function pointerUp(e: PointerEvent<SVGSVGElement>, pick: PickMarker) {
		if (!fingers.current.has(e.pointerId)) return;
		pointerMove(e);
		const tap = !drag.current?.moved;
		endPointer(e);
		const v = latest.current;
		const transform = e.currentTarget.getScreenCTM();
		if (tap && transform) {
			const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
				transform.inverse()
			);
			return pick({ x: p.x - v.panX, y: p.y - v.panY });
		}
	}
	function keyDown(e: KeyboardEvent<SVGSVGElement>) {
		if (e.key === 'Home') {
			e.preventDefault();
			move({ ...flat, turn: latest.current.turn });
			return;
		}
		const dx =
			Number(e.key === 'ArrowRight') - Number(e.key === 'ArrowLeft');
		const dy = Number(e.key === 'ArrowUp') - Number(e.key === 'ArrowDown');
		if (!dx && !dy) return;
		e.preventDefault();
		const v = latest.current;
		move(
			e.shiftKey
				? {
						...v,
						panX: clamp(v.panX + dx * 12, width / 2),
						panY: clamp(v.panY - dy * 12, height / 2),
					}
				: {
						...v,
						turn: wrap(v.turn + dx * 5),
						tilt: clamp(v.tilt + dy * 5, 90),
					}
		);
	}
	function grabRuler(id: number) {
		stopSettling();
		rangePointers.current.add(id);
	}
	function releaseRuler(id: number) {
		if (rangePointers.current.delete(id)) settle();
	}

	return {
		svg,
		camera,
		move,
		faceOn,
		unfold,
		spin,
		setSpin,
		pointerDown,
		pointerMove,
		pointerUp,
		endPointer,
		keyDown,
		grabRuler,
		releaseRuler,
		readCamera: () => latest.current,
		keyUp(e: KeyboardEvent) {
			// Leave time for successive arrow taps on the one-degree tilt ruler.
			if (
				e.key.startsWith('Arrow') ||
				['Home', 'End', 'PageUp', 'PageDown'].includes(e.key)
			)
				settle(250);
		},
		settle,
	};
}
