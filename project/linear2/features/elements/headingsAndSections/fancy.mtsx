import { classes } from 'linear2/features/elements/util';
import React from 'react';

import * as base from './headingsAndSections';

export interface HeadingProps<
	depth extends 1 | 2 | 3 | 4 | 5 = 1 | 2 | 3 | 4 | 5
> {
	heading: React.ReactElement;
	subtitle?: React.ReactElement;
	id?: string;
	withSubtitle?: boolean;
}

type _X<T> = [T] | [T, T] | [T, T, T] | [T, T, T, T] | [T, T, T, T, T];

export interface FancyHeaderProps {
	headings: _X<HeadingProps>;
	className?: string;
}

export const Header = React.forwardRef<HTMLElement, FancyHeaderProps>(
	({ headings, className }) => (
		<header
			{...{
				...classes(className),
			}}
		>
			{headings.map(({ heading, subtitle }, i, a) =>
				React.createElement(
					['h1', 'h2', 'h3', 'h4', 'h5'][i],
					{
						subtitle,
						withSubtitle: i == a.length - 1,
						ref: i,
					},
					heading
				)
			)}
		</header>
	)
);

export type SectionProps = base.SectionProps;

export const Section = React.forwardRef<base.HTMLSectionElement, SectionProps>(
	(props, ref) => (
		<base.Section
			{...{
				...props,
				withSectionMarkers: true,
				ref,
			}}
		/>
	)
);
