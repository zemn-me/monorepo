'use client';

import {
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type WheelEvent as ReactWheelEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import * as CultistRecipes from '#root/project/cultist/recipe.js';
import * as CultistSlots from '#root/project/cultist/slots.js';
import type * as Cultist from '#root/project/cultist/types.js';
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
	| 'passion'
	| 'reason';

interface TableCard extends Cultist.Element {
	readonly aspect: string;
	readonly id: string;
	readonly palette: TableCardPalette;
	readonly sigil: string;
	readonly title: string;
}

interface CardInstance {
	readonly card: TableCard;
	readonly instanceId: string;
}

type TableVerbId = 'dream' | 'explore' | 'study' | 'talk' | 'work';

interface TableVerb extends Cultist.Verb {
	readonly id: TableVerbId;
	readonly sigil: string;
	readonly slot: Cultist.Slot;
}

interface TableRecipe extends Cultist.Recipe {
	readonly actionid: TableVerbId;
	readonly entersMansus?: boolean;
	readonly outputId?: MansusCard['id'];
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
		aspects: { ability: 1, reason: 1 },
		id: 'reason',
		palette: 'reason',
		sigil: '◆',
		title: 'Reason',
	},
	{
		aspect: 'Ability',
		aspects: { ability: 1, health: 1 },
		id: 'health',
		palette: 'health',
		sigil: '♥',
		title: 'Health',
	},
	{
		aspect: 'Resource',
		aspects: { funds: 1, resource: 1 },
		id: 'funds',
		palette: 'funds',
		sigil: '£',
		title: 'Funds',
	},
	{
		aspect: 'Connection',
		aspects: { acquaintance: 1, connection: 1 },
		id: 'acquaintance',
		palette: 'acquaintance',
		sigil: '☿',
		title: 'An Acquaintance',
	},
	{
		aspect: 'Lore · Lantern 2',
		aspects: { lantern: 2, lore: 1 },
		id: 'watchmans-secret',
		palette: 'lore',
		sigil: '☀',
		title: "A Watchman's Secret",
	},
	{
		aspect: 'Influence · Heart 2',
		aspects: { heart: 2, influence: 1 },
		id: 'contentment',
		palette: 'contentment',
		sigil: '♡',
		title: 'Contentment',
	},
	{
		aspect: 'Ability',
		aspects: { ability: 1, passion: 1 },
		id: 'passion',
		palette: 'passion',
		sigil: '✦',
		title: 'Passion',
	},
] as const;

const tableVerbs: readonly TableVerb[] = [
	{
		id: 'work',
		label: 'Work',
		sigil: '⚒',
		slot: { id: 'work-input', required: { ability: 1 } },
	},
	{
		id: 'study',
		label: 'Study',
		sigil: '◇',
		slot: { id: 'study-input', required: { lore: 1, reason: 1 } },
	},
	{
		id: 'dream',
		label: 'Dream',
		sigil: '☽',
		slot: { id: 'dream-input', required: { ability: 1, memory: 1 } },
	},
	{
		id: 'talk',
		label: 'Talk',
		sigil: '☿',
		slot: {
			id: 'talk-input',
			required: { connection: 1, influence: 1 },
		},
	},
	{
		id: 'explore',
		label: 'Explore',
		sigil: '✣',
		slot: { id: 'explore-input', required: { lore: 1, resource: 1 } },
	},
] as const;

