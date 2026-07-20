'use client';

import { useEffect, useState } from 'react';

import style from '#root/project/me/zemn/app/experiments/pitch_training/style.module.css';
import Link from '#root/project/me/zemn/components/Link/index.js';
import {
	type ParsedAnkiCard,
	type ParsedAnkiDeck,
	type ParsedAnkiMedia,
	parseAnkiPackage,
} from '#root/ts/anki/anki.js';

export interface PitchTrainingDeckLink {
	readonly name: string;
	readonly href: string;
	readonly detail: string;
}

interface PreviewState {
	readonly deckName: string;
	readonly deck: ParsedAnkiDeck;
	readonly index: number;
	readonly showAnswer: boolean;
}

function useObjectUrl(media: ParsedAnkiMedia | null): string | null {
	const [url, setUrl] = useState<string | null>(null);

	useEffect(() => {
		if (media == null) {
			setUrl(null);
			return;
		}

			const nextUrl = URL.createObjectURL(
				new Blob([new Uint8Array(media.bytes)], { type: media.mimeType })
			);
		setUrl(nextUrl);
		return () => URL.revokeObjectURL(nextUrl);
	}, [media]);

	return url;
}

function CardPreview({
	card,
	showAnswer,
}: {
	readonly card: ParsedAnkiCard;
	readonly showAnswer: boolean;
}) {
	const audioUrl = useObjectUrl(card.audio);
	return (
		<div className={style.cardPreview}>
			<div className={style.cardFace}>
				{audioUrl == null ? null : (
					<audio
						aria-label={`Play ${card.audio?.fileName ?? 'pitch'}`}
						controls
						preload="metadata"
						src={audioUrl}
					/>
				)}
				<span>{card.audio?.fileName ?? 'No audio'}</span>
			</div>
			{showAnswer ? (
				<>
					<hr />
					<div className={style.cardFace}>
						<strong>{card.answer}</strong>
						<span>MIDI {card.midi}</span>
					</div>
				</>
			) : null}
		</div>
	);
}

export function PitchTrainingDecks({
	decks,
	sqlWasmUrl,
}: {
	readonly decks: readonly PitchTrainingDeckLink[];
	readonly sqlWasmUrl: string;
}) {
	const [loadingDeckName, setLoadingDeckName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [preview, setPreview] = useState<PreviewState | null>(null);

	async function loadPreview(deck: PitchTrainingDeckLink) {
		setError(null);
		setLoadingDeckName(deck.name);
		try {
			const response = await fetch(deck.href);
			if (!response.ok) {
				throw new Error(`failed to fetch deck: ${response.status}`);
			}

			const nextDeck = await parseAnkiPackage(await response.arrayBuffer(), {
				locateSqlWasmFile: () => sqlWasmUrl,
			});
			setPreview({
				deckName: deck.name,
				deck: nextDeck,
				index: 0,
				showAnswer: false,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : String(caught));
		} finally {
			setLoadingDeckName(null);
		}
	}

	function updatePreview(update: (current: PreviewState) => PreviewState) {
		setPreview(current => (current == null ? current : update(current)));
	}

	return (
		<>
			<ul className={style.decks}>
				{decks.map(deck => (
					<li key={deck.name}>
						<span>
							<Link download href={deck.href}>
								Download
							</Link>{' '}
							<button
								className={style.linkButton}
								disabled={loadingDeckName === deck.name}
								onClick={() => loadPreview(deck)}
								type="button"
							>
								Preview
							</button>
						</span>
						<span>
							<strong>{deck.name}</strong> — {deck.detail}
						</span>
					</li>
				))}
			</ul>
			{error == null ? null : <p>{error}</p>}
			{preview == null ? null : (
				<div className={style.preview}>
					<h3>{preview.deckName} preview</h3>
					<p>
						Card {preview.index + 1} of {preview.deck.cards.length}
					</p>
					<CardPreview
						card={preview.deck.cards[preview.index]!}
						showAnswer={preview.showAnswer}
					/>
					<p className={style.previewControls}>
						<button
							disabled={preview.index === 0}
							onClick={() =>
								updatePreview(current => ({
									...current,
									index: current.index - 1,
									showAnswer: false,
								}))
							}
							type="button"
						>
							Previous
						</button>{' '}
						<button
							onClick={() =>
								updatePreview(current => ({
									...current,
									showAnswer: !current.showAnswer,
								}))
							}
							type="button"
						>
							{preview.showAnswer ? 'Hide answer' : 'Show answer'}
						</button>{' '}
						<button
							disabled={preview.index >= preview.deck.cards.length - 1}
							onClick={() =>
								updatePreview(current => ({
									...current,
									index: current.index + 1,
									showAnswer: false,
								}))
							}
							type="button"
						>
							Next
						</button>
					</p>
				</div>
			)}
		</>
	);
}
