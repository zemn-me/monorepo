declare module '*.module.css' {
	const content: Record<string, string>;
	export default content;
}

declare module '*.css' {
	export default undefined;
}
