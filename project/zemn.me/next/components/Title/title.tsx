import Head from 'next/head';

export interface Props {
	readonly children: string;
}

/**
 * A next.js React component that is both an <h1> element and a <head><title> element.
 */
export function Title({ children: title }: Props) {
	return (
		<>
			<Head>
				<title>{title}</title>
			</Head>
			<h1>{title}</h1>
		</>
	);
}