const tableRecipes: readonly TableRecipe[] = [
	{
		actionid: 'dream',
		craftable: true,
		entersMansus: true,
		id: 'dream-with-passion',
		label: 'Dream with Passion',
		requirements: { passion: 1 },
	},
	{
		actionid: 'dream',
		craftable: true,
		id: 'dream-with-reason',
		label: 'Follow an Unasked Answer',
		outputId: 'unasked-answer',
		requirements: { reason: 1 },
	},
	{
		actionid: 'dream',
		craftable: true,
		id: 'dream-with-health',
		label: 'Remember the Rhythm Below',
		outputId: 'root-rhythm',
		requirements: { health: 1 },
	},
	{
		actionid: 'work',
		craftable: true,
		id: 'work-with-health',
		label: 'A Shift of Necessary Labour',
		outputId: 'root-rhythm',
		requirements: { health: 1 },
	},
	{
		actionid: 'work',
		craftable: true,
		id: 'work-with-reason',
		label: 'A Careful Commission',
		outputId: 'unasked-answer',
		requirements: { reason: 1 },
	},
	{
		actionid: 'study',
		craftable: true,
		id: 'study-lantern-lore',
		label: 'Study What the Watchman Knew',
		outputId: 'remembering-door',
		requirements: { lantern: 2 },
	},
	{
		actionid: 'talk',
		craftable: true,
		id: 'talk-to-an-acquaintance',
		label: 'Speak of Uncertain Things',
		outputId: 'other-road',
		requirements: { acquaintance: 1 },
	},
	{
		actionid: 'explore',
		craftable: true,
		id: 'explore-with-funds',
		label: 'Purchase an Unreliable Map',
		outputId: 'pale-passage',
		requirements: { funds: 1 },
	},
] as const;

const dreamDurationMs = 2200;
const dreamHandStorageKey = 'zemn.me:dream-hand:v1';
type DreamPhase = 'table' | 'working' | 'mansus';

interface TableCameraState {
	readonly x: number;
	readonly y: number;
	readonly zoom: number;
}

interface PointerPosition {
	readonly x: number;
	readonly y: number;
}

interface CameraGesture {
	readonly camera: TableCameraState;
	readonly center: PointerPosition;
	readonly distance: number;
}

const defaultTableCamera: TableCameraState = { x: 0, y: 0, zoom: 1 };
const tableZoomLevels = [0.72, 1, 1.28] as const;
const tableZoomMinimum = 0.64;
const tableZoomMaximum = 1.42;
const tablePanXMaximum = 360;
const tablePanYMaximum = 260;

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.max(minimum, Math.min(maximum, value));
}

function cameraGesture(
	pointers: ReadonlyMap<number, PointerPosition>,
	camera: TableCameraState
): CameraGesture | null {
	const positions = [...pointers.values()].slice(0, 2);
	if (positions.length === 0) return null;
	const first = positions[0]!;
	const second = positions[1];
	if (!second) {
		return { camera, center: first, distance: 0 };
	}
	return {
		camera,
		center: {
			x: (first.x + second.x) / 2,
			y: (first.y + second.y) / 2,
		},
		distance: Math.hypot(second.x - first.x, second.y - first.y),
	};
}

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
			.slice(-5)
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

const tableCardPaletteStyles: Readonly<Record<TableCardPalette, string>> = {
	acquaintance: style.acquaintanceCard,
	contentment: style.contentmentCard,
	funds: style.fundsCard,
	health: style.healthCard,
	lore: style.loreCard,
	passion: style.passionCard,
	reason: style.reasonCard,
};

function memoryAsTableCard(card: MansusCard): TableCard {
	const aspect = card.aspect.toLocaleLowerCase().replaceAll(' ', '-');
	return {
		aspect: card.aspect,
		aspects: { [aspect]: 1, lore: 1, memory: 1 },
		description: card.description,
		id: card.id,
		palette: card.aspect === 'Heart' ? 'contentment' : 'lore',
		sigil: '◇',
		title: card.title,
	};
}

