import { quote } from './util';

export class Connection {
	constructor(
		public from: string,
		public connector: string,
		public to: string,
		public color?: string,
		public label?: string
	) {}

	nodeSettings(): Map<string, string> {
		const { color, label } = this;
		return new Map(
			Object.entries({
				...(color ? { color } : {}),
				...(label ? { label } : {}),
			})
		);
	}

	settingsAnnotation(): string {
		return `[${[...this.nodeSettings()]
			.map(([key, value]) => `${quote(key)}=${quote(value)}`)
			.join(',')}]`;
	}

	toDotDigraphStatement(): string {
		return `${quote(this.from)}${this.connector}${quote(
			this.to
		)}${this.settingsAnnotation()}`;
	}
}

interface DigraphStatement {
	toDotDigraphStatement(): string;
}

export abstract class AbstractDigraph {
	constructor(public statements: DigraphStatement[]) {}
}

export class Digraph extends AbstractDigraph {
	toDot() {
		return `digraph{${this.statements
			.map(smt => smt.toDotDigraphStatement())
			.join(';\n')}}`;
	}
}

export class Subgraph extends AbstractDigraph {
	constructor(
		public name: string,
		public override statements: DigraphStatement[]
	) {
		super(statements);
	}

	toDotDigraphStatement() {
		return `subgraph ${quote(this.name)}{${this.statements
			.map(smt => smt.toDotDigraphStatement())
			.join(';\n')})`;
	}
}
