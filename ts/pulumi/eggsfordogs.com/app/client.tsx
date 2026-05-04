"use client";

import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import {
	initialMovementKeys,
	type JoystickInput,
	lookAngleDeltaFromJoystick,
	movementInputFromControls,
	type MovementKeyState,
	normalizeJoystickOffset,
} from '#root/ts/joystick/index.js';
import { point, x, y, z } from '#root/ts/math/cartesian.js';
import { perspective, projectWorldPoint, renderSegments } from '#root/ts/math/wireframe_render.js';
import {
	buildWorld,
	DEFAULT_POSE,
	isFacingPose,
	type Particle,
	ParticleType,
	type PlayerPose,
	stepCritters,
	stepLook,
	stepPlayer,
} from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';
import { noop } from '#root/ts/noop.js';

const INITIAL_VIEWPORT_WIDTH = 1280;
const INITIAL_VIEWPORT_HEIGHT = 720;
const JOYSTICK_RADIUS_PX = 36;
const LOOK_JOYSTICK_SPEED = 2.2;

type LegacyMediaQueryList = MediaQueryList & {
	addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
	removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function icon(type: ParticleType): string { return type === ParticleType.Egg ? '🥚' : '🐕'; }

export function EggDogYardClient() {
	const world = useMemo(() => buildWorld(), []);
	const viewportRef = useRef<SVGSVGElement | null>(null);
	const poseRef = useRef<PlayerPose>(DEFAULT_POSE);
	const keysRef = useRef<MovementKeyState>(initialMovementKeys());
	const crittersRef = useRef<Particle[]>(world.critters);
	const dragPointerIdRef = useRef<number | null>(null);
	const lastDragRef = useRef<{ x: number; y: number } | null>(null);
	const moveJoystickPointerIdRef = useRef<number | null>(null);
	const moveJoystickInputRef = useRef<JoystickInput>({ x: 0, y: 0 });
	const lookJoystickPointerIdRef = useRef<number | null>(null);
	const lookJoystickInputRef = useRef<JoystickInput>({ x: 0, y: 0 });
	const frameRef = useRef<number | null>(null);
	const [viewport, setViewport] = useState({ width: INITIAL_VIEWPORT_WIDTH, height: INITIAL_VIEWPORT_HEIGHT });
	const [pose, setPose] = useState<PlayerPose>(DEFAULT_POSE);
	const [critters, setCritters] = useState<Particle[]>(world.critters);
	const [locked, setLocked] = useState(false);
	const [mobileControls, setMobileControls] = useState(false);
	const [moveJoystickInput, setMoveJoystickInput] = useState<JoystickInput>({ x: 0, y: 0 });
	const [lookJoystickInput, setLookJoystickInput] = useState<JoystickInput>({ x: 0, y: 0 });

	useEffect(() => {
		const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
		const syncMobileControls = () => {
			setMobileControls(coarsePointerQuery.matches);
		};
		syncMobileControls();
		const unsubscribeCoarsePointerChanges = (() => {
			if ('addEventListener' in coarsePointerQuery) {
				coarsePointerQuery.addEventListener('change', syncMobileControls);
				return () => {
					coarsePointerQuery.removeEventListener('change', syncMobileControls);
				};
			}

			const legacyCoarsePointerQuery = coarsePointerQuery as LegacyMediaQueryList;
			if (
				typeof legacyCoarsePointerQuery.addListener !== 'function' ||
				typeof legacyCoarsePointerQuery.removeListener !== 'function'
			) {
				return noop;
			}

			legacyCoarsePointerQuery.addListener(syncMobileControls);
			return () => {
				legacyCoarsePointerQuery.removeListener(syncMobileControls);
			};
		})();

		function syncViewport() {
			const bounds = viewportRef.current?.getBoundingClientRect();
			if (bounds == null) return;
			setViewport({
				width: Math.max(1, Math.round(bounds.width)),
				height: Math.max(1, Math.round(bounds.height)),
			});
		}

		function onPointerLockChange() {
			setLocked(document.pointerLockElement === viewportRef.current);
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.code in keysRef.current) {
				keysRef.current = { ...keysRef.current, [event.code]: true };
				event.preventDefault();
			}
		}

		function onKeyUp(event: KeyboardEvent) {
			if (event.code in keysRef.current) {
				keysRef.current = { ...keysRef.current, [event.code]: false };
			}
		}

		function onMouseMove(event: MouseEvent) {
			if (document.pointerLockElement !== viewportRef.current) return;
			const nextPose = stepLook(poseRef.current, event.movementX, event.movementY);
			poseRef.current = nextPose;
			setPose(nextPose);
		}

		let previous = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(0.05, (now - previous) / 1000); previous = now;
			const lookDelta = lookAngleDeltaFromJoystick(
				lookJoystickInputRef.current,
				dt,
				LOOK_JOYSTICK_SPEED
			);
			const lookedPose = !locked && (lookDelta.x !== 0 || lookDelta.y !== 0)
				? stepLook(poseRef.current, lookDelta.x, lookDelta.y, 1)
				: poseRef.current;
			const nextPose = stepPlayer(
				lookedPose,
				movementInputFromControls(keysRef.current, moveJoystickInputRef.current),
				dt
			);
			const nextCritters = stepCritters(crittersRef.current, dt, now / 1000);
			poseRef.current = nextPose;
			crittersRef.current = nextCritters;
			setPose(nextPose);
			setCritters(nextCritters);
			frameRef.current = requestAnimationFrame(loop);
		};

		document.addEventListener('pointerlockchange', onPointerLockChange);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('resize', syncViewport);
		syncViewport();
		frameRef.current = requestAnimationFrame(loop);

		return () => {
			document.removeEventListener('pointerlockchange', onPointerLockChange);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('resize', syncViewport);
			unsubscribeCoarsePointerChanges();
			if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
		};
	}, []);

	function lockPointer() {
		viewportRef.current?.focus();
		void viewportRef.current?.requestPointerLock();
	}

	function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
		viewportRef.current?.focus();
		if (event.pointerType === 'mouse') {
			lockPointer();
			return;
		}
		dragPointerIdRef.current = event.pointerId;
		lastDragRef.current = { x: event.clientX, y: event.clientY };
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
		if (locked || dragPointerIdRef.current !== event.pointerId) return;
		const last = lastDragRef.current;
		lastDragRef.current = { x: event.clientX, y: event.clientY };
		if (last == null) return;
		const nextPose = stepLook(
			poseRef.current,
			(event.clientX - last.x) * 1.35,
			(event.clientY - last.y) * 1.35
		);
		poseRef.current = nextPose;
		setPose(nextPose);
	}

	function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
		if (dragPointerIdRef.current === event.pointerId) {
			dragPointerIdRef.current = null;
			lastDragRef.current = null;
		}
	}

	function updateJoystickFromEvent(event: ReactPointerEvent<HTMLDivElement>) {
		const bounds = event.currentTarget.getBoundingClientRect();
		return normalizeJoystickOffset(
			event.clientX - (bounds.left + (bounds.width / 2)),
			event.clientY - (bounds.top + (bounds.height / 2)),
			JOYSTICK_RADIUS_PX
		);
	}

	function resetMoveJoystick() {
		const next = { x: 0, y: 0 };
		moveJoystickInputRef.current = next;
		setMoveJoystickInput(next);
	}

	function resetLookJoystick() {
		const next = { x: 0, y: 0 };
		lookJoystickInputRef.current = next;
		setLookJoystickInput(next);
	}

	function handleMoveJoystickPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		moveJoystickPointerIdRef.current = event.pointerId;
		event.currentTarget.setPointerCapture(event.pointerId);
		const next = updateJoystickFromEvent(event);
		moveJoystickInputRef.current = next;
		setMoveJoystickInput(next);
	}

	function handleMoveJoystickPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
		if (moveJoystickPointerIdRef.current !== event.pointerId) return;
		const next = updateJoystickFromEvent(event);
		moveJoystickInputRef.current = next;
		setMoveJoystickInput(next);
	}

	function handleMoveJoystickPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
		if (moveJoystickPointerIdRef.current !== event.pointerId) return;
		moveJoystickPointerIdRef.current = null;
		resetMoveJoystick();
	}

	function handleLookJoystickPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
		lookJoystickPointerIdRef.current = event.pointerId;
		event.currentTarget.setPointerCapture(event.pointerId);
		const next = updateJoystickFromEvent(event);
		lookJoystickInputRef.current = next;
		setLookJoystickInput(next);
	}

	function handleLookJoystickPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
		if (lookJoystickPointerIdRef.current !== event.pointerId) return;
		const next = updateJoystickFromEvent(event);
		lookJoystickInputRef.current = next;
		setLookJoystickInput(next);
	}

	function handleLookJoystickPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
		if (lookJoystickPointerIdRef.current !== event.pointerId) return;
		lookJoystickPointerIdRef.current = null;
		resetLookJoystick();
	}

	const projection = perspective(viewport.width, viewport.height, { focalScale: 0.75 });
	const segments = renderSegments(world.scene, pose, projection);
	const sprites = critters.map(critter => {
		const raised = point<3>(x(critter.position), 1.1, z(critter.position));
		const projected = projectWorldPoint(raised, pose, projection);
		if (projected == null) return null;
		const dx = x(raised) - x(pose.position);
		const dy = y(raised) - y(pose.position);
		const dz = z(raised) - z(pose.position);
		const distance = Math.hypot(dx, dy, dz);
		if (!isFacingPose(raised, pose)) return null;
		const size = Math.max(12, Math.min(72, 300 / distance));
		return { id: critter.id, emoji: icon(critter.type), projected, size, distance };
	}).filter(sprite => sprite != null).sort((a, b) => b.distance - a.distance);

	return <main style={{ background: '#d7e7c3', height: '100vh', overflow: 'hidden', position: 'relative' }}>
		<svg
			aria-label="Eggs for dogs yard"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			ref={viewportRef}
			style={{ display: 'block', height: '100vh', touchAction: 'none', width: '100vw' }}
			tabIndex={0}
			viewBox={`0 0 ${viewport.width} ${viewport.height}`}
		>
			<defs>
				<linearGradient id="yardSky" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor="#9bd5ff" />
					<stop offset="48%" stopColor="#f8e6a6" />
					<stop offset="100%" stopColor="#7faa52" />
				</linearGradient>
			</defs>
			<rect fill="url(#yardSky)" height={viewport.height} width={viewport.width} x={0} y={0} />
			{segments.map((segment, index) => <line key={`${index}:${segment.depth}`} opacity={segment.opacity} stroke={segment.stroke} strokeLinecap="round" strokeWidth={segment.width} x1={segment.x1} x2={segment.x2} y1={segment.y1} y2={segment.y2} />)}
			{sprites.map(sprite => <foreignObject height={sprite.size} key={sprite.id} width={sprite.size} x={x(sprite.projected) - (sprite.size / 2)} y={y(sprite.projected) - sprite.size}><div style={{ alignItems: 'center', display: 'flex', fontSize: `${sprite.size}px`, height: '100%', justifyContent: 'center', width: '100%' }}>{sprite.emoji}</div></foreignObject>)}
			<line stroke="#3b3326" strokeLinecap="round" strokeWidth={1.5} x1={(viewport.width / 2) - 12} x2={(viewport.width / 2) + 12} y1={viewport.height / 2} y2={viewport.height / 2} />
			<line stroke="#3b3326" strokeLinecap="round" strokeWidth={1.5} x1={viewport.width / 2} x2={viewport.width / 2} y1={(viewport.height / 2) - 12} y2={(viewport.height / 2) + 12} />
		</svg>
		<div style={{ display: 'flex', gap: '0.65rem', left: '1rem', position: 'absolute', top: '1rem' }}>
			<button onClick={lockPointer} style={{ background: '#fff7d6', border: '1px solid rgb(59 51 38 / 24%)', borderRadius: '6px', color: '#3b3326', cursor: 'pointer', font: '700 0.82rem system-ui, sans-serif', padding: '0.65rem 0.8rem' }} type="button">
				{locked ? 'Pointer locked' : 'Enter yard'}
			</button>
			<div style={{ background: 'rgb(255 247 214 / 82%)', border: '1px solid rgb(59 51 38 / 18%)', borderRadius: '6px', color: '#3b3326', font: '600 0.82rem system-ui, sans-serif', padding: '0.65rem 0.8rem' }}>
				{mobileControls ? 'Sticks to roam and look' : 'WASD to roam'}
			</div>
		</div>
		{mobileControls ? (
			<div style={{ alignItems: 'flex-end', bottom: '1rem', display: 'flex', justifyContent: 'space-between', left: '1rem', pointerEvents: 'none', position: 'absolute', right: '1rem' }}>
				<div
					onPointerCancel={handleMoveJoystickPointerEnd}
					onPointerDown={handleMoveJoystickPointerDown}
					onPointerMove={handleMoveJoystickPointerMove}
					onPointerUp={handleMoveJoystickPointerEnd}
					style={{ backdropFilter: 'blur(10px)', background: 'radial-gradient(circle at center, rgb(255 244 197 / 36%) 0, rgb(255 244 197 / 22%) 34%, rgb(110 140 72 / 44%) 70%, rgb(76 103 45 / 58%) 100%)', border: '1px solid rgb(59 51 38 / 18%)', borderRadius: '999px', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 18%), 0 0.8rem 1.8rem rgb(0 0 0 / 12%)', height: '5.5rem', pointerEvents: 'auto', position: 'relative', touchAction: 'none', width: '5.5rem' }}
				>
					<div style={{ background: 'rgb(255 250 229 / 28%)', border: '1px solid rgb(59 51 38 / 14%)', borderRadius: '999px', height: '1.2rem', left: '50%', marginLeft: '-0.6rem', marginTop: '-0.6rem', position: 'absolute', top: '50%', width: '1.2rem' }} />
					<div style={{ background: 'linear-gradient(180deg, rgb(255 251 239 / 94%) 0%, rgb(242 213 127 / 82%) 100%)', border: '1px solid rgb(59 51 38 / 24%)', borderRadius: '999px', boxShadow: '0 0.35rem 0.8rem rgb(0 0 0 / 20%), inset 0 0 0 1px rgb(255 255 255 / 35%)', height: '2.35rem', left: '50%', marginLeft: '-1.175rem', marginTop: '-1.175rem', position: 'absolute', top: '50%', transform: `translate(${moveJoystickInput.x * JOYSTICK_RADIUS_PX}px, ${moveJoystickInput.y * JOYSTICK_RADIUS_PX}px)`, width: '2.35rem' }} />
				</div>
				<div
					onPointerCancel={handleLookJoystickPointerEnd}
					onPointerDown={handleLookJoystickPointerDown}
					onPointerMove={handleLookJoystickPointerMove}
					onPointerUp={handleLookJoystickPointerEnd}
					style={{ backdropFilter: 'blur(10px)', background: 'radial-gradient(circle at center, rgb(190 236 255 / 34%) 0, rgb(190 236 255 / 20%) 34%, rgb(130 166 124 / 40%) 70%, rgb(79 112 84 / 54%) 100%)', border: '1px solid rgb(59 51 38 / 18%)', borderRadius: '999px', boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 18%), 0 0.8rem 1.8rem rgb(0 0 0 / 12%)', height: '5.5rem', pointerEvents: 'auto', position: 'relative', touchAction: 'none', width: '5.5rem' }}
				>
					<div style={{ background: 'rgb(255 250 229 / 24%)', border: '1px solid rgb(59 51 38 / 14%)', borderRadius: '999px', height: '1.2rem', left: '50%', marginLeft: '-0.6rem', marginTop: '-0.6rem', position: 'absolute', top: '50%', width: '1.2rem' }} />
					<div style={{ background: 'linear-gradient(180deg, rgb(240 250 255 / 94%) 0%, rgb(145 205 229 / 82%) 100%)', border: '1px solid rgb(59 51 38 / 24%)', borderRadius: '999px', boxShadow: '0 0.35rem 0.8rem rgb(0 0 0 / 20%), inset 0 0 0 1px rgb(255 255 255 / 35%)', height: '2.35rem', left: '50%', marginLeft: '-1.175rem', marginTop: '-1.175rem', position: 'absolute', top: '50%', transform: `translate(${lookJoystickInput.x * JOYSTICK_RADIUS_PX}px, ${lookJoystickInput.y * JOYSTICK_RADIUS_PX}px)`, width: '2.35rem' }} />
				</div>
			</div>
		) : null}
	</main>;
}
