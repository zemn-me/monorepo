import '../styles/globals.css'
import React from 'react'
import { Sink } from 'layouts/sink'
import Head from 'next/head'
import { LocaleProvider } from 'linear2/model/lang'
import { useRouter } from 'next/router'
import Transition from 'layouts/transition'

function MyApp({ Component, pageProps }) {
	const router = useRouter()
	return (
		<>
			<LocaleProvider>
				<Head>
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1.0"
					/>
				</Head>
				<Sink>
					<Transition location={router.pathname}>
						<Component {...pageProps} />
					</Transition>
				</Sink>
			</LocaleProvider>
		</>
	)
}

export default React.memo(MyApp)
