import { createContext, useEffect, useState } from 'react';
import { Language } from 'ts/react/lang';

/**
 * The user's set locale (the user's language preference)
 */
export const locale = createContext<readonly Language[]>(['en-GB']);

const getLangs = () => {
	if (typeof navigator !== 'undefined')
		return navigator?.languages ?? [navigator?.language];

	return [];
};

export function useLocale() {
	const [languages, setLanguages] = useState<readonly string[]>(['en-GB']);

	useEffect(() => {
		const listener = () => {
			setLanguages(() => getLangs());
		};
		window.addEventListener('languagechange', listener);
		listener();
		return () => window.removeEventListener('languagechange', listener);
	}, [setLanguages]);

	return languages;
}

export const LocaleProvider: React.FC<{
	readonly children?: React.ReactNode;
}> = ({ children }) => {
	const languages = useLocale();
	return <locale.Provider value={languages}>{children}</locale.Provider>;
};

/**
 * The contextual lang (the content's language)
 */
export const lang = createContext<Language>('en-GB');
