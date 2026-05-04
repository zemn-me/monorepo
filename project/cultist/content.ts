import type {
	Culture,
	Deck,
	Element,
	Legacy,
	Recipe,
	Setting,
	Verb,
} from '#root/project/cultist/types.js';

export interface CoreContent {
	readonly cultures: readonly Culture[];
	readonly decks: readonly Deck[];
	readonly elements: readonly Element[];
	readonly endings: readonly unknown[];
	readonly legacies: readonly Legacy[];
	readonly recipes: readonly Recipe[];
	readonly settings: readonly Setting[];
	readonly verbs: readonly Verb[];
}

type ContentKey = keyof CoreContent | 'legcies';

const emptyCoreContent: CoreContent = {
	cultures: [],
	decks: [],
	elements: [],
	endings: [],
	legacies: [],
	recipes: [],
	settings: [],
	verbs: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function append<T>(
	values: readonly T[],
	more: unknown,
	key: string
): readonly T[] {
	if (more === undefined) return values;
	if (!(more instanceof Array)) {
		throw new Error(`Expected ${key} to be an array.`);
	}
	return [...values, ...(more as T[])];
}

export function parseFucineSource(source: string): unknown {
	const withoutBom = source.replace(/^\uFEFF/, '');
	let escaped = '';
	let inString = false;
	let afterBackslash = false;

	// The upstream content is JavaScript-object-ish: mostly JSON, but with a
	// handful of unquoted keys, trailing commas, and raw newlines in strings.
	for (let index = 0; index < withoutBom.length; index++) {
		const character = withoutBom[index];

		if (inString && (character === '\n' || character === '\r')) {
			escaped += '\\n';
			if (character === '\r' && withoutBom[index + 1] === '\n') index++;
			afterBackslash = false;
			continue;
		}

		escaped += character;

		if (afterBackslash) {
			afterBackslash = false;
		} else if (character === '\\') {
			afterBackslash = true;
		} else if (character === '"') {
			inString = !inString;
		}
	}

	// eslint-disable-next-line no-new-func
	return Function(`"use strict"; return (${escaped}\n);`)() as unknown;
}

export function mergeCoreDocuments(
	documents: Iterable<unknown>
): CoreContent {
	let content = emptyCoreContent;

	for (const document of documents) {
		if (!isRecord(document)) {
			throw new Error('Expected each content document to be an object.');
		}

		for (const [key, value] of Object.entries(document) as [
			ContentKey,
			unknown,
		][]) {
			switch (key) {
				case 'cultures':
					content = {
						...content,
						cultures: append<Culture>(content.cultures, value, key),
					};
					break;
				case 'decks':
					content = {
						...content,
						decks: append<Deck>(content.decks, value, key),
					};
					break;
				case 'elements':
					content = {
						...content,
						elements: append<Element>(content.elements, value, key),
					};
					break;
				case 'endings':
					content = {
						...content,
						endings: append<unknown>(content.endings, value, key),
					};
					break;
				case 'legacies':
				case 'legcies':
					content = {
						...content,
						legacies: append<Legacy>(content.legacies, value, key),
					};
					break;
				case 'recipes':
					content = {
						...content,
						recipes: append<Recipe>(content.recipes, value, key),
					};
					break;
				case 'settings':
					content = {
						...content,
						settings: append<Setting>(content.settings, value, key),
					};
					break;
				case 'verbs':
					content = {
						...content,
						verbs: append<Verb>(content.verbs, value, key),
					};
					break;
				default:
					break;
			}
		}
	}

	return content;
}
