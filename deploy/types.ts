
export interface Context {
	publish(filename: string, content: Buffer): Promise<void>;
	exec(filename: string): Promise<void>;
}

export interface ArtifactInfo {
	kind: 'artifact';
	filename: string;
	buildTag: string;
	publish: (c: Context) => Promise<void>;
}

export interface NpmPackageInfo {
	kind: 'npm_publication';
	package_name: string;
	buildTag: string;
	publish: (c: Context) => Promise<void>;
}

export type Operation = ArtifactInfo | NpmPackageInfo;

export class OperationFailure<O extends Operation = Operation> extends Error {
	constructor(public readonly operation: O, public readonly error: Error) {
		super(
			`${operation.kind} ${operation.buildTag}: ${error.message}`,
			error.cause
		);
	}
}

export type OperationOrFailure<O extends Operation = Operation> =
	| O
	| OperationFailure<O>;

export interface ReleaseProps {
	dryRun: boolean;
	releaseNotes: (items: OperationOrFailure[]) => string;
	createRelease(data: { body: string }): Promise<{ release_id: number }>;
	uploadReleaseAsset(data: {
		release_id: number;
		name: string;
		data: Buffer;
	}): Promise<void>;
}