function TableCardView({
	card: { card },
	inSlot = false,
	onActivate,
	onDropAt,
}: {
	readonly card: CardInstance;
	readonly inSlot?: boolean;
	readonly onActivate: () => void;
	readonly onDropAt: (position: PointerPosition) => void;
}) {
	const dragStart = useRef<
		(PointerPosition & { readonly pointerId: number }) | null
	>(null);
	const dragged = useRef(false);
	const suppressClick = useRef(false);
	const [dragOffset, setDragOffset] = useState<PointerPosition | null>(null);
	const clearDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
		dragStart.current = null;
		dragged.current = false;
		setDragOffset(null);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	return (
		<button
			aria-label={`${inSlot ? 'Slotted' : 'Hand'} card: ${card.title}`}
			className={`${style.card} ${inSlot ? '' : style.scatteredCard} ${tableCardPaletteStyles[card.palette]} ${dragOffset ? style.draggingCard : ''}`}
			onClick={() => {
				if (suppressClick.current) {
					suppressClick.current = false;
					return;
				}
				onActivate();
			}}
			onLostPointerCapture={event => {
				if (dragStart.current?.pointerId === event.pointerId) {
					dragStart.current = null;
					dragged.current = false;
					setDragOffset(null);
				}
			}}
			onPointerCancel={clearDrag}
			onPointerDown={event => {
				dragStart.current = {
					pointerId: event.pointerId,
					x: event.clientX,
					y: event.clientY,
				};
				dragged.current = false;
				event.currentTarget.setPointerCapture(event.pointerId);
			}}
			onPointerMove={event => {
				const start = dragStart.current;
				if (!start || start.pointerId !== event.pointerId) return;
				const next = {
					x: event.clientX - start.x,
					y: event.clientY - start.y,
				};
				if (!dragged.current && Math.hypot(next.x, next.y) < 5) return;
				dragged.current = true;
				setDragOffset(next);
			}}
			onPointerUp={event => {
				if (dragStart.current?.pointerId !== event.pointerId) return;
				const wasDragged = dragged.current;
				clearDrag(event);
				if (wasDragged) {
					suppressClick.current = true;
					onDropAt({ x: event.clientX, y: event.clientY });
				}
			}}
			style={
				dragOffset
					? { translate: `${dragOffset.x}px ${dragOffset.y}px` }
					: undefined
			}
			title={`${card.title} — ${card.aspect}`}
			type="button"
		>
			<CardFrame>
				<span aria-hidden="true" className={style.cardSigil}>
					{card.sigil}
				</span>
				<strong>{card.title}</strong>
				<small>{card.aspect}</small>
			</CardFrame>
		</button>
	);
}

function cardFitsVerb(card: TableCard, verb: TableVerb): boolean {
	return [...CultistSlots.elementsValid(verb.slot, [card])].length === 1;
}

function recipeFor(
	verb: TableVerb,
	card: TableCard
): TableRecipe | undefined {
	for (const [recipe, elements] of CultistRecipes.available(
		[verb],
		tableRecipes,
		[card]
	)) {
		if (elements.length === 1 && elements[0]?.id === card.id) {
			return recipe as TableRecipe;
		}
	}
}

