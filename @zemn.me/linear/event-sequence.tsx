import React from 'react'
import * as svg from '@zemn.me/svg'
import { Ticks, labels, DIRECTION } from '@zemn.me/svg/scale'
import { Dated } from '@zemn.me/interface'
import * as d3Scale from 'd3-scale'

const d3 = {
	...d3Scale,
}

export interface Event extends Dated {
	date: Date
	event: string
}

export interface EventProps {
	children: Event[]
}

export const EventSequence: (props: EventProps) => React.ReactElement = ({
	children,
}) => {
	const sortedDates = children.map(({ date }) => +date).sort()
	const domain = [sortedDates[0], sortedDates.reverse()[0]]

	console.log('domain', domain)
	const scale = d3.scaleTime().domain(domain).range([0, 100])

	return (
		<svg>
			<svg x="0%" y="0%" height="50%">
				<Ticks
					{...{
						scale: labels(
							scale,
							...children.map(
								({ date, event }) => [date, event] as const,
							),
						),
						direction: DIRECTION.Up,
						stroke: 'white',
					}}
				/>
			</svg>

			<line x1="0%" y1="50%" x2="100%" y2="50%" stroke="white" />

			<svg y="50%" height="50%">
				<Ticks
					{...{
						scale: scale,
						ticks: 4,
						direction: DIRECTION.Down,
						stroke: 'white',
					}}
				/>
			</svg>
		</svg>
	)
}
