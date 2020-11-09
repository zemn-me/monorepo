import React from 'react';
import Head from 'next/head';

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

        <meta name="referrer" content="no-referrer"/>
    </Head>
    {children}
</RecoilRoot>

export default Base;