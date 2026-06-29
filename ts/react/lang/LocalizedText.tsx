'use client';

import type { ReactNode } from 'react';

import { resolveText, Text, TextSelectionType, text } from './index.js';
import { useLocale } from './useLocale.js';

export interface LocalizedTextProps<
	Default extends Text<string, ReactNode>,
	Choices extends readonly Text<string, ReactNode>[],
> {
	readonly children: TextSelectionType<Default, Choices>;
}

export function LocalizedText<
	Default extends Text<string, ReactNode>,
	const Choices extends readonly Text<string, ReactNode>[],
>(props: LocalizedTextProps<Default, Choices>) {
	const languages = useLocale();
	const selected = resolveText(props.children, languages);

	return <span lang={selected.language}>{text(selected)}</span>;
}

export function LocalizedPlainText<
	Default extends Text<string, ReactNode>,
	const Choices extends readonly Text<string, ReactNode>[],
>(props: LocalizedTextProps<Default, Choices>) {
	const languages = useLocale();
	const selected = resolveText(props.children, languages);

	return <>{text(selected)}</>;
}

export function LocalizedBlock<
	Default extends Text<string, ReactNode>,
	const Choices extends readonly Text<string, ReactNode>[],
>(props: LocalizedTextProps<Default, Choices>) {
	const languages = useLocale();
	const selected = resolveText(props.children, languages);

	return <div lang={selected.language}>{text(selected)}</div>;
}

export function LocalizedParagraph<
	Default extends Text<string, ReactNode>,
	const Choices extends readonly Text<string, ReactNode>[],
>(props: LocalizedTextProps<Default, Choices>) {
	const languages = useLocale();
	const selected = resolveText(props.children, languages);

	return <p lang={selected.language}>{text(selected)}</p>;
}
