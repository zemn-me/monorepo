'use client';

import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from 'react';

import {
	createPlatonicField,
	DEFAULT_POSE,
	EYE_HEIGHT,
	forwardFromPose,
	type PlayerPose,
	type RenderedSegment,
	renderScene,
	segmentCountForSolidLimit,
	stepPlayer,
} from '#root/project/me/zemn/app/experiments/platonics/scene.js';
import style from '#root/project/me/zemn/app/experiments/platonics/style.module.css';
import { is_err, unwrap, unwrap_err } from '#root/ts/result/result.js';

const field = createPlatonicField();
const LOOK_SENSITIVITY = 0.0023;
const PITCH_LIMIT = Math.PI * 0.45;
const SVG_WIDTH = 1280;
const SVG_HEIGHT = 720;
const DEFAULT_SOLID_LIMIT = Math.min(10, field.solidCount);

interface KeyState {
	KeyW: boolean;
	KeyA: boolean;
	KeyS: boolean;
	KeyD: boolean;
	Space: boolean;
	ShiftLeft: boolean;
	ShiftRight: boolean;
}

interface ViewState {
	readonly pose: PlayerPose;
	readonly timeSeconds: number;
}

interface PerfStats {
	readonly fps: number;
	readonly frameMs: number;
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
	return `${((radians * 180) / Math.PI).toFixed(0)}deg`;
}

function formatVector(position: PlayerPose['position']): string {
	return `${position[0]![0]!.toFixed(1)}, ${position[1]![0]!.toFixed(
		1
	)}, ${position[2]![0]!.toFixed(1)}`;
}

