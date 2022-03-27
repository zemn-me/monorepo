import { filter, uniq } from 'ts/iter';


export { filter, uniq };



export const classes: (...classes: (string | undefined)[]) =>
	| { className: undefined }
	| {
			className: string;
	  } = (...classes) => {
	const definedClasses = [
		...uniq(
			filter(
				classes,
				(v: string | undefined): v is string =>
					v !== undefined && v.trim() != ''
			)
		),
	];

	if (!definedClasses.length) return {};

	return { className: definedClasses.join(' ') };
};

export type PropsOf<T extends keyof JSX.IntrinsicElements> =
	JSX.IntrinsicElements[T];

export const prettyAnchor = (s: string | undefined) => s?.replace(/ /g, '_');

export const fromEntries: <K extends string | symbol | number, V>(
	...v: readonly (readonly [K, V])[]
) => Record<K, V> = (...v) =>
	v.reduce((p, [k, v]) => ((p[k] = v), p), {} as any);