function cardInstance(card: TableCard): CardInstance {
	return { card, instanceId: `hand:${card.id}` };
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
	const nextMemoryInstance = useRef(initialHand.memories.length);
	const verbTimers = useRef(new Map<TableVerbId, number>());
	const cameraPointers = useRef(new Map<number, PointerPosition>());
	const cameraGestureRef = useRef<CameraGesture | null>(null);
	const [phase, setPhase] = useState<DreamPhase>('table');
	const [tableCamera, setTableCamera] = useState(defaultTableCamera);
	const tableCameraRef = useRef(tableCamera);
	const [journey, setJourney] = useState(initialHand.journey);
	const [drawn, setDrawn] = useState<MansusCard>();
	const [memories, setMemories] = useState<readonly CardInstance[]>(
		initialHand.memories.map((card, index) => ({
			card: memoryAsTableCard(card),
			instanceId: `memory:${index}:${card.id}`,
		}))
	);
	const [verbSlots, setVerbSlots] = useState<
		Partial<Record<TableVerbId, string>>
	>({});
	const [runningVerbs, setRunningVerbs] = useState<
		ReadonlySet<TableVerbId>
	>(new Set());

	const cards = useMemo(
		() => [...startingHand.map(cardInstance), ...memories],
		[memories]
	);
	const cardsById = useMemo(
		() => new Map(cards.map(card => [card.instanceId, card])),
		[cards]
	);

	const choices = useMemo(
		() =>
			[0, 1, 2].map(
				index => mansusDeck[(journey * 3 + index) % mansusDeck.length]!
			),
		[journey]
	);

	const commitTableCamera = useCallback((next: TableCameraState) => {
		const clamped = {
			x: clamp(next.x, -tablePanXMaximum, tablePanXMaximum),
			y: clamp(next.y, -tablePanYMaximum, tablePanYMaximum),
			zoom: clamp(next.zoom, tableZoomMinimum, tableZoomMaximum),
		};
		tableCameraRef.current = clamped;
		setTableCamera(clamped);
	}, []);

	const setTableZoomLevel = useCallback(
		(zoom: number) => {
			commitTableCamera({ x: 0, y: 0, zoom });
		},
		[commitTableCamera]
	);

	const startCameraGesture = useCallback(() => {
		cameraGestureRef.current = cameraGesture(
			cameraPointers.current,
			tableCameraRef.current
		);
	}, []);

	const onCameraPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (phase === 'mansus') return;
			if (
				(event.target as Element).closest(
					'button, article, [role="progressbar"]'
				)
			) {
				return;
			}
			cameraPointers.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			event.currentTarget.setPointerCapture(event.pointerId);
			startCameraGesture();
		},
		[phase, startCameraGesture]
	);

	const onCameraPointerMove = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!cameraPointers.current.has(event.pointerId)) return;
			cameraPointers.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			const gesture = cameraGestureRef.current;
			const current = cameraGesture(
				cameraPointers.current,
				tableCameraRef.current
			);
			if (!gesture || !current) return;

			const zoom =
				gesture.distance > 0 && current.distance > 0
					? gesture.camera.zoom *
						(current.distance / gesture.distance)
					: gesture.camera.zoom;
			commitTableCamera({
				x: gesture.camera.x + current.center.x - gesture.center.x,
				y: gesture.camera.y + current.center.y - gesture.center.y,
				zoom,
			});
		},
		[commitTableCamera]
	);

	const onCameraPointerEnd = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (!cameraPointers.current.delete(event.pointerId)) return;
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			startCameraGesture();
		},
		[startCameraGesture]
	);

	const onCameraWheel = useCallback(
		(event: ReactWheelEvent<HTMLDivElement>) => {
			if (phase === 'mansus') return;
			event.preventDefault();
			commitTableCamera({
				...tableCameraRef.current,
				zoom:
					tableCameraRef.current.zoom *
					Math.exp(-event.deltaY * 0.0012),
			});
		},
		[commitTableCamera, phase]
	);

	useEffect(() => {
		dialogRef.current?.focus();
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onWake();
				return;
			}
			if (phase === 'mansus') return;
			const zoomLevel = Number(event.key) - 1;
			if (zoomLevel >= 0 && zoomLevel < tableZoomLevels.length) {
				setTableZoomLevel(tableZoomLevels[zoomLevel]!);
				return;
			}
			if (event.key === 'Home') {
				setTableZoomLevel(defaultTableCamera.zoom);
				return;
			}
			const movement = 48;
			const key = event.key.toLowerCase();
			const delta =
				key === 'arrowleft' || key === 'a'
					? { x: movement, y: 0 }
					: key === 'arrowright' || key === 'd'
						? { x: -movement, y: 0 }
						: key === 'arrowup' || key === 'w'
							? { x: 0, y: movement }
							: key === 'arrowdown' || key === 's'
								? { x: 0, y: -movement }
								: null;
			if (!delta) return;
			event.preventDefault();
			commitTableCamera({
				...tableCameraRef.current,
				x: tableCameraRef.current.x + delta.x,
				y: tableCameraRef.current.y + delta.y,
			});
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [commitTableCamera, onWake, phase, setTableZoomLevel]);

	useEffect(
		() => () => {
			for (const timer of verbTimers.current.values()) {
				window.clearTimeout(timer);
			}
		},
		[]
	);

	useEffect(() => {
		saveDreamHand(
			journey,
			memories.flatMap(({ card }) => {
				const memory = mansusDeck.find(({ id }) => id === card.id);
				return memory ? [memory] : [];
			})
		);
	}, [journey, memories]);

	const addMemory = useCallback((id: MansusCard['id']) => {
		const card = mansusDeck.find(card => card.id === id);
		if (!card) return;
		const instance: CardInstance = {
			card: memoryAsTableCard(card),
			instanceId: `memory:${nextMemoryInstance.current++}:${card.id}`,
		};
		setMemories(current => [...current.slice(-4), instance]);
	}, []);

	const returnCardToHand = useCallback(
		(instanceId: string) => {
			const runningSource = tableVerbs.find(
				verb =>
					verbSlots[verb.id] === instanceId &&
					runningVerbs.has(verb.id)
			);
			if (runningSource) return;
			setVerbSlots(current => {
				const next = { ...current };
				for (const verb of tableVerbs) {
					if (next[verb.id] === instanceId) delete next[verb.id];
				}
				return next;
			});
		},
		[runningVerbs, verbSlots]
	);

	const placeCard = useCallback(
		(instanceId: string, verb: TableVerb) => {
			const instance = cardsById.get(instanceId);
			if (!instance || runningVerbs.has(verb.id)) return;
			const runningSource = tableVerbs.find(
				candidate =>
					verbSlots[candidate.id] === instanceId &&
					runningVerbs.has(candidate.id)
			);
			if (runningSource || !cardFitsVerb(instance.card, verb)) return;
			setVerbSlots(current => {
				const next = { ...current };
				for (const candidate of tableVerbs) {
					if (next[candidate.id] === instanceId) {
						delete next[candidate.id];
					}
				}
				next[verb.id] = instanceId;
				return next;
			});
		},
		[cardsById, runningVerbs, verbSlots]
	);

	const dropCardAt = useCallback(
		(instanceId: string, position: PointerPosition) => {
			const targets = document.elementsFromPoint(position.x, position.y);
			const verbId = targets
				.map(target =>
					target
						.closest<HTMLElement>('[data-dream-verb]')
						?.getAttribute('data-dream-verb')
				)
				.find((id): id is TableVerbId => id !== undefined);
			const verb = tableVerbs.find(candidate => candidate.id === verbId);
			if (verb) {
				placeCard(instanceId, verb);
				return;
			}
			if (targets.some(target => target.closest('[data-dream-hand]'))) {
				returnCardToHand(instanceId);
			}
		},
		[placeCard, returnCardToHand]
	);

	const placeCardInFirstVerb = useCallback(
		(instance: CardInstance) => {
			const verb = tableVerbs.find(
				candidate =>
					!verbSlots[candidate.id] &&
					!runningVerbs.has(candidate.id) &&
					recipeFor(candidate, instance.card)
			);
			if (verb) placeCard(instance.instanceId, verb);
		},
		[placeCard, runningVerbs, verbSlots]
	);

	const beginVerb = useCallback(
		(verb: TableVerb) => {
			if (phase !== 'table' || runningVerbs.has(verb.id)) return;
			const instanceId = verbSlots[verb.id];
			const instance = instanceId ? cardsById.get(instanceId) : undefined;
			const recipe = instance && recipeFor(verb, instance.card);
			if (!instance || !recipe) return;

			setRunningVerbs(current => new Set(current).add(verb.id));
			if (verb.id === 'dream') setPhase('working');
			const timer = window.setTimeout(() => {
				verbTimers.current.delete(verb.id);
				if (recipe.entersMansus) {
					setPhase('mansus');
					return;
				}
				setVerbSlots(current => {
					if (current[verb.id] !== instanceId) return current;
					const next = { ...current };
					delete next[verb.id];
					return next;
				});
				setRunningVerbs(current => {
					const next = new Set(current);
					next.delete(verb.id);
					return next;
				});
				if (recipe.outputId) addMemory(recipe.outputId);
			}, dreamDurationMs);
			verbTimers.current.set(verb.id, timer);
		},
		[addMemory, cardsById, phase, runningVerbs, verbSlots]
	);

	const returnFromMansus = useCallback(() => {
		if (drawn) addMemory(drawn.id);
		setJourney(current => current + 1);
		setDrawn(undefined);
		setVerbSlots(current => {
			const next = { ...current };
			delete next.dream;
			return next;
		});
		setRunningVerbs(current => {
			const next = new Set(current);
			next.delete('dream');
			return next;
		});
		setPhase('table');
	}, [addMemory, drawn]);

	const tableCameraStyle = {
		'--table-camera-x': `${tableCamera.x}px`,
		'--table-camera-y': `${tableCamera.y}px`,
		'--table-camera-zoom': tableCamera.zoom,
	} as CSSProperties;
	const slottedCardIds = new Set(Object.values(verbSlots));
	const handCards = cards.filter(
		card => !slottedCardIds.has(card.instanceId)
	);

	return (
		<section
			aria-label="Dreaming"
			aria-modal="true"
			className={`${style.overlay} ${leaving ? style.leaving : ''}`}
			ref={dialogRef}
			role="dialog"
			tabIndex={-1}
		>
			<header className={style.tableHeader}>
				<h1 className={style.visuallyHidden}>The table of dreams</h1>
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

			<div
				aria-label="Dream table viewport"
				className={style.tableViewport}
				onLostPointerCapture={onCameraPointerEnd}
				onPointerCancel={onCameraPointerEnd}
				onPointerDown={onCameraPointerDown}
				onPointerMove={onCameraPointerMove}
				onPointerUp={onCameraPointerEnd}
				onWheel={onCameraWheel}
				role="region"
				tabIndex={0}
			>
				<div
					aria-label="Dream table camera"
					className={`${style.tableCamera} ${phase === 'mansus' ? style.mansusCamera : ''}`}
					role="group"
					style={tableCameraStyle}
				>
					<div className={style.table}>
						<main className={style.playArea}>
							<section
								aria-label="Verbs"
								className={style.verbArea}
							>
								{tableVerbs.map(verb => {
									const instanceId = verbSlots[verb.id];
									const instance = instanceId
										? cardsById.get(instanceId)
										: undefined;
									const recipe =
										instance && recipeFor(verb, instance.card);
									const running = runningVerbs.has(verb.id);
									return (
										<div
											aria-label={verb.label}
											className={style.verb}
											key={verb.id}
											role="region"
											title={verb.label}
										>
											<span
												aria-hidden="true"
												className={style.verbMoon}
											>
												{verb.sigil}
											</span>
											<h2 className={style.visuallyHidden}>
												{verb.label}
											</h2>
											<div
												aria-label={`${verb.label} card slot`}
												className={`${style.cardSlot} ${instance ? style.filledSlot : ''}`}
												data-dream-verb={verb.id}
											>
												{instance ? (
													<TableCardView
														card={instance}
														inSlot
														onActivate={() =>
															returnCardToHand(
																instance.instanceId
															)
														}
														onDropAt={position =>
															dropCardAt(
																instance.instanceId,
																position
															)
														}
													/>
												) : (
													<span aria-hidden="true">+</span>
												)}
											</div>
											<button
												aria-label={
													recipe?.label ??
													`${verb.label} has no matching recipe`
												}
												className={style.verbButton}
												disabled={
													!recipe || running || phase !== 'table'
												}
												onClick={() => beginVerb(verb)}
												title={recipe?.label ?? verb.label}
												type="button"
											>
												<span aria-hidden="true">
													{running ? '···' : '▶'}
												</span>
											</button>
											{running && (
												<div
													aria-label={`${verb.label} in progress`}
													className={style.timer}
													role="progressbar"
												>
													<i aria-hidden="true" />
												</div>
											)}
										</div>
									);
								})}
							</section>

							<section
								aria-label="Your hand"
								className={style.hand}
								data-dream-hand
							>
								<div className={style.handCards}>
									{handCards.map(card => (
										<TableCardView
											card={card}
											key={card.instanceId}
											onActivate={() =>
												placeCardInFirstVerb(card)
											}
											onDropAt={position =>
												dropCardAt(card.instanceId, position)
											}
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
				</div>
			</div>

			{phase !== 'mansus' && (
				<div
					aria-label="Table camera controls"
					className={style.cameraControls}
					role="group"
				>
					<button
						aria-keyshortcuts="1"
						aria-label="Zoom table out"
						onClick={() => setTableZoomLevel(tableZoomLevels[0])}
						title="Zoom out"
						type="button"
					>
						<span aria-hidden="true">−</span>
					</button>
					<button
						aria-keyshortcuts="Home 2"
						aria-label="Reset table view"
						onClick={() => setTableZoomLevel(tableZoomLevels[1])}
						title="Reset view"
						type="button"
					>
						<span aria-hidden="true">◎</span>
					</button>
					<button
						aria-keyshortcuts="3"
						aria-label="Zoom table in"
						onClick={() => setTableZoomLevel(tableZoomLevels[2])}
						title="Zoom in"
						type="button"
					>
						<span aria-hidden="true">+</span>
					</button>
				</div>
			)}
		</section>
	);
}
