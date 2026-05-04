'use client';

import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from 'react';

import {
	EYE_HEIGHT,
	type PlayerPose,
	projectWorldPoint,
	type RenderedSegment,
	renderScene,
	stepPlayer,
} from '#root/project/zemn.me/app/experiments/arena/scene.js';
import {
	initialMovementKeys,
	type JoystickInput,
	lookAngleDeltaFromJoystick,
	movementInputFromControls,
	type MovementKeyState,
	normalizeJoystickOffset,
} from '#root/ts/joystick/index.js';
import { x, y, z } from '#root/ts/math/cartesian.js';
import {
	createPenguinWorld,
	nearestVisiblePenguin,
} from '#root/ts/pulumi/baby.computer/app/scene.js';
import style from '#root/ts/pulumi/baby.computer/app/style.module.css';

type LegacyMediaQueryList = MediaQueryList & {
	addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
	removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

const world = createPenguinWorld();
const LOOK_SENSITIVITY = 0.0025;
const PITCH_LIMIT = Math.PI * 0.45;
const INITIAL_VIEWPORT_WIDTH = 1200;
const INITIAL_VIEWPORT_HEIGHT = 800;
const MOTION_YAW_SENSITIVITY = Math.PI / 180;
const MOTION_PITCH_SENSITIVITY = Math.PI / 270;
const MEETING_DISTANCE = 2.4;
const FIREWORK_COUNT = 6;
const JOYSTICK_RADIUS_PX = 36;
const LOOK_JOYSTICK_SPEED = 2.2;

interface MotionBaseline {
	readonly beta: number;
	readonly gamma: number;
	readonly yaw: number;
	readonly pitch: number;
}

function clampPitch(pitch: number): number {
	return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
}

function wrapRadians(angle: number): number {
	return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function normalizeDegrees(angle: number): number {
	return ((angle + 540) % 360) - 180;
}

function formatAngle(radians: number): string {
	return `${(radians * 180 / Math.PI).toFixed(0)}deg`;
}

export function PenguinSim() {
	const viewportRef = useRef<SVGSVGElement | null>(null);
	const frameRef = useRef<number | null>(null);
	const poseRef = useRef<PlayerPose>(world.startPose);
	const keysRef = useRef<MovementKeyState>(initialMovementKeys());
	const jumpRequestedRef = useRef(false);
	const draggingPointerIdRef = useRef<number | null>(null);
	const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
	const lastAnimationTimeRef = useRef<number | null>(null);
	const motionBaselineRef = useRef<MotionBaseline | null>(null);
	const moveJoystickPointerIdRef = useRef<number | null>(null);
	const moveJoystickInputRef = useRef<JoystickInput>({ x: 0, y: 0 });
	const lookJoystickPointerIdRef = useRef<number | null>(null);
	const lookJoystickInputRef = useRef<JoystickInput>({ x: 0, y: 0 });
	const metPenguinsRef = useRef<Set<string>>(new Set());
	const previousMetCountRef = useRef(0);

	const [locked, setLocked] = useState(false);
	const [pose, setPose] = useState<PlayerPose>(world.startPose);
	const [mobileControls, setMobileControls] = useState(false);
	const [viewportSize, setViewportSize] = useState({
		width: INITIAL_VIEWPORT_WIDTH,
		height: INITIAL_VIEWPORT_HEIGHT,
	});
	const [segments, setSegments] = useState<RenderedSegment[]>(() =>
		renderScene(
			world.scene,
			world.startPose,
			INITIAL_VIEWPORT_WIDTH,
			INITIAL_VIEWPORT_HEIGHT
		)
	);
	const [motionEnabled, setMotionEnabled] = useState(false);
	const [motionPermissionNeeded, setMotionPermissionNeeded] = useState(false);
	const [moveJoystickInput, setMoveJoystickInput] = useState<JoystickInput>({ x: 0, y: 0 });
	const [lookJoystickInput, setLookJoystickInput] = useState<JoystickInput>({ x: 0, y: 0 });
	const [metCount, setMetCount] = useState(0);
	const [fireworkTick, setFireworkTick] = useState(0);

	useEffect(() => {
		const supportsMotion = typeof DeviceOrientationEvent !== 'undefined';
		setMotionPermissionNeeded(
			supportsMotion &&
				typeof (
					DeviceOrientationEvent as typeof DeviceOrientationEvent & {
						requestPermission?: () => Promise<'granted' | 'denied'>;
					}
				).requestPermission === 'function'
		);

		const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
		const syncMobileControls = () => {
			setMobileControls(coarsePointerQuery.matches);
		};
		syncMobileControls();
		const subscribeToCoarsePointerChanges = (() => {
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
				return () => {};
			}

			legacyCoarsePointerQuery.addListener(syncMobileControls);
			return () => {
				legacyCoarsePointerQuery.removeListener(syncMobileControls);
			};
		})();

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

		function syncViewportSize() {
			const bounds = viewportRef.current?.getBoundingClientRect();
			if (bounds == null) {
				return;
			}

			const width = Math.max(1, Math.round(bounds.width));
			const height = Math.max(1, Math.round(bounds.height));
			setViewportSize(current =>
				current.width === width && current.height === height
					? current
					: { width, height }
			);
		}

		function applyPose(next: PlayerPose) {
			poseRef.current = next;
			setPose(next);
			setSegments(renderScene(world.scene, next, viewportSize.width, viewportSize.height));
		}

		function onMouseMove(event: MouseEvent) {
			if (document.pointerLockElement !== viewportRef.current) {
				return;
			}

			applyPose({
				...poseRef.current,
				yaw: poseRef.current.yaw + (event.movementX * LOOK_SENSITIVITY),
				pitch: clampPitch(
					poseRef.current.pitch + (event.movementY * LOOK_SENSITIVITY)
				),
			});
		}

		function onDeviceOrientation(event: DeviceOrientationEvent) {
			if (!motionEnabled || locked) {
				return;
			}

			const beta = event.beta;
			const gamma = event.gamma;
			if (beta == null || gamma == null) {
				return;
			}

			const baseline =
				motionBaselineRef.current ?? {
					beta,
					gamma,
					yaw: poseRef.current.yaw,
					pitch: poseRef.current.pitch,
				};
			motionBaselineRef.current = baseline;

			const yawDelta = normalizeDegrees(gamma - baseline.gamma) * MOTION_YAW_SENSITIVITY;
			const pitchDelta = normalizeDegrees(beta - baseline.beta) * MOTION_PITCH_SENSITIVITY;
			applyPose({
				...poseRef.current,
				yaw: wrapRadians(baseline.yaw + yawDelta),
				pitch: clampPitch(baseline.pitch - pitchDelta),
			});
		}

		function animate(timestamp: number) {
			const previous = lastAnimationTimeRef.current ?? timestamp;
			lastAnimationTimeRef.current = timestamp;
			const deltaSeconds = Math.min((timestamp - previous) / 1000, 0.05);
			const lookInput = lookJoystickInputRef.current;
			if (!locked && !motionEnabled && (lookInput.x !== 0 || lookInput.y !== 0)) {
				const lookDelta = lookAngleDeltaFromJoystick(
					lookInput,
					deltaSeconds,
					LOOK_JOYSTICK_SPEED
				);
				applyPose({
					...poseRef.current,
					yaw: wrapRadians(poseRef.current.yaw + lookDelta.x),
					pitch: clampPitch(poseRef.current.pitch + lookDelta.y),
				});
			}

			const input = {
				...movementInputFromControls(
					keysRef.current,
					moveJoystickInputRef.current,
					jumpRequestedRef.current
				),
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
				applyPose(stepPlayer(poseRef.current, input, deltaSeconds));
			}

			frameRef.current = window.requestAnimationFrame(animate);
		}

		document.addEventListener('pointerlockchange', onPointerLockChange);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('deviceorientation', onDeviceOrientation);
		window.addEventListener('resize', syncViewportSize);
		syncViewportSize();
		frameRef.current = window.requestAnimationFrame(animate);

		return () => {
			document.removeEventListener('pointerlockchange', onPointerLockChange);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('deviceorientation', onDeviceOrientation);
			window.removeEventListener('resize', syncViewportSize);
			subscribeToCoarsePointerChanges();
			if (frameRef.current != null) {
				window.cancelAnimationFrame(frameRef.current);
			}
		};
	}, [locked, motionEnabled, viewportSize.height, viewportSize.width]);

	useEffect(() => {
		setSegments(renderScene(world.scene, pose, viewportSize.width, viewportSize.height));
	}, [pose, viewportSize.height, viewportSize.width]);

	useEffect(() => {
		let changed = false;
		const metPenguins = metPenguinsRef.current;

		for (const penguin of world.penguins) {
			const distance = Math.hypot(
				x(penguin.position) - x(pose.position),
				z(penguin.position) - z(pose.position)
			);
			if (distance <= MEETING_DISTANCE && !metPenguins.has(penguin.name)) {
				metPenguins.add(penguin.name);
				changed = true;
			}
		}

		if (changed) {
			setMetCount(metPenguins.size);
		}
	}, [pose]);

	useEffect(() => {
		if (metCount > previousMetCountRef.current) {
			setFireworkTick(current => current + 1);
		}

		previousMetCountRef.current = metCount;
	}, [metCount]);

	function lockPointer() {
		void viewportRef.current?.requestPointerLock();
		viewportRef.current?.focus();
	}

	async function enableMotionLook() {
		if (typeof DeviceOrientationEvent === 'undefined') {
			return;
		}

		const eventType = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
			requestPermission?: () => Promise<'granted' | 'denied'>;
		};
		if (typeof eventType.requestPermission === 'function') {
			const permission = await eventType.requestPermission();
			if (permission !== 'granted') {
				return;
			}
		}

		motionBaselineRef.current = null;
		setMotionPermissionNeeded(false);
		setMotionEnabled(true);
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
		if (draggingPointerIdRef.current !== event.pointerId || locked || motionEnabled) {
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
			yaw: poseRef.current.yaw + (deltaX * LOOK_SENSITIVITY * 1.35),
			pitch: clampPitch(
				poseRef.current.pitch + (deltaY * LOOK_SENSITIVITY * 1.35)
			),
		};
		poseRef.current = next;
		setPose(next);
		setSegments(renderScene(world.scene, next, viewportSize.width, viewportSize.height));
	}

	function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
		if (draggingPointerIdRef.current === event.pointerId) {
			draggingPointerIdRef.current = null;
			lastDragPositionRef.current = null;
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
		if (moveJoystickPointerIdRef.current !== event.pointerId) {
			return;
		}

		const next = updateJoystickFromEvent(event);
		moveJoystickInputRef.current = next;
		setMoveJoystickInput(next);
	}

	function handleMoveJoystickPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
		if (moveJoystickPointerIdRef.current !== event.pointerId) {
			return;
		}

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
		if (lookJoystickPointerIdRef.current !== event.pointerId) {
			return;
		}

		const next = updateJoystickFromEvent(event);
		lookJoystickInputRef.current = next;
		setLookJoystickInput(next);
	}

	function handleLookJoystickPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
		if (lookJoystickPointerIdRef.current !== event.pointerId) {
			return;
		}

		lookJoystickPointerIdRef.current = null;
		resetLookJoystick();
	}

	const visibleEncounter = nearestVisiblePenguin(
		world.penguins,
		pose,
		viewportSize.width,
		viewportSize.height
	);
	const encounter = visibleEncounter?.penguin ?? null;
	const projectedBodies = world.penguinBodies
		.map(body => {
			const points = body.outline
				.map(vertex =>
					projectWorldPoint(
						vertex,
						pose,
						viewportSize.width,
						viewportSize.height
					)
				);

			if (points.some(projected => projected == null)) {
				return null;
			}

			const sortDepth = Math.hypot(
				x(body.centre) - x(pose.position),
				z(body.centre) - z(pose.position)
			);

			return {
				points: points.map(projected => `${x(projected!)},${y(projected!)}`).join(' '),
				sortDepth,
			};
		})
		.filter(projected => projected != null)
		.sort((left, right) => right.sortDepth - left.sortDepth);
	const encounterAnchor = visibleEncounter?.anchor ?? null;

	return (
		<main className={style.shell}>
			<section className={style.viewportWrap}>
				<svg
					aria-label="Penguin iceberg viewport"
					className={style.viewport}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					ref={viewportRef}
					tabIndex={0}
					viewBox={`0 0 ${viewportSize.width} ${viewportSize.height}`}
				>
					<defs>
						<radialGradient cx="50%" cy="35%" id="iceGlow" r="75%">
							<stop offset="0%" stopColor="#173b5a" />
							<stop offset="62%" stopColor="#081521" />
							<stop offset="100%" stopColor="#02070c" />
						</radialGradient>
					</defs>
					<rect
						fill="url(#iceGlow)"
						height={viewportSize.height}
						width={viewportSize.width}
					/>
						{projectedBodies.map((body, index) => (
							<polygon
								fill="#f6fbff"
								key={`body:${index}:${body.points}`}
								opacity={0.94}
								points={body.points}
							/>
					))}
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
					{encounter != null && encounterAnchor != null ? (
						<foreignObject
							className={style.encounterAnchor}
							height={140}
							width={260}
							x={x(encounterAnchor) - 130}
							y={y(encounterAnchor) - 126}
						>
							<div className={style.encounter}>
								<h2>{encounter.name}</h2>
								<p>
									{encounter.species} penguin, {encounter.distance.toFixed(1)}m away.
								</p>
								<p>
									{encounter.heightM.toFixed(2)}m tall, {encounter.massKg.toFixed(1)}kg.
								</p>
								<p>{encounter.blurb}</p>
							</div>
						</foreignObject>
					) : null}
					<line
						className={style.crosshair}
						x1={(viewportSize.width / 2) - 15}
						x2={(viewportSize.width / 2) + 15}
						y1={viewportSize.height / 2}
						y2={viewportSize.height / 2}
					/>
					<line
						className={style.crosshair}
						x1={viewportSize.width / 2}
						x2={viewportSize.width / 2}
						y1={(viewportSize.height / 2) - 15}
						y2={(viewportSize.height / 2) + 15}
					/>
				</svg>
				<div className={style.overlay}>
					<div className={style.overlayTop}>
						<div className={style.controls}>
							<button className={style.button} onClick={lockPointer} type="button">
								{locked ? 'Pointer Locked' : 'Enter Iceberg'}
							</button>
							<button className={style.buttonSecondary} onClick={() => void enableMotionLook()} type="button">
								{motionEnabled
									? 'Motion Look Active'
									: motionPermissionNeeded
										? 'Enable Motion Look'
										: 'Calibrate Motion Look'}
							</button>
						</div>
						<div className={style.metCount}>
							Penguins met:{' '}
							<span className={style.metFraction} key={fireworkTick}>
								{Array.from({ length: FIREWORK_COUNT }, (_, index) => (
									<span
										aria-hidden="true"
										className={style.metSpark}
										key={`${fireworkTick}:${index}`}
										style={
											{
												['--spark-angle' as const]: `${(index / FIREWORK_COUNT) * 360}deg`,
											} as CSSProperties
										}
									/>
								))}
								{metCount}/{world.penguins.length}
							</span>
						</div>
					</div>
					<div className={style.overlayStatus}>
						{locked ? 'pointer locked' : motionEnabled ? 'motion look' : 'tap or click viewport'}
						{' · '}
						{pose.position[0]![0]!.toFixed(1)}, {pose.position[1]![0]!.toFixed(1)}, {pose.position[2]![0]!.toFixed(1)}
						{' · '}
						{formatAngle(pose.yaw)} / {formatAngle(pose.pitch)}
					</div>
				</div>
				{mobileControls ? (
					<div className={style.mobileControls}>
						<div
							className={style.joystick}
							onPointerCancel={handleMoveJoystickPointerEnd}
							onPointerDown={handleMoveJoystickPointerDown}
							onPointerMove={handleMoveJoystickPointerMove}
							onPointerUp={handleMoveJoystickPointerEnd}
						>
							<div
								className={style.joystickThumb}
								style={{
									transform: `translate(${moveJoystickInput.x * JOYSTICK_RADIUS_PX}px, ${moveJoystickInput.y * JOYSTICK_RADIUS_PX}px)`,
								}}
							/>
						</div>
						<div
							className={style.joystick}
							onPointerCancel={handleLookJoystickPointerEnd}
							onPointerDown={handleLookJoystickPointerDown}
							onPointerMove={handleLookJoystickPointerMove}
							onPointerUp={handleLookJoystickPointerEnd}
						>
							<div
								className={style.joystickThumb}
								style={{
									transform: `translate(${lookJoystickInput.x * JOYSTICK_RADIUS_PX}px, ${lookJoystickInput.y * JOYSTICK_RADIUS_PX}px)`,
								}}
							/>
						</div>
					</div>
				) : null}
			</section>
		</main>
	);
}
