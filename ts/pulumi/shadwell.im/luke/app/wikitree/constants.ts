import type { HighlightFilterId, RelationDefinition } from '#root/ts/pulumi/shadwell.im/luke/app/wikitree/types.js';

export const RELATIONS: readonly RelationDefinition[] = [
	{ prop: 'P22', name: 'father', color: '#3923d6' },
	{ prop: 'P25', name: 'mother', color: '#ff4848' },
	{ prop: 'P40', name: 'child', color: '#7a7a7a' },
];

export const NODE_LIMIT_OPTIONS = [
	30,
	100,
	150,
	200,
	250,
	500,
	750,
	1000,
	1250,
	1500,
	1750,
	2000,
	2250,
	2500,
	2750,
	3000,
	3500,
	4000,
	4500,
	5000,
	7500,
	10000,
] as const;

export const DEFAULT_MAX_NODES = NODE_LIMIT_OPTIONS[0];
export const DEFAULT_QID = 'Q42';
export const LEGACY_WIKIDATA_CACHE_KEY = 'luke-shadwell-im:wikitree:wikidata:v2';
export const WIKIDATA_CACHE_KEY_PREFIX = 'luke-shadwell-im:wikitree:wikidata:v3:';
export const WIKIDATA_CACHE_SCHEMA_VERSION = 2;
export const WIKIDATA_CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000;
export const ABSOLUTE_MIN_SCALE = 0.01;
export const MAX_SCALE = 3.2;
export const ZOOM_OUT_BREADTH_FACTOR = 1.2;
export const DETAIL_LABEL_SCALE_THRESHOLD = 0.5;
export const CLUSTER_LABEL_RADIUS_PX = 118;
export const CLUSTER_LABEL_MIN_NODES = 4;
export const CLUSTER_LABEL_MIN_SHARE = 0.6;
export const CLUSTER_LABEL_VIEWPORT_MARGIN = 84;
export const BASE_NODE_RADIUS = 14;
export const MILITARY_RANK_PROPERTY = 'P410';
export const MILITARY_BRANCH_PROPERTIES = ['P241', 'P463'] as const;
export const FALLBACK_RANK_ICON = '🪖';
export const IMAGE_PROPERTY = 'P18';
export const DATE_OF_BIRTH_PROPERTY = 'P569';
export const DATE_OF_DEATH_PROPERTY = 'P570';
export const OCCUPATION_PROPERTY = 'P106';
export const NOBLE_TITLE_PROPERTY = 'P97';
export const HONORIFIC_PREFIX_PROPERTY = 'P511';
export const PARTICIPATED_IN_CONFLICT_PROPERTY = 'P607';
export const SUBCLASS_OF_PROPERTY = 'P279';
export const WIKIDATA_REQUEST_INTERVAL_MS = 120;
export const WIKIDATA_MAX_RETRIES = 5;
export const WIKIDATA_BATCH_SIZE = 20;

export const CACHEABLE_CLAIM_PROPERTIES = [
	'P22',
	'P25',
	'P40',
	MILITARY_RANK_PROPERTY,
	...MILITARY_BRANCH_PROPERTIES,
	IMAGE_PROPERTY,
	DATE_OF_BIRTH_PROPERTY,
	DATE_OF_DEATH_PROPERTY,
	OCCUPATION_PROPERTY,
	NOBLE_TITLE_PROPERTY,
	HONORIFIC_PREFIX_PROPERTY,
	PARTICIPATED_IN_CONFLICT_PROPERTY,
	SUBCLASS_OF_PROPERTY,
] as const;

export const HIGHLIGHT_FILTERS: readonly {
	readonly id: HighlightFilterId;
	readonly label: string;
	readonly description: string;
}[] = [
	{ id: 'none', label: 'All people', description: 'Show the full graph without extra highlighting.' },
	{ id: 'anglicanPriest', label: 'Anglican priest', description: 'Highlight people with occupation Anglican priest.' },
	{ id: 'anyNobleTitle', label: 'Any noble title', description: 'Highlight people who have any noble title value or any honorific prefix.' },
	{ id: 'living', label: 'Living', description: 'Highlight people with a date of birth, no date of death, and birth less than 100 years ago.' },
	{ id: 'politician', label: 'Politician', description: 'Highlight people with occupation politician.' },
	{ id: 'monarchNobleTitle', label: 'Monarchy', description: 'Highlight people with a monarch noble title or the honorific prefix Royal Highness.' },
	{ id: 'military', label: 'Military', description: 'Highlight people with a military branch, participated in conflict, or military, police or special rank.' },
	{ id: 'rightHonourable', label: 'The Right Honourable', description: 'Highlight people with the honorific prefix The Right Honourable.' },
] as const;
