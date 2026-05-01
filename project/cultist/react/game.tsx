'use client';

import type { ReactElement } from 'react';
import { useId, useMemo, useState } from 'react';

import type {
	CardDefinition,
	CardQuantity,
	GameState,
	LogEntry,
	Operation,
	RecipeStatus,
	VerbId,
} from '#root/project/cultist/game.js';
import {
	advanceTime,
	advanceToNextCompletion,
	cards,
	endingLabels,
	newGame,
	nextCompletionIn,
	recipe,
	recipeStatuses,
	startRecipe,
	verbs,
	visibleInventory,
} from '#root/project/cultist/game.js';

import style from './game.module.css';

export interface CultistGameProps {
	readonly initialState?: GameState;
}

const verbOrder: readonly VerbId[] = [
	'work',
	'study',
	'dream',
	'explore',
	'talk',
];

function formatTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;

	if (minutes === 0) return `${remainder}s`;
	if (remainder === 0) return `${minutes}m`;
	return `${minutes}m ${remainder}s`;
}

function Progress({ operation }: Readonly<{ operation: Operation }>) {
	const completed = 1 - operation.remaining / operation.total;

	return (
		<div
			aria-label={`${recipe(operation.recipeId).label} progress`}
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={Math.round(completed * 100)}
			className={style.progress}
			role="progressbar"
		>
			<span style={{ width: `${Math.round(completed * 100)}%` }} />
		</div>
	);
}

function Card({
	card,
	count,
}: Readonly<{
	card: CardDefinition;
	count: number;
}>) {
	return (
		<li>
			<CardDetails card={card} count={count} />
		</li>
	);
}

function CardDetails({
	card,
	count,
}: Readonly<{
	card: CardDefinition;
	count: number;
}>) {
	const aspects = Object.entries(card.aspects);

	return (
		<div className={`${style.card} ${style[card.tone]}`}>
			<div className={style.cardHeader}>
				<strong>{card.label}</strong>
				<span>{count}</span>
			</div>
			<p>{card.description}</p>
			{aspects.length > 0 ? (
				<dl className={style.aspects}>
					{aspects.map(([aspect, value]) => (
						<div key={aspect}>
							<dt>{aspect}</dt>
							<dd>{value}</dd>
						</div>
					))}
				</dl>
			) : null}
		</div>
	);
}

function CardReference({
	quantity,
}: Readonly<{
	quantity: CardQuantity;
}>) {
	const tooltipId = useId();
	const card = cards[quantity.card];

	return (
		<div className={style.cardReference}>
			<span
				aria-describedby={tooltipId}
				className={style.cardReferenceName}
				tabIndex={0}
			>
				{card.label}
				{quantity.count > 1 ? (
					<span className={style.cardReferenceCount}>
						x{quantity.count}
					</span>
				) : null}
			</span>
			<div className={style.cardTooltip} id={tooltipId} role="tooltip">
				<CardDetails card={card} count={quantity.count} />
			</div>
		</div>
	);
}

function LogCards({ entry }: Readonly<{ entry: LogEntry }>) {
	const groups = [
		{ cards: entry.inputs, label: 'In' },
		{ cards: entry.outputs, label: 'Out' },
	].filter(
		(group): group is { cards: readonly CardQuantity[]; label: string } =>
			(group.cards?.length ?? 0) > 0
	);

	if (groups.length === 0) return null;

	return (
		<dl className={style.logCards}>
			{groups.map(group => (
				<div key={group.label}>
					<dt>{group.label}</dt>
					<dd>
						<ul className={style.logCardList}>
							{group.cards.map(quantity => (
								<li key={quantity.card}>
									<CardReference quantity={quantity} />
								</li>
							))}
						</ul>
					</dd>
				</div>
			))}
		</dl>
	);
}

