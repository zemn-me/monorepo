import React from 'react';
import State from '//project/cultist/state';

export interface BoardProps {
	state: State.State;
}

export const Board: React.FC<Readonly<BoardProps>> = ({ state }) => {
	return (
		<>
			{[...(state.elementStacks?.entries() ?? [])].map(
				([key, elementInstance]) => (
					<Card key={key} instance={elementInstance} />
				)
			)}
		</>
	);
};

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
