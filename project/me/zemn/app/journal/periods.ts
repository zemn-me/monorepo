export function childPeriodsFor<T>(
	periods: readonly T[],
	parent: T,
	startOf: (period: T) => string,
	endOf: (period: T) => string
): T[] {
	const start = Date.parse(startOf(parent));
	const end = Date.parse(endOf(parent));
	// Calendar weeks can belong to two months. Match overlapping half-open ranges.
	return periods.filter(
		child =>
			Date.parse(startOf(child)) < end && Date.parse(endOf(child)) > start
	);
}
