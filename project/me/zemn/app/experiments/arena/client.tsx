'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
	createArenaScene,
	OVERVIEW,
	START,
	stepCamera,
} from '#root/project/me/zemn/app/experiments/arena/scene.js';
import style from '#root/project/me/zemn/app/experiments/arena/style.module.css';
import { type OrbitCamera } from '#root/ts/3d/low_poly.js';
import { createSVGRenderer } from '#root/ts/3d/svg_scene.js';
import type { YawPitchPose } from '#root/ts/math/camera_pose.js';

const scene = createArenaScene();
const keys = new Set([
	'KeyW',
	'KeyA',
	'KeyS',
	'KeyD',
	'Space',
	'KeyC',
	'ShiftLeft',
	'ShiftRight',
]);
const clampPitch = (pitch: number) => Math.max(-1.5, Math.min(1.5, pitch));

export function ArenaClient({ initialFrame }: { initialFrame: string }) {
	// Keep React from replacing the DOM nodes owned by the SVG renderer on HUD updates.
	const initialMarkup = useMemo(
		() => ({ __html: initialFrame }),
		[initialFrame]
	);
	const viewport = useRef<SVGSVGElement>(null);
	const host = useRef<SVGGElement>(null);
	const camera = useRef<OrbitCamera | YawPitchPose>({ ...OVERVIEW });
	const pressed = useRef(new Set<string>());
	const [flying, setFlying] = useState(false);
	const [locked, setLocked] = useState(false);

	useEffect(() => {
		const svg = viewport.current!;
		const renderer = createSVGRenderer(svg, host.current!, {
			farPlane: 200,
		});
		renderer.setWorld(scene);
		let frame = 0;
		let previous = 0;
		let lastCamera: typeof camera.current | undefined;
		let resized = true;
		const observer = new ResizeObserver(() => {
			resized = true;
		});
		observer.observe(svg);
		let drag: { id: number; x: number; y: number } | undefined;

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
				pressed.current.add(event.code);
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
			if (document.pointerLockElement === svg) {
				look(event.movementX, event.movementY);
			} else if (drag?.id === event.pointerId) {
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
			if (!('target' in camera.current) && pressed.current.size) {
				const has = (key: string) => Number(pressed.current.has(key));
				camera.current = stepCamera(
					camera.current,
					{
						forward: has('KeyW') - has('KeyS'),
						strafe: has('KeyD') - has('KeyA'),
						vertical: has('Space') - has('KeyC'),
						sprint: !!(has('ShiftLeft') || has('ShiftRight')),
					},
					seconds
				);
			}
			if (resized || lastCamera !== camera.current) {
				renderer.render(camera.current, []);
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

	function changeView() {
		camera.current = flying ? { ...OVERVIEW } : START;
		pressed.current.clear();
		setFlying(!flying);
		if (document.pointerLockElement) document.exitPointerLock();
		viewport.current?.focus();
	}
	function reset() {
		camera.current = flying ? START : { ...OVERVIEW };
		pressed.current.clear();
		viewport.current?.focus();
	}
	async function capturePointer() {
		viewport.current?.focus();
		try {
			await viewport.current?.requestPointerLock();
		} catch {
			/* Drag controls remain available when the browser declines capture. */
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
						{flying ? 'Overview' : 'Fly through'}
					</button>
					<button onClick={reset} type="button">
						Reset
					</button>
				</nav>
			</header>
			<svg
				aria-label="Doom E1M1 wireframe mesh"
				aria-describedby="arena-help"
				className={style.viewport}
				ref={viewport}
				tabIndex={0}
				viewBox="0 0 1200 800"
			>
				<g ref={host} dangerouslySetInnerHTML={initialMarkup} />
			</svg>
			{flying ? (
				<span aria-hidden="true" className={style.crosshair}>
					+
				</span>
			) : null}

			{flying ? (
				<div className={style.touchControls}>
					{(
						[
							['KeyW', 'Move forward', '↑'],
							['KeyS', 'Move backward', '↓'],
							['Space', 'Move up', '+'],
							['KeyC', 'Move down', '−'],
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
									camera.current = stepCamera(
										camera.current,
										{
											forward:
												key === 'KeyW'
													? 1
													: key === 'KeyS'
														? -1
														: 0,
											strafe: 0,
											vertical:
												key === 'Space'
													? 1
													: key === 'KeyC'
														? -1
														: 0,
											sprint: false,
										},
										0.2
									);
							}}
						>
							{symbol}
						</button>
					))}
				</div>
			) : null}
			<footer className={style.footer}>
				<p id="arena-help">
					{flying
						? 'WASD move · Space / C up / down · Shift fast'
						: 'Drag to orbit · Scroll to zoom'}
				</p>
				{flying ? (
					<button onClick={() => void capturePointer()} type="button">
						{locked ? 'Esc to release' : 'Capture mouse'}
					</button>
				) : null}
				<a href="https://doom.bethesda.net/">Doom © id Software</a>
			</footer>
		</section>
	);
}
