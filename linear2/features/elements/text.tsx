import * as model from 'linear2/model';
import React from 'react';


interface WithLangProps {
    children: React.ReactElement<{ lang?: string }>
    lang: string
}

/**
 * Returns a lang parameter if the lang parameter
 * would need to be set for the contextual language 
 * to be correct.
 */
export const useLang:
    (lang: string) => { lang: string } | { }
=
    lang => {
        const ctxLang = React.useContext(model.lang.lang);

        if (lang == ctxLang) return {}
        return { lang }
    }
;


export const useLocaleLang:
    () => { lang: string } | {}
=
    () => {
        const [ bestLocale ] = React.useContext(model.lang.locale);

        return useLang(bestLocale);
    }
;

export const WithLang:
    (props: WithLangProps) => React.ReactElement
=
    ({ children, lang }) => React.cloneElement(
        children,
        { ...children.props, ...useLang(lang) }
    );
; 
