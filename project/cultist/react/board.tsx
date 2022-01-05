import React from 'react';
import * as State from 'project/cultist/state';

export interface BoardProps {
	state: State.State;
}

export const Board: React.FC<Readonly<BoardProps>> = ({ state }) => {
	return (
		<>
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
			{[...(state.elementStacks?.entries() ?? [])].map(
				([key, elementInstance]) => (
					<Card key={key} instance={elementInstance} />
				)
			)}

			{[...(state.decks?.entries() ?? [])].map(([name, deck]) => (
				<Deck key={name} name={name} deck={deck} />
			))}
		</>
	);
};

export interface DeckProps {
	name: string;
	deck: State.Deck;
}

export const Deck: React.FC<Readonly<DeckProps>> = ({ name, deck }) => (
	<figure>
		<figcaption>Deck: {name}</figcaption>

		{(() => {
			console.log(deck);
			return null;
		})()}

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
}

export const Card: React.FC<Readonly<CardProps>> = ({ instance }) => {
	return (
		<div>
			Card:
			<ul>
				{instance.elementId ? (
					<li>element: {instance.elementId}</li>
				) : null}
				{instance.lifetimeRemaining ? (
					<li>
						<CardTimeDisplay seconds={instance.lifetimeRemaining} />
					</li>
				) : null}
				{instance.quantity ? (
					<li>quantity: {instance.quantity}</li>
				) : null}
				<li>{JSON.stringify(instance)}</li>
			</ul>
		</div>
	);
};

export interface CardTimeDisplayProps {
	seconds?: number;
}

export const CardTimeDisplay: React.FC<Readonly<CardTimeDisplayProps>> = ({
	seconds,
}) => (seconds !== undefined ? <>expires in: {seconds} seconds</> : null);
