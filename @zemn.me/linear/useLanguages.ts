import React from 'react';
import Promisable from './Promisable';
import usePromisable from './usePromisable';

export interface Props {
    Intl?: {
        getCanonicalLocales?:
        Promisable<typeof import('@formatjs/intl-getcanonicallocales')["getCanonicalLocales"]>
    },
    /**
     * Use a specific language, instead of the browser-specified one.
     */
    languageOverride?: readonly string[]
}

export interface Context extends Props { }

export const Context = React.createContext<Context | undefined>(undefined);

/**
 * Returns a list of language codes in descending order of preference.
 * The list will update if it is updated by the user's browser.
 * 
 * The user can override the language used with Context or Props.
 * If not overridden, it defaults to those specified in the user's browser.
 */
export const useLanguages:
    (props: Props) => [readonly string[]]
    =
    (props) => {
        const languagesContext = React.useContext(Context);

        const {
            Intl: {
                getCanonicalLocales: prom_getCanonicalLocales =
                (async () => (await import('@formatjs/intl-getcanonicallocales')).getCanonicalLocales)()
            } = {}
        } = { ...languagesContext ?? {}, ...props };

        const getCanonicalLocales = usePromisable(prom_getCanonicalLocales);


        const [languages, setLanguages] = React.useState<readonly string[]>();

        const onLanguageChange = React.useCallback(
            () => getCanonicalLocales ? setLanguages(getCanonicalLocales([...
                languagesContext?.languageOverride ?? navigator.languages])) : void 0,
            [navigator.languages, setLanguages, getCanonicalLocales, languagesContext]
        );

        React.useEffect(() => {
            window.addEventListener('languagechange', onLanguageChange);

            return () => window.removeEventListener('languageChange', onLanguageChange);
        }, [onLanguageChange]);

        return [languages]
    }
    ;