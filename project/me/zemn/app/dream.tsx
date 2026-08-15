'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import style from '#root/project/me/zemn/app/dream.module.css';

interface MansusCard {
	readonly aspect: string;
	readonly description: string;
	readonly id: string;
	readonly title: string;
}

const mansusDeck: readonly MansusCard[] = [
	{
		aspect: 'Moth',
		description:
			'Something pale has passed between the trees. Its absence clings to you like pollen.',
		id: 'pale-passage',
		title: 'A Pale Passage',
	},
	{
		aspect: 'Lantern',
		description:
			'A light without a source shows you an answer, although you have forgotten the question.',
		id: 'unasked-answer',
		title: 'An Unasked Answer',
	},
	{
		aspect: 'Secret Histories',
		description:
			'For one breath, another history lies beside yours. You remember the road it took.',
		id: 'other-road',
		title: 'The Other Road',
	},
	{
		aspect: 'Heart',
		description:
			'Under the roots, a patient rhythm continues. You wake with your pulse keeping its measure.',
		id: 'root-rhythm',
		title: 'The Rhythm Below',
	},
	{
		aspect: 'Knock',
		description:
			'A door remembers your hand. It will not open now, but neither will it forget.',
		id: 'remembering-door',
		title: 'A Remembering Door',
	},
	{
		aspect: 'Winter',
		description:
			'Snow settles in a room that has never known weather. No footprint leads away.',
		id: 'interior-snow',
		title: 'Interior Snow',
	},
] as const;

const dreamDurationMs = 2200;
type DreamPhase = 'table' | 'working' | 'mansus';

function CardFrame({
	children,
	className = '',
}: {
	readonly children: React.ReactNode;
	readonly className?: string;
}) {
	return (
		<span className={`${style.cardFrame} ${className}`}>{children}</span>
	);
}

function PassionCard({
	inSlot,
	onChoose,
}: {
	readonly inSlot: boolean;
	readonly onChoose: () => void;
}) {
	return (
		<button
			aria-label={
				inSlot ? 'Return Passion to hand' : 'Place Passion in Dream'
			}
			className={`${style.card} ${style.passionCard}`}
			draggable={!inSlot}
			onClick={onChoose}
			onDragStart={event => {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/x-mansus-card', 'passion');
			}}
			type="button"
		>
			<CardFrame>
				<span aria-hidden="true" className={style.cardSigil}>
					✦
				</span>
				<strong>Passion</strong>
				<small>Intensity. Possibility. The door in the mind.</small>
			</CardFrame>
		</button>
	);
}

function MemoryCard({ card }: { readonly card: MansusCard }) {
	return (
		<article aria-label={`Memory: ${card.title}`} className={style.card}>
			<CardFrame>
				<span aria-hidden="true" className={style.cardSigil}>
					◇
				</span>
				<strong>{card.title}</strong>
				<small>{card.aspect}</small>
			</CardFrame>
		</article>
	);
}

function Mansus({
	choices,
	drawn,
	onChoose,
	onReturn,
}: {
	readonly choices: readonly MansusCard[];
	readonly drawn?: MansusCard;
	readonly onChoose: (card: MansusCard) => void;
	readonly onReturn: () => void;
}) {
	return (
		<section aria-label="The Mansus" className={style.mansus} role="region">
			<div aria-hidden="true" className={style.mansusRings}>
				<i />
				<i />
				<i />
			</div>
			<header>
				<p>The Wood grows around the House.</p>
				<h2>The Mansus has no walls.</h2>
			</header>
			{drawn ? (
				<div aria-live="polite" className={style.revelation}>
					<article
						aria-label="Drawn card"
						className={style.drawnCard}
					>
						<CardFrame className={style.revealedFrame}>
							<span
								aria-hidden="true"
								className={style.cardSigil}
							>
								◇
							</span>
							<strong>{drawn.title}</strong>
							<small>{drawn.aspect}</small>
							<span className={style.cardDescription}>
								{drawn.description}
							</span>
						</CardFrame>
					</article>
					<button
						className={style.mansusAction}
						onClick={onReturn}
						type="button"
					>
						Keep this memory and return
					</button>
				</div>
			) : (
				<>
					<p className={style.drawInstruction}>
						Three ways offer themselves. Draw one card.
					</p>
					<div
						aria-label="Mansus card choices"
						className={style.mansusChoices}
					>
						{choices.map((card, index) => (
							<button
								aria-label={`Draw Mansus card ${index + 1}`}
								className={`${style.card} ${style.cardBack}`}
								key={card.id}
								onClick={() => onChoose(card)}
								type="button"
							>
								<CardFrame>
									<span
										aria-hidden="true"
										className={style.cardSigil}
									>
										☽
									</span>
									<strong>Unknown Way</strong>
									<small>The card is face-down.</small>
								</CardFrame>
							</button>
						))}
					</div>
				</>
			)}
		</section>
	);
}

