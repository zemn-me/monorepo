'use client';

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
	license,
	raNotice,
	sdlLicense,
	tdNotice,
} from '#root/project/me/zemn/app/experiments/vanilla_conquer/assets.js';
import style from '#root/project/me/zemn/app/experiments/vanilla_conquer/style.module.css';
import Link from '#root/project/me/zemn/components/Link/index.js';
import {
	type CinematicStatus,
	type DownloadProgress,
	type GameAssets,
	startGame,
} from '#root/project/vanilla_conquer/web/launcher.js';
import {
	type Future,
	future_error,
	future_loading,
	future_resolve,
} from '#root/ts/future/future.js';

type GameState = Future<void, DownloadProgress | undefined, string>;

export function VanillaConquer({ assets }: { readonly assets: GameAssets }) {
	const title = assets.game === 'ra' ? 'Red Alert' : 'Command & Conquer';
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const statusRef = useRef<HTMLParagraphElement>(null);
	const startRef = useRef<HTMLButtonElement>(null);
	const [state, setState] = useState<GameState>(() =>
		future_loading(undefined)
	);
	const navigate = useNavigate();
	const [cinematic, setCinematic] = useState<CinematicStatus | undefined>();
	const skipRef = useRef<HTMLButtonElement>(null);
	const [start, setStart] = useState<(() => void) | undefined>();
	const running = state(
		() => true,
		() => false,
		() => false
	);
	const failed = state(
		() => false,
		() => false,
		() => true
	);
	const progress = state(
		() => undefined,
		value => value,
		() => undefined
	);
	const message = state(
		() => 'Game running. Saves are kept in this browser.',
		() => `Loading ${title}…`,
		error => error
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const lifetime = new AbortController();
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		setState(() => future_loading(undefined));
		setStart(undefined);
		setCinematic(undefined);
		startGame(
			canvas,
			assets,
			{
				cinematic: value => {
					if (!lifetime.signal.aborted) setCinematic(value);
				},
				ready: begin => {
					if (!lifetime.signal.aborted) setStart(() => begin);
				},
				progress: value => {
					if (!lifetime.signal.aborted)
						setState(() => future_loading(value));
				},
				running: () => {
					if (!lifetime.signal.aborted) {
						setStart(undefined);
						setState(() => future_resolve(undefined));
					}
				},
				error: value => setState(() => future_error(value)),
				exit: () => {
					if (window.history.length > 1) void navigate(-1);
					else void navigate('/experiments', { replace: true });
				},
			},
			lifetime.signal
		);
		return () => {
			lifetime.abort();
			document.body.style.overflow = previousOverflow;
		};
	}, [assets, navigate]);

	useEffect(() => {
		if (failed) statusRef.current?.focus();
	}, [failed]);

	useEffect(() => {
		if (start) startRef.current?.focus();
	}, [start]);

	const cinematicKind = cinematic?.kind;
	useEffect(() => {
		if (cinematicKind === 'error') statusRef.current?.focus();
		else if (cinematicKind === 'loading') skipRef.current?.focus();
	}, [cinematicKind]);
	const displayedProgress =
		cinematic?.kind === 'loading' ? cinematic.progress : progress;

	return (
		<div className={style.screen}>
			<canvas
				id="canvas"
				ref={canvasRef}
				className={style.canvas}
				width={640}
				height={400}
				tabIndex={cinematic ? -1 : 0}
				aria-label={`${title} game`}
			/>
			<main
				className={style.feedback}
				hidden={running && !cinematic}
				onKeyDown={event => {
					if (cinematic && event.key === 'Escape') {
						event.preventDefault();
						cinematic.skip();
					}
				}}
			>
				<div>
					<p ref={statusRef} role="status" tabIndex={-1}>
						{cinematic
							? cinematic.kind === 'error'
								? 'Could not load this cinematic.'
								: 'Loading cinematic…'
							: start
								? 'Red Alert is ready.'
								: message}
					</p>
					{start && (
						<button
							type="button"
							ref={startRef}
							className={style.start}
							onClick={start}
						>
							Start Red Alert
						</button>
					)}
					{cinematic && (
						<div className={style.actions}>
							{cinematic.kind === 'error' && (
								<button
									type="button"
									className={style.start}
									onClick={cinematic.retry}
								>
									Retry
								</button>
							)}
							<button
								type="button"
								ref={skipRef}
								className={style.start}
								onClick={cinematic.skip}
							>
								Skip cinematic
							</button>
						</div>
					)}
					<progress
						aria-label={
							cinematic
								? 'Downloading cinematic'
								: 'Downloading game files'
						}
						hidden={
							(!cinematic && !progress) ||
							!!start ||
							cinematic?.kind === 'error'
						}
						max={displayedProgress?.total}
						value={
							displayedProgress?.total
								? displayedProgress.received
								: undefined
						}
					/>
					<section className={style.details} hidden={!failed}>
						<h1>{title}</h1>
						<Link href="/experiments">← Experiments</Link>
						<p>
							Use a keyboard and mouse. Exit the game to return to
							the previous page.
						</p>
						<p>
							EA has not endorsed and does not support this
							product.
						</p>
						<footer>
							Engine: Vanilla Conquer, compiled from C++ to
							WebAssembly. <a href={license}>License</a>
							{' · '}
							<a href={sdlLicense}>SDL license</a>
							{' · '}
							<a
								href={
									assets.game === 'ra' ? raNotice : tdNotice
								}
							>
								Original game readme
							</a>
							{' · '}
							<a href="https://github.com/zemn-me/monorepo/tree/main/project/vanilla_conquer">
								Source and build instructions
							</a>
						</footer>
					</section>
				</div>
			</main>
		</div>
	);
}
