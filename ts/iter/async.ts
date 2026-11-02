export async function* map<I, O>(
	i: AsyncIterable<I>,
	f: (i: I) => O
): AsyncIterable<O> {
	for await (const it of i) yield f(it);
}
