import '../styles/globals.css'
import { Sink } from './sink/sink'
import Head from 'next/head';
import { LocaleProvider } from 'linear2/model/lang';

function MyApp({ Component, pageProps }) {
  return <>
      <LocaleProvider>
        <Sink>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          </Head>
          <Component {...pageProps} />
        </Sink>
      </LocaleProvider>
  </>
}

export default MyApp
