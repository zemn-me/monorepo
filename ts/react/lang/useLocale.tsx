'use client';

import { useEffect, useState } from 'react';

const getLangs = () => {
	if (typeof navigator !== 'undefined') return navigator.languages; // ?? [navigator.language]?;

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
