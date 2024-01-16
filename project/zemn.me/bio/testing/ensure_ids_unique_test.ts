import { Bio } from 'project/zemn.me/bio/bio';

test('ids must be unique', () => {
	const ordered_ids = Bio.timeline.map(v => v.id);
	const unique_ids = new Set(ordered_ids);

	const sort = (a: string, b: string): number => {
		if (a === b) return 0;
		if (a < b) return -1;

		return 1;
	};

	expect(ordered_ids.sort(sort)).toEqual([...unique_ids].sort(sort));
});
