'use client';


import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from 'react';

import {
	createArenaScene,
	DEFAULT_POSE,
	EYE_HEIGHT,
	forwardFromPose,
	type PlayerPose,
	type RenderedSegment,
	renderScene,
	stepPlayer,
} from '#root/project/zemn.me/app/experiments/arena/scene.js';
import style from '#root/project/zemn.me/app/experiments/arena/style.module.css';

const scene = createArenaScene();
const LOOK_SENSITIVITY = 0.0025;
const PITCH_LIMIT = Math.PI * 0.45;
const SVG_WIDTH = 1200;
const SVG_HEIGHT = 800;

interface KeyState {
	KeyW: boolean;
	KeyA: boolean;
	KeyS: boolean;
	KeyD: boolean;
	Space: boolean;
	ShiftLeft: boolean;
	ShiftRight: boolean;
}

function initialKeys(): KeyState {
	return {
		KeyW: false,
		KeyA: false,
		KeyS: false,
		KeyD: false,
		Space: false,
		ShiftLeft: false,
		ShiftRight: false,
	};
}

function clampPitch(pitch: number): number {
	return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
}

function movementFromKeys(keys: KeyState) {
	return {
		forward: Number(keys.KeyW) - Number(keys.KeyS),
		strafe: Number(keys.KeyD) - Number(keys.KeyA),
		sprint: keys.ShiftLeft || keys.ShiftRight,
		jump: false,
	};
}

function formatAngle(radians: number): string {
	return `${(radians * 180 / Math.PI).toFixed(0)}deg`;
}

