import { expect, it } from '@jest/globals';
import { resolveMetadata } from '#root/ts/remix/metadata.js';

it('inherits defaults while applying the parent title template to nested routes', () => {
	const result = resolveMetadata([
		{
			metadata: {
				title: { default: 'Site', template: '%s ← Site' },
				authors: [{ name: 'Thomas' }],
			},
		},
		{ metadata: { title: 'Journal', description: 'Private journal' } },
		{
			metadata: {
				title: 'Connect',
				robots: { index: false, follow: false },
			},
		},
	]);
	expect(result.title).toBe('Connect ← Site');
	expect(result.metadata.description).toBe('Private journal');
	expect(result.metadata.authors).toEqual([{ name: 'Thomas' }]);
	expect(result.metadata.robots).toEqual({ index: false, follow: false });
});

it('keeps the default title and viewport when the leaf has no metadata', () => {
	expect(
		resolveMetadata([
			{
				metadata: { title: { default: 'Site', template: '%s ← Site' } },
				viewport: { width: 'device-width' },
			},
			{},
		])
	).toMatchObject({ title: 'Site', viewport: { width: 'device-width' } });
});
