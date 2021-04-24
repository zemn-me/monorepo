import * as model from 'linear2/model'

export const fromEntries: typeof Object.fromEntries =
	Object.fromEntries ??
	(<T extends any = any>(entries: Iterable<readonly [PropertyKey, T]>) => {
		const o: any = {}
		for (const [k, v] of entries) o[k] = v
		return o
	})

export const toComponents = (elements: any) =>
	fromEntries(
		Object.entries(elements).map(([k, v]) => [
			k[0].toLowerCase() + k.slice(1),
			v,
		]),
	)

export interface MDXCreateElementProps {
	children?: React.ReactElement
	mdxType?: string
	originalType?: string
	[key: string]: unknown
}

export interface MDXCreateElementType
	extends React.ExoticComponent<MDXCreateElementProps> {
	displayName: 'MDXCreateElement'
}

export interface MDXCreateElement
	extends React.ReactElement<
		MDXCreateElementProps,
		React.ExoticComponent<MDXCreateElementProps>
	> {
	type: MDXCreateElementType
}

function isMDXCreateElement(v: React.ReactElement): v is MDXCreateElement {
	return (v as any)?.type?.displayName == 'MDXCreateElement'
}

export function* visit<
	T2,
	T extends { props?: { children?: T2 | T | undefined | T[] } }
>(...nodes: T[]): IterableIterator<T | T2> {
	for (const elem of nodes) {
		if (elem == undefined) continue
		// only yield if not an array
		if (elem instanceof Array) {
			yield* visit(...elem)
			continue
		}

		yield elem

		if (!(typeof elem == 'object')) continue
		if (!('props' in elem)) continue
		yield* elem?.props?.children instanceof Array
			? visit(...elem.props.children!)
			: (visit(elem.props!.children!) as any)
	}
}
interface ExtractableChildProps {
	children?:
		| ExtractableChildElement
		| ExtractableChildElement[]
		| string
		| null
}

type ExtractableChildElement = React.ReactElement<ExtractableChildProps>

/**
 * Attempt to extract text from a React tree. Only works statically. Use with care!
 */
export function extractText(
	r: React.ReactElement<ExtractableChildProps>,
): string {
	return [
		...model.iter.filter(
			visit<string | null, ExtractableChildElement>(r),
			(
				el: React.ReactElement<ExtractableChildProps> | string | null,
			): el is string => typeof el === 'string',
		),
	].join('')
}

export function* getMdxElement(
	r: React.ReactElement<ExtractableChildProps>,
): IterableIterator<MDXCreateElement> {
	yield* model.iter.filter(
		visit<string | null, ExtractableChildElement>(r),
		(v: ExtractableChildElement | null | string): v is MDXCreateElement =>
			typeof v !== 'string' && v !== null && isMDXCreateElement(v),
	)
}

/**
 * Returns the first h1 element in an MDX tree, or undefined
 */
export function getTitle(
	r: React.ReactElement<ExtractableChildProps>,
): string | undefined {
	const el = model.iter
		.filter(getMdxElement(r), (e) => e.props.mdxType == 'h1')
		.next().value

	// exotic components are confusing af to react
	return el ? extractText(el as any) : undefined
}
