'use client';

import type { ReactNode } from 'react';

import { resolveText, Text, TextSelectionType, TextType } from './index.js';
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
	const content = selected instanceof TextType ? selected.text : selected;

	return <span lang={selected.language}>{content}</span>;
}

export function LocalizedPlainText<
	Default extends Text<string, ReactNode>,
	const Choices extends readonly Text<string, ReactNode>[],
>(props: LocalizedTextProps<Default, Choices>) {
	const languages = useLocale();
	const selected = resolveText(props.children, languages);
	const content = selected instanceof TextType ? selected.text : selected;

	return <>{content}</>;
}

export function LocalizedBlock<
	Default extends Text<string, ReactNode>,
	const Choices extends readonly Text<string, ReactNode>[],
>(props: LocalizedTextProps<Default, Choices>) {
	const languages = useLocale();
	const selected = resolveText(props.children, languages);
	const content = selected instanceof TextType ? selected.text : selected;

	return <div lang={selected.language}>{content}</div>;
}
