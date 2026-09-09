'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { level } from '#root/project/me/zemn/app/experiments/arena/level.js';
import {
	createArenaScene,
	OVERVIEW,
	START,
} from '#root/project/me/zemn/app/experiments/arena/scene.js';
import style from '#root/project/me/zemn/app/experiments/arena/style.module.css';
import type { OrbitCamera } from '#root/ts/3d/low_poly.js';
import { createSVGRenderer } from '#root/ts/3d/svg_scene.js';
import type { SVGTexture } from '#root/ts/3d/svg_texture.js';
import { texturedMesh } from '#root/ts/doom/mesh.js';
import { type Doors, useDoor, walk } from '#root/ts/doom/walk.js';
import type { YawPitchPose } from '#root/ts/math/camera_pose.js';

const scene = createArenaScene();
const keys = new Set([
	'KeyW',
	'KeyA',
	'KeyS',
	'KeyD',
	'ArrowLeft',
	'ArrowRight',
	'Space',
	'KeyE',
	'ShiftLeft',
	'ShiftRight',
]);
const clampPitch = (pitch: number) => Math.max(-1.3, Math.min(1.3, pitch));

export function ArenaClient({ initialFrame }: { initialFrame: string }) {
	// React must preserve the DOM nodes owned by the SVG renderer on HUD updates.
	const initialMarkup = useMemo(
		() => ({ __html: initialFrame }),
		[initialFrame]
	);
	const viewport = useRef<SVGSVGElement>(null),
		host = useRef<SVGGElement>(null);
	const camera = useRef<OrbitCamera | YawPitchPose>({ ...OVERVIEW });
	const pressed = useRef(new Set<string>()),
		doors = useRef<Doors>(new Map());
	const rebuild = useRef<() => void>(() => undefined);
	const use = useRef<() => void>(() => undefined);
	const [walking, setWalking] = useState(false),
		[locked, setLocked] = useState(false);

	useEffect(() => {
		const svg = viewport.current!,
			materials = new Map<string, SVGTexture>();
		const renderer = createSVGRenderer(
			svg,
			host.current!,
			{ farPlane: 200 },
			materials
		);
		let lastCamera: typeof camera.current | undefined;
		rebuild.current = () => {
			const walking = !('target' in camera.current);
			materials.clear();
			renderer.setWorld(
				walking ? texturedMesh(level, doors.current, materials) : scene
			);
			svg.style.backgroundImage = walking
				? `url("${level.textures['wall:SKY1']!.url}")`
				: '';
			lastCamera = undefined;
		};
		use.current = () => {
			if (
				!('target' in camera.current) &&
				useDoor(level, camera.current, doors.current)
			)
				rebuild.current();
		};
		rebuild.current();
		let frame = 0,
			previous = 0,
			resized = true;
		let drag: { id: number; x: number; y: number } | undefined;
		const observer = new ResizeObserver(() => {
			resized = true;
		});
		observer.observe(svg);
		function look(dx: number, dy: number) {
			const current = camera.current;
			camera.current = {
				...current,
				yaw: current.yaw + dx * 0.004 * ('target' in current ? -1 : 1),
				pitch: clampPitch(current.pitch + dy * 0.004),
			};
		}
		function keyDown(event: KeyboardEvent) {
			if (
				document.activeElement !== svg &&
				document.pointerLockElement !== svg
			)
				return;
			if (keys.has(event.code)) {
				if (
					(event.code === 'Space' || event.code === 'KeyE') &&
					!event.repeat
				)
					use.current();
				else pressed.current.add(event.code);
				event.preventDefault();
			}
		}
		function keyUp(event: KeyboardEvent) {
			pressed.current.delete(event.code);
		}
		function clearKeys() {
			pressed.current.clear();
		}
		function pointerDown(event: PointerEvent) {
			svg.focus();
			drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
			svg.setPointerCapture(event.pointerId);
		}
		function pointerMove(event: PointerEvent) {
			if (document.pointerLockElement === svg)
				look(event.movementX, event.movementY);
			else if (drag?.id === event.pointerId) {
				look(event.clientX - drag.x, event.clientY - drag.y);
				drag = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
				};
			}
		}
		function pointerUp() {
			drag = undefined;
		}
		function wheel(event: WheelEvent) {
			if (!('target' in camera.current)) return;
			event.preventDefault();
			camera.current = {
				...camera.current,
				distance: Math.max(
					10,
					Math.min(
						110,
						camera.current.distance * Math.exp(event.deltaY * 0.001)
					)
				),
			};
		}
		function lockChanged() {
			setLocked(document.pointerLockElement === svg);
			clearKeys();
		}
		function animate(timestamp: number) {
			const seconds = previous
				? Math.min((timestamp - previous) / 1000, 0.05)
				: 0;
			previous = timestamp;
			if (!('target' in camera.current)) {
				const has = (key: string) => Number(pressed.current.has(key));
				const yaw =
					camera.current.yaw +
					(has('ArrowRight') - has('ArrowLeft')) * seconds * 2;
				if (pressed.current.size || camera.current.verticalVelocity)
					camera.current = walk(
						level,
						{ ...camera.current, yaw },
						has('KeyW') - has('KeyS'),
						has('KeyD') - has('KeyA'),
						!!(has('ShiftLeft') || has('ShiftRight')),
						seconds,
						doors.current
					);
			}
			if (resized || lastCamera !== camera.current) {
				renderer.render(camera.current, []);
				svg.style.backgroundPosition = `${-camera.current.yaw * 256}px ${camera.current.pitch * 200}px`;
				lastCamera = camera.current;
				resized = false;
			}
			frame = requestAnimationFrame(animate);
		}
		svg.addEventListener('pointerdown', pointerDown);
		svg.addEventListener('pointermove', pointerMove);
		svg.addEventListener('pointerup', pointerUp);
		svg.addEventListener('pointercancel', pointerUp);
		svg.addEventListener('wheel', wheel, { passive: false });
		svg.addEventListener('blur', clearKeys);
		window.addEventListener('keydown', keyDown);
		window.addEventListener('keyup', keyUp);
		window.addEventListener('blur', clearKeys);
		document.addEventListener('pointerlockchange', lockChanged);
		frame = requestAnimationFrame(animate);
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			renderer.dispose(true);
			clearKeys();
			svg.removeEventListener('pointerdown', pointerDown);
			svg.removeEventListener('pointermove', pointerMove);
			svg.removeEventListener('pointerup', pointerUp);
			svg.removeEventListener('pointercancel', pointerUp);
			svg.removeEventListener('wheel', wheel);
			svg.removeEventListener('blur', clearKeys);
			window.removeEventListener('keydown', keyDown);
			window.removeEventListener('keyup', keyUp);
			window.removeEventListener('blur', clearKeys);
			document.removeEventListener('pointerlockchange', lockChanged);
		};
	}, []);
	function reset() {
		camera.current = walking ? START : { ...OVERVIEW };
		doors.current.clear();
		pressed.current.clear();
		rebuild.current();
		viewport.current?.focus();
	}
	function changeView() {
		camera.current = walking ? { ...OVERVIEW } : START;
		pressed.current.clear();
		setWalking(!walking);
		rebuild.current();
		if (document.pointerLockElement) document.exitPointerLock();
		viewport.current?.focus();
	}
	async function capturePointer() {
		viewport.current?.focus();
		try {
			await viewport.current?.requestPointerLock();
		} catch {
			/* Drag controls remain available if capture is declined. */
		}
	}

	return (
		<section aria-label="SVG arena" className={style.shell}>
			<header className={style.header}>
				<div className={style.heading}>
					<a href="/experiments" aria-label="Back to experiments">
						←
					</a>
					<h1>
						<span>E1M1</span> Hangar
					</h1>
				</div>
				<nav aria-label="Arena controls">
					<button onClick={changeView} type="button">
						{walking ? 'Overview' : 'Walk around'}
					</button>
					<button onClick={reset} type="button">
						Reset
					</button>
				</nav>
			</header>
			<svg
				aria-label="Doom E1M1 mesh"
				aria-describedby="arena-help"
				className={`${style.viewport} ${walking ? style.textured : ''}`}
				ref={viewport}
				tabIndex={0}
				viewBox="0 0 1200 800"
			>
				<g ref={host} dangerouslySetInnerHTML={initialMarkup} />
			</svg>
			{walking ? (
				<span aria-hidden="true" className={style.crosshair}>
					+
				</span>
			) : null}
			{walking ? (
				<div className={style.touchControls}>
					{(
						[
							['KeyW', 'Move forward', '↑'],
							['KeyA', 'Move left', '←'],
							['KeyS', 'Move backward', '↓'],
							['KeyD', 'Move right', '→'],
						] as const
					).map(([key, label, symbol]) => (
						<button
							key={key}
							aria-label={label}
							type="button"
							onPointerDown={event => {
								event.currentTarget.setPointerCapture(
									event.pointerId
								);
								pressed.current.add(key);
							}}
							onPointerUp={() => pressed.current.delete(key)}
							onPointerCancel={() => pressed.current.delete(key)}
							onClick={event => {
								if (
									event.detail === 0 &&
									!('target' in camera.current)
								)
									camera.current = walk(
										level,
										camera.current,
										key === 'KeyW'
											? 1
											: key === 'KeyS'
												? -1
												: 0,
										key === 'KeyD'
											? 1
											: key === 'KeyA'
												? -1
												: 0,
										false,
										0.2,
										doors.current
									);
							}}
						>
							{symbol}
						</button>
					))}
					<button onClick={() => use.current()} type="button">
						Use
					</button>
				</div>
			) : null}
			<footer className={style.footer}>
				<p id="arena-help">
					{walking
						? 'WASD move · E / Space use · Shift run'
						: 'Drag to orbit · Scroll to zoom'}
				</p>
				{walking ? (
					<button onClick={() => void capturePointer()} type="button">
						{locked ? 'Esc to release' : 'Capture mouse'}
					</button>
				) : null}
				<a href="https://doom.bethesda.net/">Doom © id Software</a>
			</footer>
		</section>
	);
}
