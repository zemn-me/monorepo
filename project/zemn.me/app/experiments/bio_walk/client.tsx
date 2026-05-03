'use client';

import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from 'react';

import {
	createBioWalkMarkers,
	createBioWalkScene,
	DEFAULT_POSE,
	EYE_HEIGHT,
	forwardFromPose,
	type PlayerPose,
	projectWorldPoint,
	type RenderedSegment,
	renderScene,
	stepPlayer,
} from '#root/project/zemn.me/app/experiments/bio_walk/scene.js';
import style from '#root/project/zemn.me/app/experiments/bio_walk/style.module.css';
import * as lang from '#root/ts/react/lang/index.js';

const scene = createBioWalkScene();
const markers = createBioWalkMarkers();
const LOOK_SENSITIVITY = 0.0025;
const PITCH_LIMIT = Math.PI * 0.45;
const SVG_WIDTH = 1200;
const SVG_HEIGHT = 800;
const MAX_VISIBLE_LABELS = 6;

interface ScreenLabel {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly title: string;
}

function projectedEventState(
	pose: PlayerPose
): { readonly labels: readonly ScreenLabel[]; readonly activeEventId: string | null } {
	const candidateLabels = markers.map(marker => {
		const projected = projectWorldPoint(
			marker.markerPosition,
			pose,
			SVG_WIDTH,
			SVG_HEIGHT
		);
		if (projected == null) {
			return null;
		}

		return {
			id: marker.event.id,
			title: lang.text(marker.event.title),
			x: projected[0]![0]!,
			y: projected[1]![0]! - 12,
			distance: Math.hypot(
				pose.position[0]![0]! - marker.markerPosition[0]![0]!,
				pose.position[2]![0]! - marker.markerPosition[2]![0]!,
			),
		};
	}).filter(v => v != null);

	candidateLabels.sort((left, right) => left.distance - right.distance);
	const visibleLabels = candidateLabels.slice(0, MAX_VISIBLE_LABELS);

	return {
		labels: visibleLabels.map(({ distance: _distance, ...label }) => label),
		activeEventId: visibleLabels[0]?.id ?? null,
	};
}

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

export function BioWalkClient() {
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
	const [labels, setLabels] = useState<readonly ScreenLabel[]>([]);
	const [activeEventId, setActiveEventId] = useState<string | null>(null);

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
			if (document.pointerLockElement !== viewportRef.current) return;
			const next = {
				...poseRef.current,
				yaw: poseRef.current.yaw + (event.movementX * LOOK_SENSITIVITY),
				pitch: clampPitch(poseRef.current.pitch + (event.movementY * LOOK_SENSITIVITY)),
			};
			poseRef.current = next;
			setPose(next);
			setSegments(renderScene(scene, next, SVG_WIDTH, SVG_HEIGHT));
			updateAnnotations(next);
		}

		function updateAnnotations(nextPose: PlayerPose) {
			const state = projectedEventState(nextPose);
			setLabels(state.labels);
			setActiveEventId(state.activeEventId);
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
				updateAnnotations(next);
			}

			frameRef.current = window.requestAnimationFrame(animate);
		}

		document.addEventListener('pointerlockchange', onPointerLockChange);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('mousemove', onMouseMove);
		updateAnnotations(DEFAULT_POSE);
		frameRef.current = window.requestAnimationFrame(animate);

		return () => {
			document.removeEventListener('pointerlockchange', onPointerLockChange);
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('mousemove', onMouseMove);
			if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
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
		lastDragPositionRef.current = { x: event.clientX, y: event.clientY };
		event.currentTarget.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
		if (draggingPointerIdRef.current !== event.pointerId || locked) return;
		const last = lastDragPositionRef.current;
		if (last == null) {
			lastDragPositionRef.current = { x: event.clientX, y: event.clientY };
			return;
		}
		const deltaX = event.clientX - last.x;
		const deltaY = event.clientY - last.y;
		lastDragPositionRef.current = { x: event.clientX, y: event.clientY };
		const next = {
			...poseRef.current,
			yaw: poseRef.current.yaw + (deltaX * LOOK_SENSITIVITY * 1.4),
			pitch: clampPitch(poseRef.current.pitch + (deltaY * LOOK_SENSITIVITY * 1.4)),
		};
		poseRef.current = next;
		setPose(next);
		setSegments(renderScene(scene, next, SVG_WIDTH, SVG_HEIGHT));
		const state = projectedEventState(next);
		setLabels(state.labels);
		setActiveEventId(state.activeEventId);
	}

	function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
		if (draggingPointerIdRef.current === event.pointerId) {
			draggingPointerIdRef.current = null;
			lastDragPositionRef.current = null;
		}
	}

	const forward = forwardFromPose(pose);
	const activeMarker = markers.find(marker => marker.event.id === activeEventId) ?? null;

	return (
		<main className={style.shell}>
			<section className={style.stage}>
				<div className={style.hud}>
					<p className={style.label}>Bio Walk</p>
					<h1 className={style.title}>Walk through timeline objects</h1>
					<p className={style.copy}>
						Each object is generated from the same bio timeline data that powers the home page.
						Move around to read what each event is. The nearest visible event is shown in the
						details panel, and labels are projected directly into the viewport.
					</p>
					{activeMarker ? (
						<div className={style.eventPanel}>
							<p className={style.eventDate}>{activeMarker.event.date.toISOString().slice(0, 10)}</p>
							<h2 className={style.eventTitle}>{lang.text(activeMarker.event.title)}</h2>
							<p className={style.eventDescription}>
								{activeMarker.event.description == null
									? 'No description is available for this event yet.'
									: lang.text(activeMarker.event.description)}
							</p>
						</div>
					) : null}
					<dl className={style.telemetry} data-testid="arena-status">
						<div>
							<dt>mode</dt>
							<dd>{locked ? 'pointer locked' : 'tap or click viewport'}</dd>
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
						aria-label="Bio timeline viewport"
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
								<stop offset="0%" stopColor="#1f2430" />
								<stop offset="55%" stopColor="#0d1118" />
								<stop offset="100%" stopColor="#08090d" />
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
						{labels.map(label => (
							<text
								className={style.eventLabel}
								key={label.id}
								textAnchor="middle"
								x={label.x}
								y={label.y}
							>
								{label.title}
							</text>
						))}
						<line className={style.crosshair} x1={585} x2={615} y1={400} y2={400} />
						<line className={style.crosshair} x1={600} x2={600} y1={385} y2={415} />
					</svg>
					<button className={style.lockButton} onClick={lockPointer} type="button">
						{locked ? 'Pointer locked' : 'Enter timeline'}
					</button>
				</div>
			</section>
		</main>
	);
}