function RecipeButton({
	onStart,
	status,
}: Readonly<{
	onStart: (recipeId: string) => void;
	status: RecipeStatus;
}>) {
	const { recipe: definition } = status;

	return (
		<li
			className={
				status.available
					? style.recipe
					: `${style.recipe} ${style.blocked}`
			}
		>
			<div className={style.recipeBody}>
				<h3>{definition.label}</h3>
				<p>{definition.startText}</p>
				<span>{formatTime(definition.duration)}</span>
			</div>
			{status.available ? (
				<button
					aria-label={`Start ${definition.label}`}
					onClick={() => onStart(definition.id)}
					type="button"
				>
					Start
				</button>
			) : (
				<span className={style.blockedReason}>
					{status.blockedReason}
				</span>
			)}
		</li>
	);
}

function VerbLane({
	onStart,
	operation,
	statuses,
	verb,
}: Readonly<{
	onStart: (recipeId: string) => void;
	operation?: Operation;
	statuses: readonly RecipeStatus[];
	verb: VerbId;
}>) {
	const sorted = [...statuses].sort(
		(a, b) => Number(b.available) - Number(a.available)
	);

	return (
		<section className={style.verbLane}>
			<header className={style.verbHeader}>
				<div>
					<h2>{verbs[verb].label}</h2>
					<p>{verbs[verb].description}</p>
				</div>
				{operation === undefined ? (
					<span>Idle</span>
				) : (
					<span>{formatTime(operation.remaining)}</span>
				)}
			</header>
			{operation === undefined ? null : (
				<div className={style.operation}>
					<strong>{recipe(operation.recipeId).label}</strong>
					<Progress operation={operation} />
				</div>
			)}
			<ul className={style.recipeList}>
				{sorted.map(status => (
					<RecipeButton
						key={status.recipe.id}
						onStart={onStart}
						status={status}
					/>
				))}
			</ul>
		</section>
	);
}

export function CultistGame({
	initialState = newGame(),
}: CultistGameProps): ReactElement {
	const [state, setState] = useState<GameState>(initialState);
	const statuses = useMemo(() => recipeStatuses(state), [state]);
	const nextTimer = nextCompletionIn(state);
	const ending =
		state.ending === undefined ? undefined : endingLabels[state.ending];

	const onStart = (recipeId: string) => {
		setState(current => startRecipe(current, recipeId));
	};

	const onResolveNext = () => {
		setState(advanceToNextCompletion);
	};

	const onWait = () => {
		setState(current => advanceTime(current, 30));
	};

	const onReset = () => {
		setState(newGame());
	};

	return (
		<main className={style.game}>
			<header className={style.topbar}>
				<div>
					<h1>Cultist Simulator</h1>
					<p>{ending ?? 'An unfinished history'}</p>
				</div>
				<div className={style.clock}>
					<span>{formatTime(state.time)}</span>
					<span>Season {formatTime(state.nextSeasonAt - state.time)}</span>
				</div>
				<div className={style.controls}>
					<button
						disabled={nextTimer === undefined}
						onClick={onResolveNext}
						type="button"
					>
						Resolve next
					</button>
					<button
						disabled={state.ending !== undefined}
						onClick={onWait}
						type="button"
					>
						Wait 30s
					</button>
					<button onClick={onReset} type="button">
						New history
					</button>
				</div>
			</header>

			<section className={style.table}>
				<div className={style.verbs}>
					{verbOrder.map(verb => (
						<VerbLane
							key={verb}
							onStart={onStart}
							operation={state.operations[verb]}
							statuses={statuses.filter(
								status => status.recipe.verb === verb
							)}
							verb={verb}
						/>
					))}
				</div>

				<aside className={style.inventory}>
					<h2>Table</h2>
					<ul className={style.cards}>
						{visibleInventory(state).map(([card, count]) => (
							<Card card={card} count={count} key={card.id} />
						))}
					</ul>
				</aside>

				<aside className={style.log}>
					<h2>History</h2>
					<ol>
						{[...state.log].reverse().map((entry, index) => (
							<li className={style[entry.kind]} key={`${entry.at}-${index}`}>
								<span>{formatTime(entry.at)}</span>
								<strong>{entry.title}</strong>
								<p>{entry.text}</p>
								<LogCards entry={entry} />
							</li>
						))}
					</ol>
				</aside>
			</section>
		</main>
	);
}

export default CultistGame;
