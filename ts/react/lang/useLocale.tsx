'use client';

import { useEffect, useState } from 'react';

const getLangs = () => {
	if (typeof navigator !== 'undefined') return navigator.languages; // ?? [navigator.language]?;

	return [];
};

export function useLocale() {
	const [languages, setLanguages] = useState<readonly [string, ...string[]]>(['en-GB']);

	useEffect(() => {
		const listener = () => {
			const languages = getLangs();
			if (languages.length > 0) setLanguages(languages as [string, ...string[]]);
		};
		window.addEventListener('languagechange', listener);
		listener();
		return () => window.removeEventListener('languagechange', listener);
	}, [setLanguages]);

	return languages;
}
