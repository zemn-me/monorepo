// trying to take a serde approach to make serializing and deserializing easier.

interface Serialize<I, O> {
	(v: I): O
}

interface Deserialize<I, O> {
	(v: O): I
}

interface Serde<Self, T> {
	serialize(this: Self): T
	deserialize(v: T): Self
}

class SerdeString implements Serde<SerdeString, string> {
	constructor(public readonly value?: string | undefined) { }
	serialize(this: SerdeString): string {
		return this.value ?? ""
	}

	deserialize(v: string): SerdeString {
		return new SerdeString(v)
	}
}

