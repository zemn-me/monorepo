'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import style from '#root/project/me/zemn/app/dream.module.css';

interface MansusCard {
	readonly aspect: string;
	readonly description: string;
	readonly id: string;
	readonly title: string;
}

type TableCardPalette =
	| 'acquaintance'
	| 'contentment'
	| 'funds'
	| 'health'
	| 'lore'
	| 'reason';

interface TableCard {
	readonly aspect: string;
	readonly id: string;
	readonly palette: TableCardPalette;
	readonly sigil: string;
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

const startingHand: readonly TableCard[] = [
	{
		aspect: 'Ability',
		id: 'reason',
		palette: 'reason',
		sigil: '◆',
		title: 'Reason',
	},
	{
		aspect: 'Ability',
		id: 'health',
		palette: 'health',
		sigil: '♥',
		title: 'Health',
	},
	{
		aspect: 'Resource',
		id: 'funds',
		palette: 'funds',
		sigil: '£',
		title: 'Funds',
	},
	{
		aspect: 'Connection',
		id: 'acquaintance',
		palette: 'acquaintance',
		sigil: '☿',
		title: 'An Acquaintance',
	},
	{
		aspect: 'Lore · Lantern 2',
		id: 'watchmans-secret',
		palette: 'lore',
		sigil: '☀',
		title: "A Watchman's Secret",
	},
	{
		aspect: 'Influence · Heart 2',
		id: 'contentment',
		palette: 'contentment',
		sigil: '♡',
		title: 'Contentment',
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

const tableCardPaletteStyles: Readonly<Record<TableCardPalette, string>> = {
	acquaintance: style.acquaintanceCard,
	contentment: style.contentmentCard,
	funds: style.fundsCard,
	health: style.healthCard,
	lore: style.loreCard,
	reason: style.reasonCard,
};

function HandCard({ card }: { readonly card: TableCard }) {
	return (
		<article
			aria-label={`Hand card: ${card.title}`}
			className={`${style.card} ${style.scatteredCard} ${tableCardPaletteStyles[card.palette]}`}
			title={`${card.title} — ${card.aspect}`}
		>
			<CardFrame>
				<span aria-hidden="true" className={style.cardSigil}>
					{card.sigil}
				</span>
				<strong>{card.title}</strong>
				<small>{card.aspect}</small>
			</CardFrame>
		</article>
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

function MansusMap() {
	return (
		<svg
			aria-label="Map of the Mansus"
			className={style.mansusMap}
			role="img"
			viewBox="0 0 1200 700"
		>
			<g className={style.mapLandscape}>
				<path d="M80 650 245 330 355 445 570 78 775 390 900 255 1125 650Z" />
				<path d="M40 650 190 455 305 650ZM720 650 875 430 1010 650ZM930 650 1080 380 1180 650Z" />
				<path
					className={style.mapRiver}
					d="M80 570c90-58 155 46 246-10s169 50 261-8 160 41 252-8 170 22 281-36"
				/>
			</g>

			<g className={style.mapGlory}>
				<circle cx="600" cy="34" r="66" />
				<path d="M600-52V-4M600 72v48M514 34h48M638 34h48M538-28l34 34M628 62l34 34M662-28 628 6M572 62l-34 34" />
			</g>

			<g className={style.mapRoutes}>
				<path d="M945 590 785 505 555 510 275 405" pathLength="1" />
				<path d="M555 510 720 355 945 590" pathLength="1" />
				<path d="M275 405 430 245 600 132" pathLength="1" />
				<path d="M720 355 600 132" pathLength="1" />
				<path d="M430 245 720 355" pathLength="1" />
			</g>

			<g className={style.mapStairs}>
				<path d="M578 445h44v-46h-35v-46h35v-46h-35v-46h35v-46h-35v-46h35" />
			</g>

			<g className={style.mapNode} transform="translate(945 590)">
				<circle r="34" />
				<path d="M0 18V-18M0-14-18 1M0-5 18 10M0 5-15 18" />
				<text y="58">THE WOOD</text>
			</g>
			<g className={style.mapNode} transform="translate(555 510)">
				<circle r="34" />
				<path d="M-15 19V-12Q0-29 15-12v31M-15-3h30" />
				<text y="58">THE WHITE DOOR</text>
			</g>
			<g className={style.mapNode} transform="translate(275 405)">
				<circle r="34" />
				<path d="M0 18V-6M0-3-15-18M-8-11-20-8M0-3 15-18M8-11 20-8" />
				<text y="58">THE STAG DOOR</text>
			</g>
			<g className={style.mapNode} transform="translate(720 355)">
				<circle r="34" />
				<circle cy="-2" r="10" />
				<path d="M-10-9-23-18M-11-2-26-2M-10 6-23 17M10-9 23-18M11-2h15M10 6 23 17" />
				<text y="58">THE SPIDER'S DOOR</text>
			</g>
			<g className={style.mapNode} transform="translate(430 245)">
				<circle r="34" />
				<path d="M-20 5Q0-22 20 5Q0 23-20 5ZM0-7v24" />
				<text y="58">THE PEACOCK DOOR</text>
			</g>
			<g className={style.mapNode} transform="translate(600 132)">
				<circle r="34" />
				<path d="M0-18 17 12h-34ZM0-18v30M-17 12h34" />
				<text y="58">THE TRICUSPID GATE</text>
			</g>
		</svg>
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
			<MansusMap />
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
							{startingHand.map(card => (
								<HandCard card={card} key={card.id} />
							))}
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
