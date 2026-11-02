'use client';

import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useRef,
	useState,
} from 'react';
import { orbitPose } from '#root/ts/3d/low_poly.js';
import { createSVGRenderer } from '#root/ts/3d/svg_scene.js';
import { point, x, z } from '#root/ts/math/cartesian.js';
import {
	groundPointFromScreen,
	perspective,
} from '#root/ts/math/wireframe_render.js';
import {
	buildActors,
	buildParkMesh,
} from '#root/ts/pulumi/eggsfordogs.com/app/park_mesh.js';
import {
	initialCamera,
	initialViewBox,
} from '#root/ts/pulumi/eggsfordogs.com/app/park_view.js';
import {
	callPack,
	createPark,
	PACK,
	stepPark,
	tossEgg,
} from '#root/ts/pulumi/eggsfordogs.com/app/scene.js';
import { unwrap } from '#root/ts/result/result.js';

function EggIcon() {
	return (
		<svg aria-hidden="true" viewBox="0 0 24 28" fill="none">
			<path
				d="M22 17C22 23 17.5 26 12 26S2 23 2 17 7 2 12 2s10 9 10 15Z"
				fill="currentColor"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<path
				d="M7 18c0-3 1-5 2-6"
				stroke="var(--paper)"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

export function EggDogYardClient({ initialScene }: { initialScene: string }) {
	const sceneRef = useRef<SVGGElement>(null);
	// Keep React's opaque HTML prop stable after the renderer adopts its children.
	const initialMarkup = useRef({ __html: initialScene }).current;
	const svgRef = useRef<SVGSVGElement>(null);
	const parkRef = useRef(createPark());
	const cameraRef = useRef(initialCamera());
	const settingsRef = useRef({ night: false, paused: false, sound: false });
	const themeOverride = useRef(false);
	const renderRef = useRef<(() => void) | null>(null);
	const audioRef = useRef<AudioContext | null>(null);
	const dragRef = useRef<{
		id: number;
		x: number;
		y: number;
		distance: number;
	} | null>(null);
	const [night, setNight] = useState<boolean | null>(null);
	const [paused, setPaused] = useState(false);
	const [sound, setSound] = useState(false);
	const [ready, setReady] = useState(false);
	const [failed, setFailed] = useState(false);
	const [delivered, setDelivered] = useState(0);
	const [message, setMessage] = useState(
		'A very good place to do absolutely nothing.'
	);
	const [showPack, setShowPack] = useState(false);

	function playTone(frequency: number) {
		if (!settingsRef.current.sound) return;
		try {
			const audio = audioRef.current ?? new AudioContext();
			audioRef.current = audio;
			void audio.resume().catch(() => {
				settingsRef.current.sound = false;
				setSound(false);
			});
			const oscillator = audio.createOscillator(),
				gain = audio.createGain();
			oscillator.type = 'sine';
			oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
			oscillator.frequency.exponentialRampToValueAtTime(
				frequency * 0.45,
				audio.currentTime + 0.18
			);
			gain.gain.setValueAtTime(0.08, audio.currentTime);
			gain.gain.exponentialRampToValueAtTime(
				0.001,
				audio.currentTime + 0.22
			);
			oscillator.connect(gain);
			gain.connect(audio.destination);
			oscillator.start();
			oscillator.stop(audio.currentTime + 0.23);
			oscillator.onended = () => {
				oscillator.disconnect();
				gain.disconnect();
			};
		} catch {
			setSound(false);
			settingsRef.current.sound = false;
		}
	}

	useEffect(() => {
		const surface = svgRef.current;
		if (!surface) return;
		let renderer: ReturnType<typeof createSVGRenderer> | undefined;
		let frame = 0;
		let previous = 0;
		let nextDraw = 0;
		let dirty = true;
		const invalidate = () => {
			dirty = true;
		};
		let disposed = false;
		let worldNight = false;
		function draw() {
			if (!renderer || disposed) return;
			dirty = false;
			const camera = cameraRef.current;
			if (worldNight !== settingsRef.current.night) {
				worldNight = settingsRef.current.night;
				renderer.setWorld(buildParkMesh(worldNight));
			}
			// Fit the island in portrait viewports without distorting the perspective.
			const aspect =
				surface!.clientWidth / Math.max(1, surface!.clientHeight);
			renderer.render(
				{
					...camera,
					distance: camera.distance * Math.max(1, 1.22 / aspect),
				},
				buildActors(parkRef.current)
			);
		}
		function loop(now: number) {
			if (!dirty && now < nextDraw - 0.5) {
				frame = requestAnimationFrame(loop);
				return;
			}
			// Keep a deadline independent of simulation time; timestamp rounding must
			// not skip a refresh when targeting 60 updates per second.
			if (now >= nextDraw - 0.5)
				nextDraw =
					nextDraw && now - nextDraw < 1000 / 60
						? nextDraw + 1000 / 60
						: now + 1000 / 60;
			const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
			previous = now;
			if (!settingsRef.current.paused && !document.hidden) {
				const before = parkRef.current.delivered;
				parkRef.current = stepPark(parkRef.current, dt);
				if (parkRef.current.delivered !== before) {
					setDelivered(parkRef.current.delivered);
					setMessage(
						`${PACK[parkRef.current.lastDog ?? 0]!.name} got the egg. Tail status: ecstatic.`
					);
				}
			}
			if (!document.hidden && (!settingsRef.current.paused || dirty))
				draw();
			frame = requestAnimationFrame(loop);
		}
		function start() {
			try {
				renderer = createSVGRenderer(surface!, sceneRef.current!);
				worldNight = settingsRef.current.night;
				renderer.setWorld(buildParkMesh(worldNight));
				setFailed(false);
				setReady(true);
				renderRef.current = invalidate;
				draw();
				frame = requestAnimationFrame(loop);
			} catch {
				setFailed(true);
				setReady(false);
			}
		}
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		function syncMotion() {
			settingsRef.current.paused = reduced.matches;
			setPaused(reduced.matches);
		}
		syncMotion();
		reduced.addEventListener('change', syncMotion);
		const dark = window.matchMedia('(prefers-color-scheme: dark)');
		function syncTheme() {
			// Follow system changes until the visitor explicitly chooses a theme.
			if (themeOverride.current) return;
			settingsRef.current.night = dark.matches;
			setNight(dark.matches);
			invalidate();
		}
		syncTheme();
		dark.addEventListener('change', syncTheme);
		const observer = new ResizeObserver(invalidate);
		observer.observe(surface);
		start();
		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			observer.disconnect();
			// React removes the host on unmount; effect restarts can reuse the visible frame.
			renderer?.dispose(true);
			renderRef.current = null;
			reduced.removeEventListener('change', syncMotion);
			dark.removeEventListener('change', syncTheme);
			void audioRef.current?.close().catch(() => {
				/* The context may already be closed during teardown. */
			});
			audioRef.current = null;
		};
	}, []);

	function toss(x?: number, z?: number) {
		if (!ready) return;
		if (settingsRef.current.paused) {
			setMessage('The park is paused. Press Play to toss an egg.');
			return;
		}
		const angle = parkRef.current.nextEgg * 2.39996;
		const next = tossEgg(
			parkRef.current,
			x ?? Math.cos(angle) * 3.8,
			z ?? Math.sin(angle) * 3.4
		);
		if (next === parkRef.current) {
			setMessage('Let the dogs catch up. They only have four paws.');
			return;
		}
		parkRef.current = next;
		setMessage('Special delivery! Here comes the welcoming committee.');
		playTone(640);
	}

	function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
		if (event.button !== 0 || dragRef.current) return;
		dragRef.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			distance: 0,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	}
	function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
		const drag = dragRef.current;
		if (!drag || drag.id !== event.pointerId) return;
		const dx = event.clientX - drag.x,
			dy = event.clientY - drag.y;
		drag.distance += Math.hypot(dx, dy);
		drag.x = event.clientX;
		drag.y = event.clientY;
		cameraRef.current.yaw -= dx * 0.006;
		cameraRef.current.pitch = Math.max(
			0.3,
			Math.min(1.15, cameraRef.current.pitch + dy * 0.004)
		);
		renderRef.current?.();
	}
	function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
		const drag = dragRef.current;
		if (!drag || drag.id !== event.pointerId) return;
		dragRef.current = null;
		if (drag.distance > 6) return;
		const bounds = event.currentTarget.getBoundingClientRect(),
			aspect = bounds.width / bounds.height;
		const camera = cameraRef.current;
		const hit = unwrap(
			groundPointFromScreen(
				point<2>(
					event.clientX - bounds.left,
					event.clientY - bounds.top
				),
				orbitPose({
					...camera,
					distance: camera.distance * Math.max(1, 1.22 / aspect),
				}),
				perspective(bounds.width, bounds.height, { focalScale: 0.95 })
			)
		);
		if (hit && Math.hypot(x(hit), z(hit)) < 7) toss(x(hit), z(hit));
	}

	return (
		<main
			className={`park-page${night === null ? ' follows-system' : night ? ' is-night' : ''}`}
		>
			<header className="masthead">
				<a
					className="wordmark"
					href="/"
					aria-label="Eggs for dogs home"
				>
					<span className="brand-egg">
						<EggIcon />
					</span>{' '}
					eggs for dogs
					<span className="wordmark-dot" aria-hidden="true">
						✳
					</span>
				</a>
				<div className="park-weather">
					<span className="status-dot" />{' '}
					{night ? 'Moonlit zoomies' : 'Always a good day here'}
				</div>
				<button
					className="round-control"
					type="button"
					aria-label={
						night ? 'Switch to daytime' : 'Switch to moonlight'
					}
					aria-pressed={night ?? false}
					onClick={() => {
						themeOverride.current = true;
						settingsRef.current.night = !night;
						setNight(!night);
						renderRef.current?.();
					}}
				>
					{night ? '☾' : '☼'}
				</button>
			</header>
			<section className="intro" aria-labelledby="park-title">
				<div className="eyebrow">
					<span /> A SMALL, HAPPY CORNER OF THE INTERNET
				</div>
				<h1 id="park-title">
					Eggs.
					<br /> Dogs.
					<br />
					<span>Endless joy.</span>
				</h1>
				<p>
					A little park. A few very good dogs.
					<br />
					And a frankly unreasonable love of eggs.
				</p>
				<button
					className="toss-button"
					type="button"
					disabled={!ready || paused}
					onClick={() => toss()}
				>
					<EggIcon /> Toss an egg{' '}
					<span className="button-arrow">↗</span>
				</button>
				<span className="intro-note">
					No winning. No losing. Just a little wag.
				</span>
			</section>
			<div className="world-wrap">
				<svg
					ref={svgRef}
					className="park-svg"
					viewBox={initialViewBox}
					aria-label="Interactive 3D dog park rendered in SVG. Click the lawn to toss an egg, drag to orbit, or use arrow keys to rotate and Space to toss."
					tabIndex={0}
					onPointerDown={pointerDown}
					onPointerMove={pointerMove}
					onPointerUp={pointerUp}
					onPointerCancel={() => {
						dragRef.current = null;
					}}
					onLostPointerCapture={() => {
						dragRef.current = null;
					}}
					onKeyDown={event => {
						if (
							[
								'ArrowLeft',
								'ArrowRight',
								'ArrowUp',
								'ArrowDown',
								'Space',
							].includes(event.code)
						) {
							event.preventDefault();
							if (event.code === 'Space') {
								if (!event.repeat) toss();
							} else {
								cameraRef.current.yaw +=
									event.code === 'ArrowLeft'
										? -0.12
										: event.code === 'ArrowRight'
											? 0.12
											: 0;
								cameraRef.current.pitch = Math.max(
									0.3,
									Math.min(
										1.15,
										cameraRef.current.pitch +
											(event.code === 'ArrowUp'
												? 0.08
												: event.code === 'ArrowDown'
													? -0.08
													: 0)
									)
								);
								renderRef.current?.();
							}
						}
					}}
				>
					<title>
						A tiny dog park. Use the buttons to meet the pack.
					</title>
					{/* The serializer escapes every attribute; no user HTML is accepted. */}
					<g ref={sceneRef} dangerouslySetInnerHTML={initialMarkup} />
				</svg>
				{failed && (
					<div className="loading-note">
						The animation couldn’t start. You can still enjoy the
						park and meet the pack below.
					</div>
				)}
				<div className="park-stamp">
					<span>GOOD DOG CLUB</span>
					<strong>100%</strong>
					<span>VERY GOOD DOGS</span>
				</div>
				<div className="scene-caption">
					<span className="tiny-star">✳</span> THE OFF-LEASH
					EGGSPERIENCE <span>EST. JUST NOW</span>
				</div>
			</div>
			<div className="park-toolbar" aria-label="Park controls">
				<button
					type="button"
					disabled={!ready || paused}
					onClick={() => {
						parkRef.current = callPack(parkRef.current);
						setMessage(
							'Roll call! Six dogs. Absolutely zero personal space.'
						);
						playTone(1000);
					}}
				>
					<span aria-hidden="true">♧</span> Call the dogs
				</button>
				<span className="toolbar-divider" />
				<button
					type="button"
					aria-pressed={sound}
					onClick={() => {
						settingsRef.current.sound = !sound;
						setSound(!sound);
						if (!sound) playTone(520);
					}}
				>
					<span aria-hidden="true">{sound ? '♪' : '♩'}</span> Sound{' '}
					{sound ? 'on' : 'off'}
				</button>
				<button
					type="button"
					disabled={!ready}
					aria-label={paused ? 'Play animation' : 'Pause animation'}
					onClick={() => {
						settingsRef.current.paused = !paused;
						setPaused(!paused);
						setMessage(
							paused
								? 'Back to the very important business of being a dog.'
								: 'A moment of paws. Press Play whenever you’re ready.'
						);
					}}
				>
					<span aria-hidden="true">{paused ? '▷' : 'Ⅱ'}</span>
					<span className="pause-label">
						{paused ? 'Play' : 'Pause'}
					</span>
				</button>
				<button
					type="button"
					disabled={!ready}
					aria-label="Reset camera view"
					onClick={() => {
						cameraRef.current = initialCamera();
						renderRef.current?.();
					}}
				>
					↺
				</button>
			</div>
			<footer className="park-footer">
				<button
					className="pack-link"
					type="button"
					aria-expanded={showPack}
					aria-controls="pack-list"
					onClick={() => setShowPack(!showPack)}
				>
					<span className="pack-dots">
						<i />
						<i />
						<i />
					</span>{' '}
					Meet the pack <span>{showPack ? '−' : '+'}</span>
				</button>
				<p className="park-message" role="status">
					{message}
				</p>
				<div className="egg-count">
					<span aria-hidden="true">♡</span>
					<strong>{delivered}</strong> eggs delivered
				</div>
			</footer>
			{showPack && (
				<section
					className="pack-panel"
					id="pack-list"
					aria-label="Meet the pack"
				>
					<div className="pack-heading">
						<span>SIX DOGS. SIX EXCELLENT RÉSUMÉS.</span>
						<button
							type="button"
							aria-label="Close pack"
							onClick={() => setShowPack(false)}
						>
							×
						</button>
					</div>
					<div className="pack-grid">
						{PACK.map((dog, i) => (
							<article key={dog.name}>
								<span
									className="dog-avatar"
									style={{
										background: `#${dog.coat.toString(16).padStart(6, '0')}`,
										color: `#${dog.patch.toString(16).padStart(6, '0')}`,
									}}
								>
									<i />
									<b>•‿•</b>
								</span>
								<div>
									<h2>
										{dog.name} <span>0{i + 1}</span>
									</h2>
									<p>{dog.personality}</p>
								</div>
							</article>
						))}
					</div>
				</section>
			)}
			<div className="gesture-hint">
				DRAG TO LOOK AROUND <span>·</span> TAP THE GRASS TO TOSS
			</div>
		</main>
	);
}
