import Head from 'next/head';

export interface Props {
	readonly children: string;
}

/**
 * A level 1 (H1) heading that also sets the page title.
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