export function DreamTable({
	leaving,
	onWake,
}: {
	readonly leaving: boolean;
	readonly onWake: () => void;
}) {
	const dialogRef = useRef<HTMLElement>(null);
	const dreamTimer = useRef<number>();
	const [phase, setPhase] = useState<DreamPhase>('table');
	const [passionPlaced, setPassionPlaced] = useState(false);
	const [journey, setJourney] = useState(0);
	const [drawn, setDrawn] = useState<MansusCard>();
	const [memories, setMemories] = useState<readonly MansusCard[]>([]);

	const choices = useMemo(
		() =>
			[0, 1, 2].map(
				index => mansusDeck[(journey * 3 + index) % mansusDeck.length]!
			),
		[journey]
	);

	useEffect(() => {
		dialogRef.current?.focus();
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onWake();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [onWake]);

	useEffect(() => () => window.clearTimeout(dreamTimer.current), []);

	const beginDream = useCallback(() => {
		if (!passionPlaced || phase !== 'table') return;
		setPhase('working');
		window.clearTimeout(dreamTimer.current);
		dreamTimer.current = window.setTimeout(() => {
			setPhase('mansus');
		}, dreamDurationMs);
	}, [passionPlaced, phase]);

	const returnFromMansus = useCallback(() => {
		if (drawn) setMemories(current => [...current.slice(-2), drawn]);
		setJourney(current => current + 1);
		setDrawn(undefined);
		setPassionPlaced(false);
		setPhase('table');
	}, [drawn]);

	return (
		<section
			aria-label="Dreaming"
			aria-modal="true"
			className={`${style.overlay} ${leaving ? style.leaving : ''}`}
			ref={dialogRef}
			role="dialog"
			tabIndex={-1}
		>
			<div className={style.table}>
				<header className={style.tableHeader}>
					<div>
						<p>Between waking and the first light</p>
						<h1>The table of dreams</h1>
					</div>
					<button
						className={style.wakeButton}
						onClick={onWake}
						type="button"
					>
						Wake
					</button>
				</header>

				<main className={style.playArea}>
					<section
						aria-labelledby="dream-verb-heading"
						className={style.verbArea}
					>
						<div className={style.verb}>
							<span aria-hidden="true" className={style.verbMoon}>
								☽
							</span>
							<h2 id="dream-verb-heading">Dream</h2>
							<p>Use a card to shape the descent.</p>
							<div
								aria-label="Dream card slot"
								className={`${style.cardSlot} ${passionPlaced ? style.filledSlot : ''}`}
								onDragOver={event => {
									event.preventDefault();
									event.dataTransfer.dropEffect = 'move';
								}}
								onDrop={event => {
									event.preventDefault();
									if (
										event.dataTransfer.getData(
											'text/x-mansus-card'
										) === 'passion'
									) {
										setPassionPlaced(true);
									}
								}}
							>
								{passionPlaced ? (
									<PassionCard
										inSlot
										onChoose={() => setPassionPlaced(false)}
									/>
								) : (
									<span>Place a card here</span>
								)}
							</div>
							<button
								className={style.dreamButton}
								disabled={!passionPlaced || phase !== 'table'}
								onClick={beginDream}
								type="button"
							>
								{phase === 'working'
									? 'Dreaming…'
									: 'Dream with Passion'}
							</button>
							{phase === 'working' && (
								<div className={style.timer} role="status">
									<span>
										The way through the Wood is opening…
									</span>
									<i aria-hidden="true" />
								</div>
							)}
						</div>
					</section>

					<section
						aria-labelledby="dream-hand-heading"
						className={style.hand}
					>
						<header>
							<p>
								Cards may be clicked or dragged into an open
								slot.
							</p>
							<h2 id="dream-hand-heading">Your hand</h2>
						</header>
						<div className={style.handCards}>
							{!passionPlaced && phase === 'table' && (
								<PassionCard
									inSlot={false}
									onChoose={() => setPassionPlaced(true)}
								/>
							)}
							{memories.map((card, index) => (
								<MemoryCard
									card={card}
									key={`${card.id}-${index}`}
								/>
							))}
							{memories.length === 0 && passionPlaced && (
								<p className={style.emptyHand}>
									The table waits.
								</p>
							)}
						</div>
						{memories.length > 0 && (
							<p aria-live="polite" className={style.memoryCount}>
								Memories carried back: {memories.length}
							</p>
						)}
					</section>
				</main>

				{phase === 'mansus' && (
					<Mansus
						choices={choices}
						drawn={drawn}
						onChoose={setDrawn}
						onReturn={returnFromMansus}
					/>
				)}
			</div>
		</section>
	);
}
