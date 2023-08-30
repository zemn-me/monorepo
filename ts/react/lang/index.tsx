import React from 'react';

type Language = string;

export class TextType<L extends Language = Language, Text = string> {
	constructor(
		public readonly language: L,
		public readonly text: Text
	) {}
}

export type Text<L extends Language = Language, Text = string> = TextType<
	L,
	Text
>;

export function Text<L extends Language = Language, Text = string>(
	language: L,
	text: Text
): TextType<L, Text> {
	return new TextType(language, text);
}

/**
 * assign a language tag to a given text
 */
export const tag: (
	lang: Language
) => (text: TemplateStringsArray, ...text2: { toString(): string }[]) => Text =
	lang =>
	(text, ...text2) => {
		const o: string[] = [];
		for (let i = 0; i < Math.max(text.length, text2.length); i++)
			o.push(text[i] ?? '', (text2[i] ?? '').toString());
		return Text(lang, o.join(''));
	};

export const get = <L extends Language>(v: Text<L>): L => v.language;

export const text = <T extends any>(v: Text<string, T>): T => v.text;

/**
 * The user's set locale (the user's language preference)
 */
export const locale = React.createContext<readonly Language[]>(['en-GB']);

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
	readonly children?: React.ReactNode;
}> = ({ children }) => {
	const languages = useLocale();
	return <locale.Provider value={languages}>{children}</locale.Provider>;
};

/**
 * The contextual lang (the content's language)
 */
export const lang = React.createContext<Language>('en-GB');
