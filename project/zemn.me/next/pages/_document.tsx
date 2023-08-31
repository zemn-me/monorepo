import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
	return (
		<Html>
			<Head>
				<meta
					content="Personal website and profile of Thomas Neil James Shadwell, also known as Zemnmez."
					name="description"
				/>
				<link href="https://fonts.googleapis.com" rel="preconnect" />
				<link
					crossOrigin="anonymous"
					href="https://fonts.gstatic.com"
					rel="preconnect"
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400;1,700&display=swap"
					rel="stylesheet"
				/>
			</Head>
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
