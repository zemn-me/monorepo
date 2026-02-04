import { ContentSecurityPolicy, Directive, DirectiveName } from "#root/project/zemn.me/app/experiments/csp/ast.js";
import { SerializedPolicy } from "#root/project/zemn.me/app/experiments/csp/parse.js";
import { isDefined } from "#root/ts/guard.js";
import { filter, map } from "#root/ts/iter/index.js";

/**
 * CSP is a higher-order abstraction over {@link ContentSecurityPolicy}.
 *
 * It provides memoization for several operations over the AST.
 */
export class CSP {
	static parse(csp: string) {
		const resp = SerializedPolicy.safeParse(csp)
		if (resp.error) return resp.error;

		return new CSP(resp.data);
	}

	validate(): Error[] {
		return [
			this.validateDuplicateDirectives()
		].filter(isDefined)
	}

	private validateDuplicateDirectives(): Error | undefined {
		const fail = this.namedDirectives.size != this.contentSecurityPolicy.length;

		if (!fail) return undefined;

		const directivesByName = map(this.namedDirectives, name =>
			[ name, this.contentSecurityPolicy.filter(v => v.name == name)] as const
		)

		return new Error(
			`Duplicate directives will be ignored. ` +
			[...map(filter(directivesByName, ([, directives]) => directives.length > 0),
				([name, directives]) => `${name} appears ${directives.length} times; some values will be ignored.`
			)].join(" ")
		)
	}

	private _namedDirectives: Set<DirectiveName> | undefined;
	get namedDirectives(): Set<DirectiveName> {
		if (this._namedDirectives !== undefined) return this._namedDirectives;
		return this._namedDirectives = new Set(this.contentSecurityPolicy.map(v => v.name));
	}

	private _directiveMap: Map<DirectiveName, Directive> | undefined;
	private get directiveMap(): Map<DirectiveName, Directive> {
		if (this._directiveMap !== undefined) return this._directiveMap;
		return this._directiveMap = new Map(
			this.contentSecurityPolicy.map(v => [v.name, v])
		)
	}

	getDirective(directiveName: DirectiveName) {
		return this.directiveMap.get(directiveName);
	}

	constructor(public contentSecurityPolicy: ContentSecurityPolicy) {

	}


}
