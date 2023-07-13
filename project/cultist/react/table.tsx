import * as State from 'project/cultist/state';
import React from 'react';
// stubbed out because IDK how to fix style issues right now.
//import style from './table.module.css';

export interface TableProps {
	state: State.State;
	onElementChange: (
		elementkey: string,
		newElement: State.ElementInstance
	) => void;
}

export const Table: React.FC<Readonly<TableProps>> = ({
	onElementChange,
	state,
}) => {
	const onElementMove = React.useCallback(
		(
			X: number,
			Y: number,
			elementKey: string,
			element: State.ElementInstance
		) =>
			onElementChange(
				elementKey,
				element.withMutations(el =>
					el.set('lastTablePosX', X).set('lastTablePosY', Y)
				)
			),
		[onElementChange]
	);
	return (
		<>
			{state.metainfo ? (
				<figure>
					<figcaption>Metadata</figcaption>
					<dl>
						<dt>Version Number</dt>
						<dd>{state.metainfo.VERSIONNUMBER}</dd>
					</dl>
				</figure>
			) : null}
			{state.characterDetails ? (
				<figure>
					<header>Character Details</header>
					<dl>
						<dt>Name</dt>
						<dd>{state.characterDetails.toJSON().name}</dd>

						<dt>Profession</dt>
						<dd>{state.characterDetails.profession}</dd>
					</dl>
				</figure>
			) : null}

			<Board onElementMove={onElementMove} state={state} />
		</>
	);
};

export interface SlotProps {
	X: number;
	Y: number;
	width: number;
	height: number;
	onDrop: (
		X: number,
		Y: number,
		event: React.DragEvent<HTMLDivElement>
	) => void;
}

export const Slot: React.FC<SlotProps> = ({
	X,
	Y,
	width,
	height,
	onDrop: _onDrop,
}) => {
	const onDragOver: React.DragEventHandler<HTMLDivElement> =
		React.useCallback(e => {
			e.preventDefault();
		}, []);

	const onDrop: React.DragEventHandler<HTMLDivElement> = React.useCallback(
		e => _onDrop(X, Y, e),
		[X, Y, _onDrop]
	);

	return (
		<foreignObject height={height} width={width} x={X} y={Y}>
			<div
				onDragOver={onDragOver}
				onDrop={onDrop}
				style={{ width: '100%', height: '100%' }}
			/>
		</foreignObject>
	);
};

export interface BoardProps {
	state: State.State;
	minX?: number;
	minY?: number;
	maxX?: number;
	maxY?: number;
	cardWidth?: number;
	cardHeight?: number;
	defaultX?: number;
	defaultY?: number;
	snapGridWidth?: number;
	snapGridHeight?: number;
}

export interface BoardProps {
	state: State.State;
	onElementMove: (
		X: number,
		Y: number,
		stateKey: string,
		element: State.ElementInstance
	) => void;
}

export const Board: React.FC<BoardProps> = ({
	state: { elementStacks },
	minX = State.boardMinX,
	maxX = State.boardMaxX,
	maxY = State.boardMaxY,
	minY = State.boardMinY,
	cardHeight = State.cardHeight,
	cardWidth = State.cardWidth,
	snapGridWidth = State.cardWidth,
	snapGridHeight = State.cardHeight,
	onElementMove,
}) => {
	const onDrop = React.useCallback(
		(x: number, y: number, event: React.DragEvent<HTMLDivElement>) => {
			const { elementKey } = JSON.parse(
				event.dataTransfer.getData('application/json+elementKey')
			) as { elementKey: string };
			onElementMove(x, y, elementKey, elementStacks!.get(elementKey)!);
		},
		[elementStacks, onElementMove]
	);

	const droppableSlots = [];

	for (let x = minX; x < maxX; x += snapGridWidth) {
		for (let y = minY; y < maxY; y += snapGridHeight) {
			droppableSlots.push(
				<Slot
					X={x}
					Y={y}
					height={snapGridHeight}
					key={`${x}-${y}`}
					onDrop={onDrop}
					width={snapGridWidth}
				/>
			);
		}
	}

	return (
		<svg>
			{droppableSlots}
			{elementStacks?.map((e, i) => (
				<Card
					element={e}
					elementKey={i}
					h={cardHeight}
					key={i}
					w={cardWidth}
				/>
			)) ?? null}
		</svg>
	);
};

export interface DeckProps {
	name: string;
	deck: State.Deck;
}

export const Deck: React.FC<Readonly<DeckProps>> = ({ name, deck }) => (
	<figure>
		<figcaption>Deck: {name}</figcaption>

		{(deck.eliminatedCards?.size ?? 0) > 0 ? (
			<figure>
				<figcaption>Eliminated Cards</figcaption>
				<ol>
					{deck.eliminatedCards?.map(name => (
						<li key={name}>{name}</li>
					))}
				</ol>
			</figure>
		) : null}

		{(deck.cards?.size ?? 0) > 0 ? (
			<figure>
				<figcaption>Cards</figcaption>
				<ol>{deck.cards?.map(name => <li key={name}>{name}</li>)}</ol>
			</figure>
		) : null}
	</figure>
);

export interface CardProps {
	element: State.ElementInstance;
	elementKey: string;
	h: number;
	w: number;
}

export const Card: React.FC<Readonly<CardProps>> = ({
	elementKey,
	h,
	w,
	element: e,
}) => {
	const onDragStart: React.DragEventHandler<HTMLDivElement> =
		React.useCallback(ev => {
			if (!ev.dataTransfer) return;
			ev.dataTransfer.effectAllowed = 'move';
			ev.dataTransfer.setData(
				'application/json+elementKey',
				JSON.stringify({
					elementKey,
				})
			);
		}, []);
	return (
		<foreignObject
			height={h}
			width={w}
			x={e.lastTablePosX ?? 0}
			y={e.lastTablePosY ?? 0}
		>
			{/* needed to inject xmlns, not in types */}
			<div
				{...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)}
				draggable="true"
				onDragStart={onDragStart}
			>
				{/* this is thomas again. I have no idea what this ^ was meant to mean */}
				{e.elementId} ({e.quantity}) ({e.lifetimeRemaining}s)
			</div>
		</foreignObject>
	);
};

export interface CardTimeDisplayProps {
	seconds?: number;
}

export const CardTimeDisplay: React.FC<Readonly<CardTimeDisplayProps>> = ({
	seconds,
}) => (seconds !== undefined ? <>expires in: {seconds} seconds</> : null);
