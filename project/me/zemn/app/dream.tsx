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
const dreamHandStorageKey = 'zemn.me:dream-hand:v1';
type DreamPhase = 'table' | 'working' | 'mansus';

interface StoredDreamHand {
	readonly journey: number;
	readonly memoryIds: readonly string[];
	readonly version: 1;
}

function loadDreamHand(): {
	readonly journey: number;
	readonly memories: readonly MansusCard[];
} {
	try {
		const value: unknown = JSON.parse(
			window.localStorage.getItem(dreamHandStorageKey) ?? 'null'
		);
		if (
			!value ||
			typeof value !== 'object' ||
			!('version' in value) ||
			value.version !== 1 ||
			!('journey' in value) ||
			typeof value.journey !== 'number' ||
			!Number.isSafeInteger(value.journey) ||
			value.journey < 0 ||
			!('memoryIds' in value) ||
			!Array.isArray(value.memoryIds) ||
			!value.memoryIds.every(id => typeof id === 'string')
		) {
			return { journey: 0, memories: [] };
		}

		const memories = value.memoryIds
			.slice(-3)
			.map(id => mansusDeck.find(card => card.id === id))
			.filter((card): card is MansusCard => card !== undefined);
		return { journey: value.journey, memories };
	} catch {
		return { journey: 0, memories: [] };
	}
}

function saveDreamHand(
	journey: number,
	memories: readonly MansusCard[]
): void {
	const value: StoredDreamHand = {
		journey,
		memoryIds: memories.map(card => card.id),
		version: 1,
	};
	try {
		window.localStorage.setItem(dreamHandStorageKey, JSON.stringify(value));
	} catch {
		// The dream remains playable when storage is unavailable or full.
	}
}

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
			title="Passion"
			type="button"
		>
			<CardFrame>
				<span aria-hidden="true" className={style.cardSigil}>
					✦
				</span>
				<strong>Passion</strong>
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
			<h2 className={style.visuallyHidden}>The Mansus</h2>
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
						aria-label="Keep this memory and return"
						className={style.mansusAction}
						onClick={onReturn}
						title="Keep this memory"
						type="button"
					>
						<span aria-hidden="true">↙</span>
					</button>
				</div>
			) : (
				<>
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
								title="Draw"
								type="button"
							>
								<CardFrame>
									<span
										aria-hidden="true"
										className={style.cardSigil}
									>
										☽
									</span>
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
	const [initialHand] = useState(loadDreamHand);
	const dialogRef = useRef<HTMLElement>(null);
	const dreamTimer = useRef<number>();
	const [phase, setPhase] = useState<DreamPhase>('table');
	const [passionPlaced, setPassionPlaced] = useState(false);
	const [journey, setJourney] = useState(initialHand.journey);
	const [drawn, setDrawn] = useState<MansusCard>();
	const [memories, setMemories] = useState<readonly MansusCard[]>(
		initialHand.memories
	);

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

	useEffect(() => {
		saveDreamHand(journey, memories);
	}, [journey, memories]);

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
					<h1 className={style.visuallyHidden}>
						The table of dreams
					</h1>
					<button
						aria-label="Wake"
						className={style.wakeButton}
						onClick={onWake}
						title="Wake"
						type="button"
					>
						<span aria-hidden="true">×</span>
					</button>
				</header>

				<main className={style.playArea}>
					<section
						aria-label="Dream"
						className={style.verbArea}
					>
						<div className={style.verb} title="Dream">
							<span aria-hidden="true" className={style.verbMoon}>
								☽
							</span>
							<h2 className={style.visuallyHidden}>Dream</h2>
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
									<span aria-hidden="true">+</span>
								)}
							</div>
							<button
								aria-label="Dream with Passion"
								className={style.dreamButton}
								disabled={!passionPlaced || phase !== 'table'}
								onClick={beginDream}
								title="Dream with Passion"
								type="button"
							>
								<span aria-hidden="true">
									{phase === 'working' ? '···' : '▶'}
								</span>
							</button>
							{phase === 'working' && (
								<div
									aria-label="Dreaming"
									className={style.timer}
									role="progressbar"
								>
									<i aria-hidden="true" />
								</div>
							)}
						</div>
					</section>

					<section
						aria-label="Your hand"
						className={style.hand}
					>
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
						</div>
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
