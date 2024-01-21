import memoizee from 'memoizee';

type Language = string;

export class TextType<L extends Language = Language, Text = string> {
	constructor(
		public readonly language: L,
		public readonly text: Text
	) {}
	private localeGetter = memoizee(() => new Intl.Locale(this.language));
	get locale(): Intl.Locale {
		return this.localeGetter();
	}
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

// https://github.com/typescript-eslint/typescript-eslint/issues/4062
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint, @typescript-eslint/no-explicit-any
export const text = <T extends unknown>(v: Text<string, T>): T => v.text;

export { useLocale } from '#//ts/react/lang/useLocale';
