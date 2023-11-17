/**
 * Next.js only!
 */
declare module '*.module.css' {
	const content: Record<string, string>;
	export default content;
}

/**
 * Next.js only!
 */
declare module '*.css' {
	export default undefined;
}

/**
 * Next.js only!
 */
declare module '*.jpg' {
	export const src: string;
	export const height: number;
	export const width: number;
	export const constblurDataURL: string;
	export const blurWidth: number;
	export const blurHeight: number;
}

type LinkBrand = 'hey. please use project/zemn.me/next/components/Link instead';

declare module 'global' {
	global {
		namespace JSX {
			interface IntrinsicElements {
				// Override the `<a>` element
				a: { 'data-brand': LinkBrand };
			}
		}
	}
}
