import memoizee from 'memoizee';

export type Language = string;

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

export interface TextRecord<L extends Language = Language, Text = string> {
	readonly language: L;
	readonly text: Text;
}

export type Text<L extends Language = Language, Text = string> =
	| TextType<L, Text>
	| TextRecord<L, Text>;

export function Text<L extends Language = Language, Text = string>(
	language: L,
	text: Text
): TextType<L, Text> {
	return new TextType(language, text);
}

export type TextSelector<T extends Text<string, unknown> = Text> = (
	languages: readonly string[]
) => T;

export interface TextSelectionType<
	Default extends Text<string, unknown> = Text,
	Choices extends readonly Text<string, unknown>[] = readonly Text[],
> {
	readonly choices: Choices;
	readonly defaultText: Default;
}

export type TextSelection<
	Default extends Text<string, unknown> = Text,
	Choices extends readonly Text<string, unknown>[] = readonly Text[],
> = TextSelectionType<Default, Choices>;

export function TextSelection<
	Default extends Text<string, unknown>,
	const Choices extends readonly Text<string, unknown>[],
>(
	defaultText: Default,
	...choices: Choices
): TextSelectionType<Default, Choices> {
	return {
		choices: choices.map(toTextRecord) as unknown as Choices,
		defaultText: toTextRecord(defaultText) as Default,
	};
}

function isTextRecord(value: unknown): value is Text {
	return (
		typeof value === 'object' &&
		value !== null &&
		'language' in value &&
		'text' in value
	);
}

function toTextRecord<L extends Language, T>(value: Text<L, T>): TextRecord<L, T> {
	return { language: value.language, text: value.text };
}

function canonicalLanguage(language: Language): string | undefined {
	try {
		return new Intl.Locale(language).toString();
	} catch {
		return undefined;
	}
}

function localeLanguage(language: Language): string | undefined {
	try {
		return new Intl.Locale(language).language;
	} catch {
		return undefined;
	}
}

function resolveTextSelection<
	Default extends Text<string, unknown>,
	const Choices extends readonly Text<string, unknown>[],
>(
	selection: TextSelectionType<Default, Choices>,
	languages: readonly string[]
): Default | Choices[number] {
	const texts = [selection.defaultText, ...selection.choices] as const;
	const textsByLanguage = new Map(
		texts.flatMap(text => {
			const language = canonicalLanguage(text.language);
			return language === undefined ? [] : [[language, text] as const];
		})
	);

	for (const language of languages) {
		const text = textsByLanguage.get(canonicalLanguage(language) ?? '');
		if (text !== undefined) return text;
	}

	for (const language of languages) {
		const requestedLanguage = localeLanguage(language);
		if (requestedLanguage === undefined) continue;
		const text = texts.find(
			text => localeLanguage(text.language) === requestedLanguage
		);
		if (text !== undefined) return text;
	}

	return selection.defaultText;
}

export function selectText<
	Default extends Text<string, unknown>,
	const Choices extends readonly Text<string, unknown>[],
>(
	defaultText: Default,
	...choices: Choices
): TextSelector<Default | Choices[number]> {
	const selection = TextSelection(defaultText, ...choices);

	return languages => resolveTextSelection(selection, languages);
}

export function resolveText<T extends Text<string, unknown>>(
	text: T | TextSelector<T>,
	languages?: readonly string[]
): T;
export function resolveText<
	Default extends Text<string, unknown>,
	const Choices extends readonly Text<string, unknown>[],
>(
	text: TextSelectionType<Default, Choices>,
	languages?: readonly string[]
): Default | Choices[number];
export function resolveText(
	text: Text | TextSelector | TextSelectionType,
	languages?: readonly string[]
): Text;
export function resolveText(
	text: Text | TextSelector | TextSelectionType,
	languages: readonly string[] = []
): Text {
	if (text instanceof TextType || isTextRecord(text)) return text;
	if (typeof text === 'function') return text(languages);
	return resolveTextSelection(text, languages);
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

// biome-ignore lint/complexity/noUselessTypeConstraint: this keeps generic inference stable
export const text = <T extends unknown>(v: Text<string, T>): T => v.text;

export { useLocale } from '#root/ts/react/lang/useLocale.js';
