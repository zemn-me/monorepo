import '../styles/globals.css'
import React from 'react';
import { Sink } from './sink/sink'
import Head from 'next/head';
import { LocaleProvider } from 'linear2/model/lang';
import Transition from './transition/transition';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  return <>
      <LocaleProvider>
            <Head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            </Head>
            <Sink>
          <Transition location={router.pathname}>
              <Component {...pageProps} />
          </Transition>
            </Sink>
      </LocaleProvider>
  </>
}

export default React.memo(MyApp)
