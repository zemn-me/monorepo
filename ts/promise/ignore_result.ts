/**
 * Background the execution of a promise-returning function.
 */
export function background(f: () => Promise<unknown>): () => void {
	return () => void f();
}
