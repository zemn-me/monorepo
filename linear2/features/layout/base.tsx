import React from 'react';
import Footer from 'pages/footer';
import Head from 'next/head';
import * as elements from 'linear2/features/elements';

import {
    RecoilRoot,
} from 'recoil';


export const Base: React.FC = ({ children }) => <RecoilRoot>
    <Head>
        <meta httpEquiv="Content-Security-Policy"
            content={[
                "default-src 'self'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "img-src 'self' data:",
                "font-src 'self' https://fonts.gstatic.com"
            ].join("; ")}/>

        <meta httpEquiv="Cross-Origin-Resource-Policy" content="same-origin"/>

        <meta httpEquiv="Cross-Origin-Opener-Policy" content="same-origin"/>
        <meta httpEquiv="X-Content-Type-Options" content="nosniff"/>

        <meta name="referrer" content="no-referrer"/>
    </Head>

    <main className={`${elements.style.root}`}>
        {children}
        <Footer/>
    </main>
</RecoilRoot>

export default Base;