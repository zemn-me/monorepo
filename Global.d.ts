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

/**
 * Next.js only!
 */
declare module '*.png' {
	export const src: string;
	export const height: number;
	export const width: number;
	export const constblurDataURL: string;
	export const blurWidth: number;
	export const blurHeight: number;
}

declare module 'remark-sectionize' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const x: any
	export default x
}