export function ArenaClient() {
	const viewportRef = useRef<SVGSVGElement | null>(null);
	const frameRef = useRef<number | null>(null);
	const poseRef = useRef<PlayerPose>(DEFAULT_POSE);
	const keysRef = useRef<KeyState>(initialKeys());
	const jumpRequestedRef = useRef(false);
	const draggingPointerIdRef = useRef<number | null>(null);
	const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
	const lastAnimationTimeRef = useRef<number | null>(null);

	const [locked, setLocked] = useState(false);
	const [pose, setPose] = useState<PlayerPose>(DEFAULT_POSE);
	const [segments, setSegments] = useState<RenderedSegment[]>(() =>
		renderScene(scene, DEFAULT_POSE, SVG_WIDTH, SVG_HEIGHT)
	);

	useEffect(() => {
		function onPointerLockChange() {
			setLocked(document.pointerLockElement === viewportRef.current);
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.code in keysRef.current) {
				keysRef.current = {
					...keysRef.current,
					[event.code]: true,
				};
				if (event.code === 'Space' && !event.repeat) {
					jumpRequestedRef.current = true;
				}
				event.preventDefault();
			}
		}

		function onKeyUp(event: KeyboardEvent) {
			if (event.code in keysRef.current) {
				keysRef.current = {
					...keysRef.current,
					[event.code]: false,
				};
			}
		}

		function onMouseMove(event: MouseEvent) {
			if (document.pointerLockElement !== viewportRef.current) {
				return;
			}

		const next = {
			...poseRef.current,
			yaw: poseRef.current.yaw + (event.movementX * LOOK_SENSITIVITY),
			pitch: clampPitch(
				poseRef.current.pitch + (event.movementY * LOOK_SENSITIVITY)
			),
		};

			poseRef.current = next;
			setPose(next);
			setSegments(renderScene(scene, next, SVG_WIDTH, SVG_HEIGHT));
		}

		function animate(timestamp: number) {
			const previous = lastAnimationTimeRef.current ?? timestamp;
			lastAnimationTimeRef.current = timestamp;
			const deltaSeconds = Math.min((timestamp - previous) / 1000, 0.05);
			const input = {
				...movementFromKeys(keysRef.current),
				jump: jumpRequestedRef.current,
			};
			jumpRequestedRef.current = false;

			if (
				input.forward !== 0 ||
				input.strafe !== 0 ||
				input.jump ||
				poseRef.current.position[1]![0]! > EYE_HEIGHT ||
				poseRef.current.verticalVelocity !== 0
			) {
				const next = stepPlayer(poseRef.current, input, deltaSeconds);
				poseRef.current = next;
				setPose(next);
				setSegments(renderScene(scene, next, SVG_WIDTH, SVG_HEIGHT));
			}

			frameRef.current = window.requestAnimationFrame(animate);
		}

		document.addEventListener('pointerlockchange', onPointerLockChange);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('mousemove', onMouseMove);
		frameRef.current = window.requestAnimationFrame(animate);

		return () => {
			document.removeEventListener('pointerlockchange', onPointerLockChange);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('mousemove', onMouseMove);
			if (frameRef.current != null) {
				window.cancelAnimationFrame(frameRef.current);
			}
		};
	}, []);

	function lockPointer() {
		void viewportRef.current?.requestPointerLock();
		viewportRef.current?.focus();
	}

	function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
		viewportRef.current?.focus();

		if (event.pointerType === 'mouse') {
			lockPointer();
			return;
		}

		draggingPointerIdRef.current = event.pointerId;
		lastDragPositionRef.current = {
			x: event.clientX,
			y: event.clientY,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
		if (draggingPointerIdRef.current !== event.pointerId || locked) {
			return;
		}
		const last = lastDragPositionRef.current;
		if (last == null) {
			lastDragPositionRef.current = {
				x: event.clientX,
				y: event.clientY,
			};
			return;
		}
		const deltaX = event.clientX - last.x;
		const deltaY = event.clientY - last.y;
		lastDragPositionRef.current = {
			x: event.clientX,
			y: event.clientY,
		};

		const next = {
			...poseRef.current,
			yaw: poseRef.current.yaw + (deltaX * LOOK_SENSITIVITY * 1.4),
			pitch: clampPitch(
				poseRef.current.pitch + (deltaY * LOOK_SENSITIVITY * 1.4)
			),
		};
		poseRef.current = next;
		setPose(next);
		setSegments(renderScene(scene, next, SVG_WIDTH, SVG_HEIGHT));
	}

	function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
		if (draggingPointerIdRef.current === event.pointerId) {
			draggingPointerIdRef.current = null;
			lastDragPositionRef.current = null;
		}
	}

	const forward = forwardFromPose(pose);

	return (
		<main className={style.shell}>
			<section className={style.stage}>
				<div className={style.hud}>
					<p className={style.label}>SVG Arena</p>
					<h1 className={style.title}>Pointer-lock wireframe arena</h1>
					<p className={style.copy}>
						Click the arena, then use <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move.
						Press <kbd>Space</kbd> to jump.
						The four suspended pyramids are rotated with the existing
						<code>lookAt</code> quaternion logic so their tips face the cardinal
						directions exactly.
					</p>
					<dl className={style.telemetry} data-testid="arena-status">
						<div>
							<dt>mode</dt>
							<dd>{locked ? 'pointer locked' : 'click to lock pointer'}</dd>
						</div>
						<div>
							<dt>position</dt>
							<dd>{pose.position[0]![0]!.toFixed(1)}, {pose.position[1]![0]!.toFixed(1)}, {pose.position[2]![0]!.toFixed(1)}</dd>
						</div>
						<div>
							<dt>yaw / pitch</dt>
							<dd>{formatAngle(pose.yaw)} / {formatAngle(pose.pitch)}</dd>
						</div>
						<div>
							<dt>forward</dt>
							<dd>{forward[0]![0]!.toFixed(2)}, {forward[1]![0]!.toFixed(2)}, {forward[2]![0]!.toFixed(2)}</dd>
						</div>
					</dl>
				</div>
				<div className={style.viewportWrap}>
					<svg
						aria-label="Wireframe arena viewport"
						className={style.viewport}
						data-testid="arena-svg"
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						ref={viewportRef}
						tabIndex={0}
						viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
					>
						<defs>
							<radialGradient cx="50%" cy="45%" id="arenaGlow" r="75%">
								<stop offset="0%" stopColor="#203b28" />
								<stop offset="55%" stopColor="#0d1810" />
								<stop offset="100%" stopColor="#050806" />
							</radialGradient>
						</defs>
						<rect fill="url(#arenaGlow)" height={SVG_HEIGHT} width={SVG_WIDTH} />
						{segments.map((segment, index) => (
							<line
								key={`${index}:${segment.depth.toFixed(3)}`}
								opacity={segment.opacity}
								stroke={segment.stroke}
								strokeLinecap="round"
								strokeWidth={segment.width}
								x1={segment.x1}
								x2={segment.x2}
								y1={segment.y1}
								y2={segment.y2}
							/>
						))}
						<line className={style.crosshair} x1={585} x2={615} y1={400} y2={400} />
						<line className={style.crosshair} x1={600} x2={600} y1={385} y2={415} />
					</svg>
					<button className={style.lockButton} onClick={lockPointer} type="button">
						{locked ? 'Pointer locked' : 'Enter arena'}
					</button>
				</div>
			</section>
		</main>
	);
}
