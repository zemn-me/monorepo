declare module '*.css' {
	export default undefined;
}

declare module '*.jpg' {
	const url: string;
	export default url;
}

declare module '*.png' {
	const url: string;
	export default url;
}

declare module 'remark-sectionize' {
	// biome-ignore lint/suspicious/noExplicitAny: this type boundary intentionally uses any
	const x: any;
	export default x;
}
