import { describe, expect, it } from '@jest/globals';

import {
	resolveText,
	selectText,
	Text,
	TextSelection,
	text,
} from './index.js';

describe('selectText', () => {
	const cv = Text('en-GB', 'CV' as const);
	const resume = Text('en-US', 'resume' as const);
	const label = selectText(cv, resume);

	it('selects exact locale matches', () => {
		expect(text(resolveText(label, ['en-US']))).toBe('resume');
		expect(text(resolveText(label, ['en-GB']))).toBe('CV');
	});

	it('falls back to the default text', () => {
		expect(text(resolveText(label, ['fr-FR']))).toBe('CV');
		expect(text(resolveText(label))).toBe('CV');
	});

	it('resolves serializable text selections', () => {
		const selection = TextSelection(cv, resume);

		expect(text(resolveText(selection, ['en-US']))).toBe('resume');
		expect(text(resolveText(selection, ['en-AU']))).toBe('CV');
	});
});
