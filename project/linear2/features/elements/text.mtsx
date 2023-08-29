import * as model from 'linear2/model';
import React from 'react';

interface WithLangProps {
	children: React.ReactElement<{ lang?: string }>;
	lang?: string;
}

/**
 * Returns a lang parameter if the lang parameter
 * would need to be set for the contextual language
 * to be correct.
 */
export const useLang: (
	lang: string
) => { lang: string } | Record<string, never> = lang => {
	const ctxLang = React.useContext(model.lang.lang);

	if (lang == ctxLang) return {};
	return { lang };
};

export const useLocaleLang: () => { lang: string } | {} = () => {
	const [bestLocale] = React.useContext(model.lang.locale);

	return useLang(bestLocale);
};

export const WithLang: (props: WithLangProps) => React.ReactElement = ({
	children,
	lang,
}) => {
	if (!lang) return children;

	return React.cloneElement(children, {
		...children.props,
		...useLang(lang),
	});
};

export const withTextContext = React.createContext<model.lang.Text | undefined>(
	undefined
);
export interface WithTextProps {
	text?: model.lang.Text;
	children: React.ReactElement<{ lang?: string }>;
}

export const WithText: (props: WithTextProps) => React.ReactElement = ({
	text,
	children,
}) => {
	if (!text) return children;

	const [lang] = text;

	return (
		<withTextContext.Provider value={text}>
			<WithLang lang={lang}>{children}</WithLang>
		</withTextContext.Provider>
	);
};

export interface TextProps {}
export const Text: (props: TextProps) => React.ReactElement | null = () => {
	const text = React.useContext(withTextContext);
	if (!text) return null;

	const [, el] = text;
	return <>{el}</>;
};
