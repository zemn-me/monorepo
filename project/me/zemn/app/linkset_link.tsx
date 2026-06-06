'use client';

import Link from '#root/project/me/zemn/components/Link/index.js';
import * as lang from '#root/ts/react/lang/index.js';

export interface LinksetText {
	readonly language: string;
	readonly text: string;
}

interface LinksetTextSelector {
	readonly choices: readonly LinksetText[];
	readonly defaultText: LinksetText;
}

export type LinksetLabel = LinksetText | LinksetTextSelector;

export interface LinksetLinkProps {
	readonly href: string;
	readonly label: LinksetLabel;
	readonly rel?: string;
}

function toText(text: LinksetText): lang.Text {
	return lang.Text(text.language, text.text);
}

function selectLabel(
	label: LinksetLabel,
	languages: readonly string[]
): lang.Text {
	if (!('defaultText' in label)) return toText(label);

	return lang.resolveText(
		lang.selectText(toText(label.defaultText), ...label.choices.map(toText)),
		languages
	);
}

export function LinksetLink({ href, label, rel }: LinksetLinkProps) {
	const selectedLabel = selectLabel(label, lang.useLocale());

	return (
		<Link href={href} lang={lang.get(selectedLabel)} rel={rel}>
			{lang.text(selectedLabel)}
		</Link>
	);
}
