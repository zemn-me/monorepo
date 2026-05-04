'use client';

import type { ReactElement } from 'react';
import { useId, useMemo, useState } from 'react';

import type { CoreContent } from '#root/project/cultist/content.js';
import type {
	CardDefinition,
	CardQuantity,
	GameData,
	GameState,
	LogEntry,
	Operation,
	RecipeStatus,
	VerbId,
} from '#root/project/cultist/game.js';
import {
	advanceTime,
	advanceToNextCompletion,
	cardLabel,
	cardTone,
	endingLabel,
	indexCore,
	newGame,
	nextCompletionIn,
	recipe,
	recipeStatuses,
	startRecipe,
	verb as getVerb,
	visibleInventory,
	visibleVerbIds,
} from '#root/project/cultist/game.js';

import style from './game.module.css';

export interface CultistGameProps {
	readonly core: CoreContent;
	readonly initialState?: GameState;
}

function formatTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;

	if (minutes === 0) return `${remainder}s`;
	if (remainder === 0) return `${minutes}m`;
	return `${minutes}m ${remainder}s`;
}

function Progress({
	data,
	operation,
}: Readonly<{ data: GameData; operation: Operation }>) {
	const completed =
		operation.total === 0 ? 1 : 1 - operation.remaining / operation.total;
	const label = recipe(data, operation.recipeId).label ?? operation.recipeId;

	return (
		<div
			aria-label={`${label} progress`}
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
	const aspects = Object.entries(card.aspects ?? {});
	const tone = cardTone(card);

	return (
		<div className={`${style.card} ${style[tone]}`}>
			<div className={style.cardHeader}>
				<strong>{card.label ?? card.id}</strong>
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
	data,
	quantity,
}: Readonly<{
	data: GameData;
	quantity: CardQuantity;
}>) {
	const tooltipId = useId();
	const card = data.elements.get(quantity.card);

	return (
		<div className={style.cardReference}>
			<span
				aria-describedby={tooltipId}
				className={style.cardReferenceName}
				tabIndex={0}
			>
				{cardLabel(data, quantity.card)}
				{quantity.count > 1 ? (
					<span className={style.cardReferenceCount}>
						x{quantity.count}
					</span>
				) : null}
			</span>
			{card === undefined ? null : (
				<div className={style.cardTooltip} id={tooltipId} role="tooltip">
					<CardDetails card={card} count={quantity.count} />
				</div>
			)}
		</div>
	);
}

function LogCards({
	data,
	entry,
}: Readonly<{ data: GameData; entry: LogEntry }>) {
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
									<CardReference data={data} quantity={quantity} />
								</li>
							))}
						</ul>
					</dd>
				</div>
			))}
		</dl>
	);
}

function LogSource({ entry }: Readonly<{ entry: LogEntry }>) {
	if (entry.source === undefined) return null;

	return (
		<p className={style.logSource}>
			{entry.source.kind === 'linked' ? 'Linked from' : 'Triggered by'}{' '}
			<span>{entry.source.title}</span>
		</p>
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
				<h3>{definition.label ?? definition.id}</h3>
				<p>{definition.startdescription}</p>
				<span>{formatTime(definition.warmup ?? 0)}</span>
			</div>
			{status.available ? (
				<button
					aria-label={`Start ${definition.label ?? definition.id}`}
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
	data,
	onStart,
	operation,
	statuses,
	verb,
}: Readonly<{
	data: GameData;
	onStart: (recipeId: string) => void;
	operation?: Operation;
	statuses: readonly RecipeStatus[];
	verb: VerbId;
}>) {
	const sorted = [...statuses].sort(
		(a, b) => Number(b.available) - Number(a.available)
	);
	const verbDefinition = getVerb(data, verb);

	return (
		<section className={style.verbLane}>
			<header className={style.verbHeader}>
				<div>
					<h2>{verbDefinition.label}</h2>
					<p>{verbDefinition.description}</p>
				</div>
				{operation === undefined ? (
					<span>Idle</span>
				) : (
					<span>{formatTime(operation.remaining)}</span>
				)}
			</header>
			{operation === undefined ? null : (
				<div className={style.operation}>
					<strong>{recipe(data, operation.recipeId).label}</strong>
					<Progress data={data} operation={operation} />
				</div>
			)}
			<ul className={style.recipeList}>
				{sorted.slice(0, 60).map(status => (
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
	core,
	initialState,
}: CultistGameProps): ReactElement {
	const data = useMemo(() => indexCore(core), [core]);
	const [state, setState] = useState<GameState>(
		() => initialState ?? newGame(data)
	);
	const statuses = useMemo(() => recipeStatuses(data, state), [data, state]);
	const visibleVerbs = useMemo(
		() => visibleVerbIds(data, state, statuses),
		[data, state, statuses]
	);
	const nextTimer = nextCompletionIn(state);
	const ending =
		state.ending === undefined ? undefined : endingLabel(data, state.ending);

	const onStart = (recipeId: string) => {
		setState(current => startRecipe(data, current, recipeId));
	};

	const onResolveNext = () => {
		setState(current => advanceToNextCompletion(data, current));
	};

	const onWait = () => {
		setState(current => advanceTime(data, current, 30));
	};

	const onReset = () => {
		setState(newGame(data));
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
					{visibleVerbs.map(verb => (
						<VerbLane
							data={data}
							key={verb}
							onStart={onStart}
							operation={state.operations[verb]}
							statuses={statuses.filter(
								status => status.recipe.actionid === verb
							)}
							verb={verb}
						/>
					))}
				</div>

				<aside className={style.inventory}>
					<h2>Table</h2>
					<ul className={style.cards}>
						{visibleInventory(data, state).map(([card, count]) => (
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
									<LogSource entry={entry} />
									<p>{entry.text}</p>
									<LogCards data={data} entry={entry} />
								</li>
						))}
					</ol>
				</aside>
			</section>
		</main>
	);
}

export default CultistGame;
