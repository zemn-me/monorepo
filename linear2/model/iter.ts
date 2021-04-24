function* _filter<I, O extends I>(
	i: Iterable<I>,
	t: (v: I) => v is O,
): IterableIterator<O> {
	for (const val of i) {
		if (t(val)) yield val
	}
}

export const filter = _filter as {
	<I, O extends I>(i: Iterable<I>, t: (v: I) => v is O): IterableIterator<O>
	<I>(i: Iterable<I>, t: (v: I) => boolean): IterableIterator<I>
}
