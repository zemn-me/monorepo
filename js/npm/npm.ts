export class PackageName<S extends string = string> extends String {
    static regex = /^(?:@\w+\/)?\w+$/;
    constructor(public readonly name: S) {
        if (!PackageName.regex.test(name)) throw new Error(`${name} is not a valid NPM package name`);
        super(name)
    }
    static parse<S extends string>(name: S): PackageName<S> { return new PackageName(name) }
}
