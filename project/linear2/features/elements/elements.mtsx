/* eslint-disable jsx-a11y/heading-has-content, jsx-a11y/anchor-has-content */

import React from 'react';

import style from './base.module.sass';
import * as fancy from './fancy';
import { Style, text } from './style';

export { Date as date } from './date';
export { Text as dateText } from './date';
export * from './text';
export { default as Void } from './void';

export { fancy };
export * from './extraElements';
export * from './headingsAndSections';
import * as elementUtil from 'linear2/features/elements/util';
export { default as style } from './base.module.sass';

const pick: <I extends object, K extends keyof I>(
	i: I,
	...k: K[]
) => Pick<I, K> = (i, ...k) =>
	k.reduce((a, c) => ((a[c] = i[c]), a), {} as any);
type ValueOf<T> = T[keyof T];
type Filter<T, Q> = Pick<
	T,
	ValueOf<{ [K in keyof T]: T[K] extends Q ? K : never }>
>;
type ClassableElements = Filter<JSX.IntrinsicElements, { className?: string }>;

const e: <
	E extends keyof ClassableElements,
	K extends keyof ClassableElements[E]
>(
	name: E,
	...propNames: K[]
) => React.FC<ClassableElements[E]> =
	(e, ...k) =>
	props =>
		<Style>{React.createElement(e, pick(props, ...k))}</Style>;
type PropsOf<T extends React.FC<unknown>> = T extends React.FC<infer Q>
	? Q
	: never;

function s<T, P = {}>(I: React.ForwardRefExoticComponent<P>) {
	return React.forwardRef<T, P>((props, ref) => (
		<Style>
			<I {...{ ...props, ref }} />
		</Style>
	));
}

export const frac: React.FC = ({ children }) => (
	<Style>
		<span className={style.frac}>{children}</span>
	</Style>
);

export const Ss02: React.FC = ({ children }) => (
	<Style>
		<div className={style.ss02}>{children}</div>
	</Style>
);

export { Ss02 as ss02 };

export const fine: React.FC = () => <Ss02>fine</Ss02>;
export const ok: React.FC = () => <Ss02>ok</Ss02>;
export const paper: React.FC = () => <Ss02>paper</Ss02>;
export const scissors: React.FC = () => <Ss02>scissors</Ss02>;
export const stone: React.FC = () => <Ss02>stone</Ss02>;

export const chem: React.FC<{ formula: string; name?: string }> = ({
	formula,
	name,
}) =>
	name ? (
		<abbr className={style.chemical} title={name}>
			<ChemStr>{formula}</ChemStr>
		</abbr>
	) : (
		<ChemStr>{formula}</ChemStr>
	);

function* matchAll(s: string, re: RegExp) {
	for (;;) {
		const match = re.exec(s);
		if (match == null) return;
		yield match;
	}
}

const ChemStr: React.FC<{ children: string }> = ({ children }) => (
	<>
		{[
			...matchAll(
				children as string,
				/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+|[^ABCDEFGHIJKLMNOPQRSTUVWZYZ]+/g
			),
		].map(([c], i) =>
			!/[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/.test(c) ? (
				<span className={style.chem} key={i}>
					{c}
				</span>
			) : (
				<React.Fragment key={i}>{c}</React.Fragment>
			)
		)}
	</>
);

export { text };
export { Arrow } from './Arrow';
