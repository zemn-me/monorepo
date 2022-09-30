export class Tag<P = unknown, C = unknown> implements JSX.ElementClass {
	constructor(readonly props: P, readonly children?: C) {}

	render: never = undefined as never;
	context: never = undefined as never;
	setState: never = undefined as never;
	forceUpdate: never = undefined as never;
	state: never = undefined as never;
	refs: never = undefined as never;
}

export class Artifact extends Tag<
	{ readonly name: string; readonly tag: string },
	never
> {
	toArtifact(): Artifact {
		return this;
	}
}

export class NpmPackage extends Tag<{
	readonly package_json: string;
	readonly uploadScript: string;
}> {
	run() {}
	dryRun() {}
}

export class Config extends Tag<{}, { run(): unknown }> {}

export function jsx(): 1 {
	return 1;
}
