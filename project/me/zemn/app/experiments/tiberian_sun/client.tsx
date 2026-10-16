'use client';

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
	gameLicense,
	license,
	thirdPartyNotices,
} from '#root/project/me/zemn/app/experiments/tiberian_sun/assets.js';
import { createBioCampaign } from '#root/project/me/zemn/app/experiments/tiberian_sun/campaign.js';
import style from '#root/project/me/zemn/app/experiments/tiberian_sun/style.module.css';
import Link from '#root/project/me/zemn/components/Link/index.js';
import {
	type DownloadProgress,
	type GameAssets,
	startGame,
} from '#root/project/tiberian_sun/web/launcher.js';
import {
	type Future,
	future_error,
	future_loading,
	future_resolve,
} from '#root/ts/future/future.js';

type GameState = Future<void, DownloadProgress | undefined, string>;

export function TiberianSun({ assets }: { readonly assets: GameAssets }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const statusRef = useRef<HTMLParagraphElement>(null);
	const [state, setState] = useState<GameState>(() =>
		future_loading(undefined)
	);
	const navigate = useNavigate();
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
		() => 'Loading Tiberian Sun…',
		error => error
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const lifetime = new AbortController();
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		setState(() => future_loading(undefined));
		startGame(
			canvas,
			assets,
			{
				progress: value => {
					if (!lifetime.signal.aborted)
						setState(() => future_loading(value));
				},
				running: () => {
					if (!lifetime.signal.aborted)
						setState(() => future_resolve(undefined));
				},
				error: value => setState(() => future_error(value)),
				exit: () => {
					if (window.history.length > 1) void navigate(-1);
					else void navigate('/experiments', { replace: true });
				},
			},
			lifetime.signal,
			createBioCampaign()
		);
		return () => {
			lifetime.abort();
			document.body.style.overflow = previousOverflow;
		};
	}, [assets, navigate]);

	useEffect(() => {
		if (failed) statusRef.current?.focus();
	}, [failed]);

	return (
		<div className={style.screen}>
			<canvas
				id="canvas"
				ref={canvasRef}
				className={style.canvas}
				width={800}
				height={600}
				tabIndex={0}
				aria-label="Tiberian Sun game"
			/>
			<main className={style.feedback} hidden={running}>
				<div>
					<p ref={statusRef} role="status" tabIndex={-1}>
						{message}
					</p>
					<progress
						aria-label="Downloading game files"
						hidden={!progress}
						max={progress?.total}
						value={progress?.total ? progress.received : undefined}
					/>
					<section className={style.details} hidden={!failed}>
						<h1>Tiberian Sun</h1>
						<Link href="/experiments">← Experiments</Link>
						<p>
							Use a keyboard and mouse. Exit the game to return to
							the previous page.
						</p>
						<p>
							EA has not endorsed and does not support this
							product.
						</p>
						<p>
							Experimental browser port. Internet multiplayer
							supports two browser players using connection codes.
							Campaigns and Firestorm gameplay have not been
							verified.
						</p>
						<footer>
							Engine: OpenTS, compiled from C++ to WebAssembly.{' '}
							<a href={license}>License</a>
							{' · '}
							<a href={thirdPartyNotices}>Third-party notices</a>
							{' · '}
							<a href="https://github.com/zemn-me/monorepo/tree/main/project/tiberian_sun">
								Source and build instructions
							</a>
							{' · '}
							<a href="https://archive.org/details/command-and-conquer-tiberian-sun">
								Freeware game data source
							</a>
							{' · '}
							<a href={gameLicense}>Original game license</a>
						</footer>
					</section>
				</div>
			</main>
		</div>
	);
}
