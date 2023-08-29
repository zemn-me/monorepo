export class TypeOfError<T> extends Error {
	public value: unknown;
	public type: T;
	public valueName: string | undefined;
	constructor(v: unknown, type: T, valueName?: string) {
		super();
		this.value = v;
		this.type = type;
		this.valueName = valueName;
	}

	override get message(): string {
		const { value: actual, type, valueName = 'value' } = this;
		return `${valueName} is not ${type}; instead ${actual}`;
	}

	override get name(): string {
		return 'TypeOfError';
	}
}

export class GuardFailedError<
	I,
	O extends I,
	Etc extends unknown[],
> extends Error {
	public guard: (v: I, ...a: Etc) => v is O;
	public value: I;
	constructor(guard: (v: I, ...a: Etc) => v is O, v: I) {
		super();
		this.guard = guard;
		this.value = v;
	}

	override get message(): string {
		return `must(${this.guard.name ?? this.guard}, ${this.value})`;
	}

	override get name(): string {
		return 'GuardFailedError';
	}
}
