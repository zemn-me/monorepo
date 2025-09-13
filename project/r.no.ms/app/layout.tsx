import './style.css';
import { Open_Sans } from 'next/font/google';
import { ReactNode } from 'react';

const openSans = Open_Sans({
        weight: ['400', '700'],
        subsets: ['latin'],
        display: 'swap'
});

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html>
			<head>
				<title>Resistor Colour Identifier / Calculator</title>
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1"
				/>
				<meta
					name="Description"
					content="A resistor colour calculator that works in reverse, is free, works on mobile, is easy to use and doesn't look like crap."
				/>
                               <link rel="icon" type="image/png" href="/i.png" />
                               <link rel="apple-touch-icon" href="/i-lrg.png" />
                       </head>
                       <body className={openSans.className}>{children}</body>
               </html>
       );
}
