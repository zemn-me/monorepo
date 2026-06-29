import { expect, test } from '@jest/globals';

import { Bio } from '#root/project/me/zemn/bio/bio.js';
import * as lang from '#root/ts/react/lang/index.js';

interface LocalizedField {
	readonly path: string;
	readonly value: lang.Text | lang.TextSelection;
}

const requiredLanguages = ['en', 'zh-Hans', 'zh-Hant'] as const;

function isTextSelection(value: unknown): value is lang.TextSelection {
	return (
		typeof value === 'object' &&
		value !== null &&
		'defaultText' in value &&
		'choices' in value
	);
}

function localeFor(language: string): Intl.Locale | undefined {
	try {
		return new Intl.Locale(language).maximize();
	} catch {
		return undefined;
	}
}

function hasRequiredLanguage(
	texts: readonly lang.Text[],
	required: (typeof requiredLanguages)[number]
): boolean {
	return texts.some(text => {
		const locale = localeFor(text.language);
		if (locale === undefined) return false;

		if (required === 'en') return locale.language === 'en';

		return locale.language === 'zh' && locale.script === required.slice(3);
	});
}

function missingLanguages(value: lang.Text | lang.TextSelection): readonly string[] {
	if (!isTextSelection(value)) return [...requiredLanguages];

	const texts = [value.defaultText, ...value.choices];

	return requiredLanguages.filter(
		required => !hasRequiredLanguage(texts, required)
	);
}

function timelineFields(): readonly LocalizedField[] {
	return Bio.timeline.flatMap((event, idx) => {
		const fields: LocalizedField[] = [
			{
				path: `timeline[${idx}].title (${event.id})`,
				value: event.title,
			},
		];

		if (event.description !== undefined)
			fields.push({
				path: `timeline[${idx}].description (${event.id})`,
				value: event.description,
			});

		if (event.publisher !== undefined)
			fields.push({
				path: `timeline[${idx}].publisher (${event.id})`,
				value: event.publisher,
			});

		if (event.employer !== undefined)
			fields.push({
				path: `timeline[${idx}].employer (${event.id})`,
				value: event.employer,
			});

		for (const [tagIdx, tag] of event.tags?.entries() ?? [])
			fields.push({
				path: `timeline[${idx}].tags[${tagIdx}] (${event.id})`,
				value: tag,
			});

		return fields;
	});
}

function localizedFields(): readonly LocalizedField[] {
	return [
		...Bio.links.map(
			([caption], idx): LocalizedField => ({
				path: `links[${idx}]`,
				value: caption,
			})
		),
		...Bio.skills.map(
			(skill, idx): LocalizedField => ({
				path: `skills[${idx}]`,
				value: skill,
			})
		),
		...timelineFields(),
	];
}

test('bio display text has English, Simplified Chinese, and Traditional Chinese variants', () => {
	const failures = localizedFields().flatMap(({ path, value }) => {
		const missing = missingLanguages(value);
		if (missing.length === 0) return [];

		return [`${path} is missing ${missing.join(', ')}`];
	});

	expect(failures).toEqual([]);
});
