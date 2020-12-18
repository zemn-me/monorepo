import '../styles/globals.css'
import { Sink } from './sink/sink'
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return <>
    <Sink>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      </Head>
      <Component {...pageProps} />
    </Sink>
  </>
}

export default MyApp
