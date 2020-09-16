export class TypeOfError<T> extends Error {
    public value: unknown
    public type: T
    public valueName: string | undefined
    constructor(v: unknown, type: T, valueName?: string) {
        super();
        this.value = v; this.type = type; this.valueName = valueName;
    }

    get message() {
        const { value: actual, type, valueName = "value" } = this;
        return `${valueName} is not ${type}; instead ${actual}`
    }

    get name() { return "TypeOfError" }
}

export class GuardFailedError<I, O extends I> extends Error {
    public guard: (v: I, ...a: unknown[]) => v is O
    public value : I
    constructor(guard: (v: I, ...a: any) => v is O, v: I) {
        super();
        this.guard = guard;
        this.value = v;
    }

    get message() {
        return `must(${this.guard.name??this.guard}, ${this.value})`
    }

    get name() { return "GuardFailedError" }
}

