

/**
 * A kind of non-class construct just used to add
 * methods to an existing type.
 */
export class NewType<T> {
	constructor(readonly value: T) { }
}
