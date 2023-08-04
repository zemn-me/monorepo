import React from 'react';

export type Lang = string;

/**
 * TaggedText represents a TR35 tagged textual string.
 * @see https://unicode.org/reports/tr35/#BCP_47_Conformance
 */
export type TaggedText = readonly [Lang, React.ReactChild];

/**
 * Segment represents a selection of multiple TaggedText pieces,
 * each of which describes a possible choice of language string.
 */
export type Text = TaggedText;

/**
 * assign a language tag to a given text
 */
export const tag: (
	lang: Lang
) => (
	text: TemplateStringsArray,
	...text2: { toString(): string }[]
) => TaggedText =
	lang =>
	(text, ...text2) => {
		const o: string[] = [];
		for (let i = 0; i < Math.max(text.length, text2.length); i++)
			o.push(text[i] ?? '', (text2[i] ?? '').toString());
		return [lang, o.join('')] as const;
	};

/**
 * check if a Text is a TaggedText
 */
export const textIsTaggedText = (text: Text): text is TaggedText =>
	typeof text[0] == 'string';

export const get: (t: Text) => Lang = ([lang]) => lang;

export const text: (t: Text) => React.ReactChild = ([, /* lang */ text]) =>
	text;

/**
 * The user's set locale (the user's language preference)
 */
export const locale = React.createContext<readonly Lang[]>(['en-GB']);

const getLangs = () => {
	if (typeof navigator !== 'undefined')
		return navigator?.languages ?? [navigator?.language];

	return [];
};

export function useLocale() {
	const [languages, setLanguages] = React.useState<readonly string[]>([
		'en-GB',
	]);

	React.useEffect(() => {
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
	children?: React.ReactNode;
}> = ({ children }) => {
	const languages = useLocale();
	return <locale.Provider value={languages}>{children}</locale.Provider>;
};

/**
 * The contextual lang (the content's language)
 */
export const lang = React.createContext<Lang>('en-GB');
