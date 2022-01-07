import React from 'react';
import * as State from 'project/cultist/state';
export interface BoardProps {
	state: State.State;
}

export const Table: React.FC<Readonly<BoardProps>> = ({ state }) => {
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

			<Board state={state} />

			{[...(state.decks?.entries() ?? [])].map(([name, deck]) => (
				<Deck key={name} name={name} deck={deck} />
			))}
		</>
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
}

export const Board: React.FC<BoardProps> = ({
	state: { elementStacks, situations },
	minX = State.boardMinX,
	maxX = State.boardMaxX,
	maxY = State.boardMaxY,
	minY = State.boardMinY,
	defaultX = 0,
	defaultY = 0,
	cardHeight = State.cardHeight,
	cardWidth = State.cardWidth,
}) => (
	<svg
		viewBox={`${minX} ${minY} ${maxX} ${maxY}`}
		style={{
			width: '100vw',
			height: '100vh',
		}}
	>
		{elementStacks?.map((e, i) => (
			<foreignObject
				key={i}
				x={e.lastTablePosX ?? defaultX}
				y={e.lastTablePosY ?? defaultY}
				height={cardHeight}
				width={cardWidth}
			>
				<Card xmlns="http://www.w3.org/1999/xhtml" instance={e} />
			</foreignObject>
		)) ?? null}
	</svg>
);

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
				<ol>
					{deck.cards?.map(name => (
						<li key={name}>{name}</li>
					))}
				</ol>
			</figure>
		) : null}
	</figure>
);

export interface CardProps {
	instance: State.ElementInstance;
	xmlns?: string;
}

export const Card: React.FC<Readonly<CardProps>> = ({ instance: i, xmlns }) => {
	return (
		<div
			{...({ xmlns } as unknown)}
			style={{
				border: '1px solid black',
				boxSizing: 'border-box',
				height: '100%',
				width: '100%',
			}}
		>
			{/* needed to inject xmlns */}
			{i.elementId} ({i.quantity}) ({i.lifetimeRemaining}s)
		</div>
	);
};

export interface CardTimeDisplayProps {
	seconds?: number;
}

export const CardTimeDisplay: React.FC<Readonly<CardTimeDisplayProps>> = ({
	seconds,
}) => (seconds !== undefined ? <>expires in: {seconds} seconds</> : null);