export function PlatonicsClient() {
	const viewportRef = useRef<SVGSVGElement | null>(null);
	const frameRef = useRef<number | null>(null);
	const poseRef = useRef<PlayerPose>(DEFAULT_POSE);
	const keysRef = useRef<KeyState>(initialKeys());
	const jumpRequestedRef = useRef(false);
	const draggingPointerIdRef = useRef<number | null>(null);
	const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
	const lastAnimationTimeRef = useRef<number | null>(null);
	const perfSampleRef = useRef({
		lastTime: 0,
		frames: 0,
	});

	const [locked, setLocked] = useState(false);
	const [solidLimit, setSolidLimit] = useState(DEFAULT_SOLID_LIMIT);
	const [view, setView] = useState<ViewState>({
		pose: DEFAULT_POSE,
		timeSeconds: 0,
	});
	const [perf, setPerf] = useState<PerfStats>({
		fps: 0,
		frameMs: 0,
	});

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

			poseRef.current = {
				...poseRef.current,
				yaw: poseRef.current.yaw + event.movementX * LOOK_SENSITIVITY,
				pitch: clampPitch(
					poseRef.current.pitch + event.movementY * LOOK_SENSITIVITY
				),
			};
		}

		function updatePerf(timestamp: number) {
			const sample = perfSampleRef.current;
			if (sample.lastTime === 0) {
				sample.lastTime = timestamp;
			}
			sample.frames += 1;
			const elapsed = timestamp - sample.lastTime;

			if (elapsed >= 250) {
				setPerf({
					fps: (sample.frames * 1000) / elapsed,
					frameMs: elapsed / sample.frames,
				});
				perfSampleRef.current = {
					lastTime: timestamp,
					frames: 0,
				};
			}
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
				poseRef.current = stepPlayer(
					poseRef.current,
					input,
					deltaSeconds
				);
			}

			updatePerf(timestamp);
			setView({
				pose: poseRef.current,
				timeSeconds: timestamp / 1000,
			});
			frameRef.current = window.requestAnimationFrame(animate);
		}

		document.addEventListener('pointerlockchange', onPointerLockChange);
		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('keyup', onKeyUp);
		window.addEventListener('mousemove', onMouseMove);
		frameRef.current = window.requestAnimationFrame(animate);

		return () => {
			document.removeEventListener(
				'pointerlockchange',
				onPointerLockChange
			);
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

		poseRef.current = {
			...poseRef.current,
			yaw: poseRef.current.yaw + deltaX * LOOK_SENSITIVITY * 1.5,
			pitch: clampPitch(
				poseRef.current.pitch + deltaY * LOOK_SENSITIVITY * 1.5
			),
		};
	}

	function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
		if (draggingPointerIdRef.current === event.pointerId) {
			draggingPointerIdRef.current = null;
			lastDragPositionRef.current = null;
		}
	}

	const segmentsResult = renderScene(
		field,
		view.pose,
		SVG_WIDTH,
		SVG_HEIGHT,
		view.timeSeconds,
		solidLimit
	);
	const renderedSegmentCount = segmentCountForSolidLimit(field, solidLimit);
	const forwardResult = forwardFromPose(view.pose);
	const renderError = is_err(segmentsResult)
		? unwrap_err(segmentsResult)
		: is_err(forwardResult)
			? unwrap_err(forwardResult)
			: null;
	const segments: RenderedSegment[] = is_err(segmentsResult)
		? []
		: unwrap(segmentsResult);
	const forward = is_err(forwardResult) ? null : unwrap(forwardResult);

	return (
		<main className={style.shell}>
			<section className={style.stage}>
				<header className={style.hud}>
					<div className={style.heading}>
						<p className={style.label}>Platonic Stress</p>
						<h1 className={style.title}>Solid field</h1>
					</div>
					<dl
						className={style.telemetry}
						data-testid="platonics-status"
					>
						<div>
							<dt>mode</dt>
							<dd>{locked ? 'locked' : 'ready'}</dd>
						</div>
						<div>
							<dt>fps</dt>
							<dd>{perf.fps.toFixed(1)}</dd>
						</div>
						<div>
							<dt>frame</dt>
							<dd>{perf.frameMs.toFixed(1)} ms</dd>
						</div>
						<div>
							<dt>visible</dt>
							<dd>
								{segments.length} / {renderedSegmentCount}
							</dd>
						</div>
						<div>
							<dt>solids</dt>
							<dd>
								{solidLimit} / {field.solidCount}
							</dd>
						</div>
						<div>
							<dt>position</dt>
							<dd>{formatVector(view.pose.position)}</dd>
						</div>
						<div>
							<dt>yaw / pitch</dt>
							<dd>
								{formatAngle(view.pose.yaw)} /{' '}
								{formatAngle(view.pose.pitch)}
							</dd>
						</div>
						<div>
							<dt>forward</dt>
							<dd>
								{forward == null
									? 'n/a'
									: `${forward[0]![0]!.toFixed(2)}, ${forward[1]![0]!.toFixed(2)}, ${forward[2]![0]!.toFixed(2)}`}
							</dd>
						</div>
					</dl>
				</header>
				<div className={style.viewportWrap}>
					<svg
						aria-label="Platonic solid stress viewport"
						className={style.viewport}
						data-testid="platonics-svg"
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
						ref={viewportRef}
						tabIndex={0}
						viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
					>
						<defs>
							<linearGradient id="solidSky" x1="0" x2="1" y1="0" y2="1">
								<stop offset="0%" stopColor="#071015" />
								<stop offset="45%" stopColor="#0f1410" />
								<stop offset="100%" stopColor="#050506" />
							</linearGradient>
						</defs>
						<rect
							fill="url(#solidSky)"
							height={SVG_HEIGHT}
							width={SVG_WIDTH}
						/>
						{segments.map((segment, index) => (
							<line
								key={index}
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
						<line
							className={style.crosshair}
							x1={SVG_WIDTH / 2 - 14}
							x2={SVG_WIDTH / 2 + 14}
							y1={SVG_HEIGHT / 2}
							y2={SVG_HEIGHT / 2}
						/>
						<line
							className={style.crosshair}
							x1={SVG_WIDTH / 2}
							x2={SVG_WIDTH / 2}
							y1={SVG_HEIGHT / 2 - 14}
							y2={SVG_HEIGHT / 2 + 14}
						/>
					</svg>
				</div>
				<footer className={style.actions}>
					<button
						className={style.lockButton}
						onClick={lockPointer}
						type="button"
					>
						{locked ? 'Locked' : 'Enter field'}
					</button>
					<label className={style.sliderControl}>
						<span className={style.sliderLabel}>solids</span>
						<input
							aria-label="Rendered solid count"
							className={style.slider}
							max={field.solidCount}
							min={0}
							onChange={event =>
								setSolidLimit(event.currentTarget.valueAsNumber)
							}
							step={1}
							type="range"
							value={solidLimit}
						/>
						<span className={style.sliderValue}>{solidLimit}</span>
					</label>
					{renderError != null ? (
						<p className={style.renderError}>
							Render degraded: {renderError.message}
						</p>
					) : null}
				</footer>
			</section>
		</main>
	);
}
