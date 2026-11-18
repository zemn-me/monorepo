interface PeriodBounds {
	readonly start: string;
	readonly end: string;
}

export function childPeriodsFor<T extends PeriodBounds>(
	periods: readonly T[],
	parent: PeriodBounds
): T[] {
	const start = Date.parse(parent.start);
	const end = Date.parse(parent.end);
	// Calendar weeks can belong to two months. Match overlapping half-open ranges.
	return periods.filter(
		child => Date.parse(child.start) < end && Date.parse(child.end) > start
	);
}

export function journalBrowseQuery(pathname: string, at: string | null) {
	const route = pathname.split('/').filter(Boolean).at(-1);
	const view =
		route === 'year' ||
		route === 'month' ||
		route === 'week' ||
		route === 'day'
			? route
			: 'overview';
	return {
		view,
		...(at && Number.isFinite(Date.parse(at)) ? { at } : {}),
	} as const;
}
