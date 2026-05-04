export type RelationName = 'father' | 'mother' | 'child';

export interface RelationDefinition {
	readonly prop: 'P22' | 'P25' | 'P40';
	readonly name: RelationName;
	readonly color: string;
}

export type RankIcon =
	| { type: 'emoji'; value: string }
	| { type: 'image'; src: string };

export type HighlightFilterId =
	| 'none'
	| 'anglicanPriest'
	| 'anyNobleTitle'
	| 'living'
	| 'politician'
	| 'monarchNobleTitle'
	| 'military'
	| 'rightHonourable';

export interface HighlightFlags {
	readonly anglicanPriest: boolean;
	readonly anyNobleTitle: boolean;
	readonly living: boolean;
	readonly politician: boolean;
	readonly military: boolean;
	readonly monarchNobleTitle: boolean;
	readonly rightHonourable: boolean;
}

export interface EntityNode {
	readonly id: string;
	readonly label: string;
	readonly rankIcon?: RankIcon;
	readonly rankLabel?: string;
	readonly branchLabel?: string;
	readonly imageUrl?: string;
	readonly highlightFlags: HighlightFlags;
	readonly url: string;
}

export interface EntityEdge {
	readonly from: string;
	readonly to: string;
	readonly relation: RelationName;
	readonly color: string;
}

export interface GraphData {
	readonly edges: readonly EntityEdge[];
	readonly excessiveNodes: boolean;
	readonly nodes: Readonly<Record<string, EntityNode>>;
	readonly rootId: string;
}

export interface LoadingState {
	readonly loaded: number;
	readonly loading: boolean;
	readonly queued: number;
	readonly rateLimited: boolean;
	readonly retryAt: number | null;
}

export interface SimNode {
	id: string;
	label: string;
	rankIcon?: RankIcon;
	rankLabel?: string;
	branchLabel?: string;
	imageUrl?: string;
	highlightFlags: HighlightFlags;
	url: string;
	x: number;
	y: number;
	depth: number;
	fx: number | null;
	fy: number | null;
	radius: number;
}

export interface SimEdge {
	source: string | SimNode;
	target: string | SimNode;
	relation: RelationName;
	color: string;
}

export interface CachedEntityRecord {
	readonly expiresAt: number;
	readonly schemaVersion?: number;
	readonly value: unknown;
}

export type CachedEntityValue = {
	readonly claims?: Record<string, readonly unknown[]>;
	readonly id?: string;
	readonly labels?: {
		readonly en?: {
			readonly value?: string;
		};
	};
};

export interface ViewportTransform {
	x: number;
	y: number;
	scale: number;
}

export interface DragState {
	mode: 'pan' | 'node';
	node?: SimNode;
	panX: number;
	panY: number;
	pointerId: number;
	startX: number;
	startY: number;
	moved: boolean;
}
