'use client';

import * as d3 from 'd3-force';
import {
	FormEvent,
	PointerEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
	WheelEvent,
} from 'react';

import { RANK_IMAGE_RULES } from '#root/ts/pulumi/shadwell.im/luke/app/wikitree/rankIconReferences.js';
import { Link } from '#root/ts/react/next/Link/index.js';

type RelationName = 'father' | 'mother' | 'child';

interface RelationDefinition {
	readonly prop: 'P22' | 'P25' | 'P40';
	readonly name: RelationName;
	readonly color: string;
}

type RankIcon =
	| { type: 'emoji'; value: string }
	| { type: 'image'; src: string };

type HighlightFilterId =
	| 'none'
	| 'anglicanPriest'
	| 'anyNobleTitle'
	| 'living'
	| 'politician'
	| 'monarchNobleTitle'
	| 'military'
	| 'rightHonourable';

interface HighlightFlags {
	readonly anglicanPriest: boolean;
	readonly anyNobleTitle: boolean;
	readonly living: boolean;
	readonly politician: boolean;
	readonly military: boolean;
	readonly monarchNobleTitle: boolean;
	readonly rightHonourable: boolean;
}

interface EntityNode {
	readonly id: string;
	readonly label: string;
	readonly rankIcon?: RankIcon;
	readonly rankLabel?: string;
	readonly branchLabel?: string;
	readonly imageUrl?: string;
	readonly highlightFlags: HighlightFlags;
	readonly url: string;
}

interface EntityEdge {
	readonly from: string;
	readonly to: string;
	readonly relation: RelationName;
	readonly color: string;
}

interface GraphData {
	readonly edges: readonly EntityEdge[];
	readonly excessiveNodes: boolean;
	readonly nodes: Readonly<Record<string, EntityNode>>;
	readonly rootId: string;
}

interface LoadingState {
	readonly loaded: number;
	readonly loading: boolean;
	readonly queued: number;
	readonly rateLimited: boolean;
	readonly retryAt: number | null;
}

interface SimNode {
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

interface SimEdge {
	source: string | SimNode;
	target: string | SimNode;
	relation: RelationName;
	color: string;
}

interface CachedEntityRecord {
	readonly expiresAt: number;
	readonly schemaVersion?: number;
	readonly value: unknown;
}

type CachedEntityValue = {
	readonly claims?: Record<string, readonly unknown[]>;
	readonly id?: string;
	readonly labels?: {
		readonly en?: {
			readonly value?: string;
		};
	};
};

interface ViewportTransform {
	x: number;
	y: number;
	scale: number;
}

interface DragState {
	mode: 'pan' | 'node';
	node?: SimNode;
	panX: number;
	panY: number;
	pointerId: number;
	startX: number;
	startY: number;
	moved: boolean;
}

const RELATIONS: readonly RelationDefinition[] = [
	{ prop: 'P22', name: 'father', color: '#3923d6' },
	{ prop: 'P25', name: 'mother', color: '#ff4848' },
	{ prop: 'P40', name: 'child', color: '#7a7a7a' },
];

const NODE_LIMIT_OPTIONS = [
	30, 100, 150, 200, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500,
	2750, 3000, 3500, 4000, 4500, 5000, 7500, 10000,
] as const;
const DEFAULT_MAX_NODES = NODE_LIMIT_OPTIONS[0];
const DEFAULT_QID = 'Q42';
const LEGACY_WIKIDATA_CACHE_KEY = 'luke-shadwell-im:wikitree:wikidata:v2';
const WIKIDATA_CACHE_KEY_PREFIX = 'luke-shadwell-im:wikitree:wikidata:v3:';
const WIKIDATA_CACHE_SCHEMA_VERSION = 2;
const WIKIDATA_CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const ABSOLUTE_MIN_SCALE = 0.01;
const MAX_SCALE = 3.2;
const ZOOM_OUT_BREADTH_FACTOR = 1.2;
const DETAIL_LABEL_SCALE_THRESHOLD = 0.5;
const CLUSTER_LABEL_RADIUS_PX = 118;
const CLUSTER_LABEL_MIN_NODES = 4;
const CLUSTER_LABEL_MIN_SHARE = 0.6;
const CLUSTER_LABEL_VIEWPORT_MARGIN = 84;
const BASE_NODE_RADIUS = 14;
const MILITARY_RANK_PROPERTY = 'P410';
const MILITARY_BRANCH_PROPERTIES = ['P241', 'P463'] as const;
const FALLBACK_RANK_ICON = '🪖';
const IMAGE_PROPERTY = 'P18';
const DATE_OF_BIRTH_PROPERTY = 'P569';
const DATE_OF_DEATH_PROPERTY = 'P570';
const OCCUPATION_PROPERTY = 'P106';
const NOBLE_TITLE_PROPERTY = 'P97';
const HONORIFIC_PREFIX_PROPERTY = 'P511';
const PARTICIPATED_IN_CONFLICT_PROPERTY = 'P607';
const SUBCLASS_OF_PROPERTY = 'P279';
const WIKIDATA_REQUEST_INTERVAL_MS = 120;
const WIKIDATA_MAX_RETRIES = 5;
const WIKIDATA_BATCH_SIZE = 20;
const CACHEABLE_CLAIM_PROPERTIES = [
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

const HIGHLIGHT_FILTERS: readonly {
	readonly id: HighlightFilterId;
	readonly label: string;
	readonly description: string;
}[] = [
	{
		id: 'none',
		label: 'All people',
		description: 'Show the full graph without extra highlighting.',
	},
	{
		id: 'anglicanPriest',
		label: 'Anglican priest',
		description: 'Highlight people with occupation Anglican priest.',
	},
	{
		id: 'anyNobleTitle',
		label: 'Any noble title',
		description:
			'Highlight people who have any noble title value or any honorific prefix.',
	},
	{
		id: 'living',
		label: 'Living',
		description:
			'Highlight people with a date of birth, no date of death, and birth less than 100 years ago.',
	},
	{
		id: 'politician',
		label: 'Politician',
		description: 'Highlight people with occupation politician.',
	},
	{
		id: 'monarchNobleTitle',
		label: 'Monarchy',
		description:
			'Highlight people with a monarch noble title or the honorific prefix Royal Highness.',
	},
	{
		id: 'military',
		label: 'Military',
		description:
			'Highlight people with a military branch, participated in conflict, or military, police or special rank.',
	},
	{
		id: 'rightHonourable',
		label: 'The Right Honourable',
		description:
			'Highlight people with the honorific prefix The Right Honourable.',
	},
] as const;

let nextWikidataRequestAt = 0;
function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function setCanvasSize(canvas: HTMLCanvasElement) {
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	canvas.width = Math.max(1, Math.floor(rect.width * dpr));
	canvas.height = Math.max(1, Math.floor(rect.height * dpr));
	canvas.style.width = `${rect.width}px`;
	canvas.style.height = `${rect.height}px`;
}

function normalizeMaxNodes(raw: string | null) {
	const parsed = Number(raw);
	if (!Number.isInteger(parsed)) {
		return DEFAULT_MAX_NODES;
	}
	return NODE_LIMIT_OPTIONS.includes(
		parsed as (typeof NODE_LIMIT_OPTIONS)[number]
	)
		? parsed
		: DEFAULT_MAX_NODES;
}

function measureNodeBounds(nodes: readonly SimNode[]) {
	if (nodes.length === 0) {
		return null;
	}
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const node of nodes) {
		minX = Math.min(minX, node.x - node.radius);
		maxX = Math.max(maxX, node.x + node.radius);
		minY = Math.min(minY, node.y - node.radius);
		maxY = Math.max(maxY, node.y + node.radius);
	}
	return {
		centerX: (minX + maxX) / 2,
		centerY: (minY + maxY) / 2,
		contentHeight: Math.max(1, maxY - minY),
		contentWidth: Math.max(1, maxX - minX),
	};
}

function fitNodesToCanvas(
	nodes: readonly SimNode[],
	width: number,
	height: number
) {
	const bounds = measureNodeBounds(nodes);
	if (!bounds) {
		return { x: 0, y: 0, scale: 1 };
	}
	const padding = 140;
	const targetWidth = Math.max(1, width - padding);
	const targetHeight = Math.max(1, height - padding);
	const scale = clamp(
		Math.min(
			targetWidth / bounds.contentWidth,
			targetHeight / bounds.contentHeight,
			MAX_SCALE
		),
		ABSOLUTE_MIN_SCALE,
		MAX_SCALE
	);
	return {
		scale,
		x: width / 2 - bounds.centerX * scale,
		y: height / 2 - bounds.centerY * scale,
	};
}

function minZoomScaleForChart(
	nodes: readonly SimNode[],
	width: number,
	height: number
) {
	const bounds = measureNodeBounds(nodes);
	if (!bounds) {
		return ABSOLUTE_MIN_SCALE;
	}
	const padding = 140;
	const targetWidth = Math.max(1, width - padding);
	const targetHeight = Math.max(1, height - padding);
	const fitScale = Math.min(
		targetWidth / bounds.contentWidth,
		targetHeight / bounds.contentHeight,
		MAX_SCALE
	);
	return clamp(
		fitScale / ZOOM_OUT_BREADTH_FACTOR,
		ABSOLUTE_MIN_SCALE,
		MAX_SCALE
	);
}

function normaliseQid(input: string) {
	const trimmed = input.trim().toUpperCase();
	if (!trimmed) {
		return '';
	}
	if (/^Q\d+$/.test(trimmed)) {
		return trimmed;
	}
	const digits = trimmed.replace(/[^0-9]/g, '');
	return digits ? `Q${digits}` : trimmed;
}

function cacheKeyForEntity(qid: string) {
	return `${WIKIDATA_CACHE_KEY_PREFIX}${qid}`;
}

function pruneEntityForCache(entity: CachedEntityValue): CachedEntityValue {
	const prunedClaims: Record<string, readonly unknown[]> = {};
	for (const property of CACHEABLE_CLAIM_PROPERTIES) {
		const claims = entity.claims?.[property];
		if (claims && claims.length > 0) {
			prunedClaims[property] = claims;
		}
	}
	return {
		claims: Object.keys(prunedClaims).length > 0 ? prunedClaims : undefined,
		id: entity.id,
		labels: entity.labels?.en?.value
			? {
					en: {
						value: entity.labels.en.value,
					},
				}
			: undefined,
	};
}

function isAbortError(caught: unknown) {
	return caught instanceof DOMException && caught.name === 'AbortError';
}

function readRetryAfterMs(response: Response) {
	const retryAfter = response.headers.get('retry-after');
	if (!retryAfter) {
		return undefined;
	}
	const seconds = Number(retryAfter);
	if (Number.isFinite(seconds) && seconds >= 0) {
		return seconds * 1000;
	}
	const dateMs = Date.parse(retryAfter);
	return Number.isFinite(dateMs)
		? Math.max(0, dateMs - Date.now())
		: undefined;
}

function waitForDelay(delayMs: number, signal: AbortSignal) {
	if (delayMs <= 0) {
		return Promise.resolve();
	}
	return new Promise<void>((resolve, reject) => {
		const timeout = globalThis.setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, delayMs);
		const onAbort = () => {
			globalThis.clearTimeout(timeout);
			reject(new DOMException('aborted', 'AbortError'));
		};
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

async function waitForWikidataSlot(signal: AbortSignal) {
	const delayMs = Math.max(0, nextWikidataRequestAt - Date.now());
	if (delayMs > 0) {
		await waitForDelay(delayMs, signal);
	}
	nextWikidataRequestAt = Date.now() + WIKIDATA_REQUEST_INTERVAL_MS;
}

async function fetchEntity(
	qid: string,
	signal: AbortSignal,
	onRateLimitChange?: (rateLimited: boolean, retryAt: number | null) => void
) {
	const entityMap = await fetchEntities([qid], signal, onRateLimitChange);
	return entityMap.get(qid);
}

function uniqueQids(qids: readonly string[]) {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const qid of qids) {
		if (!/^Q\d+$/.test(qid) || seen.has(qid)) {
			continue;
		}
		seen.add(qid);
		unique.push(qid);
	}
	return unique;
}

async function fetchEntities(
	qids: readonly string[],
	signal: AbortSignal,
	onRateLimitChange?: (rateLimited: boolean, retryAt: number | null) => void
) {
	const results = new Map<string, CachedEntityValue | undefined>();
	const uncachedQids: string[] = [];

	for (const qid of uniqueQids(qids)) {
		const cachedEntity = readCachedEntity(qid);
		if (cachedEntity) {
			results.set(qid, cachedEntity);
			continue;
		}
		uncachedQids.push(qid);
	}

	for (
		let start = 0;
		start < uncachedQids.length;
		start += WIKIDATA_BATCH_SIZE
	) {
		const batchQids = uncachedQids.slice(
			start,
			start + WIKIDATA_BATCH_SIZE
		);
		const params = new URLSearchParams({
			action: 'wbgetentities',
			format: 'json',
			ids: batchQids.join('|'),
			languages: 'en',
			origin: '*',
			props: 'labels|claims',
		});
		let completed = false;
		for (let attempt = 0; attempt < WIKIDATA_MAX_RETRIES; attempt++) {
			await waitForWikidataSlot(signal);
			const response = await fetch(
				`https://www.wikidata.org/w/api.php?${params.toString()}`,
				{ signal }
			);
			if (response.status === 429 || response.status === 503) {
				const retryAfterMs =
					readRetryAfterMs(response) ??
					Math.min(8000, 600 * 2 ** attempt);
				const retryAt = Date.now() + retryAfterMs;
				onRateLimitChange?.(true, retryAt);
				nextWikidataRequestAt = retryAt;
				await waitForDelay(retryAfterMs, signal);
				onRateLimitChange?.(false, null);
				continue;
			}
			if (!response.ok) {
				throw new Error(
					`Wikidata request failed with ${response.status}`
				);
			}
			const payload = (await response.json()) as {
				readonly entities?: Record<string, CachedEntityValue>;
			};
			for (const qid of batchQids) {
				const entity = payload.entities?.[qid];
				if (!entity) {
					results.set(qid, undefined);
					continue;
				}
				const prunedEntity = pruneEntityForCache(entity);
				writeCachedEntity(qid, prunedEntity);
				results.set(qid, prunedEntity);
			}
			completed = true;
			break;
		}
		if (!completed) {
			onRateLimitChange?.(false, null);
			throw new Error(
				'Wikidata rate limit persisted after multiple retries.'
			);
		}
	}

	return results;
}

function getCacheStore() {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		const raw = window.localStorage.getItem(LEGACY_WIKIDATA_CACHE_KEY);
		if (!raw) {
			return {};
		}
		return JSON.parse(raw) as Record<string, CachedEntityRecord>;
	} catch {
		return {};
	}
}

function setCacheStore(store: Record<string, CachedEntityRecord>) {
	if (typeof window === 'undefined') {
		return;
	}
	try {
		window.localStorage.setItem(
			LEGACY_WIKIDATA_CACHE_KEY,
			JSON.stringify(store)
		);
	} catch {
		// Ignore quota and serialization failures; caching is opportunistic.
	}
}

function clearCachedEntity(qid: string) {
	if (typeof window === 'undefined') {
		return;
	}
	try {
		window.localStorage.removeItem(cacheKeyForEntity(qid));
	} catch {
		// Ignore local storage cleanup failures.
	}
	const legacyStore = getCacheStore();
	if (legacyStore?.[qid]) {
		delete legacyStore[qid];
		setCacheStore(legacyStore);
	}
}

function readCachedEntity(qid: string) {
	if (typeof window === 'undefined') {
		return undefined;
	}
	let record: CachedEntityRecord | undefined;
	try {
		const raw = window.localStorage.getItem(cacheKeyForEntity(qid));
		record = raw ? (JSON.parse(raw) as CachedEntityRecord) : undefined;
	} catch {
		record = undefined;
	}
	if (!record) {
		const legacyStore = getCacheStore();
		const legacyRecord = legacyStore?.[qid];
		if (!legacyRecord) {
			return undefined;
		}
		record = legacyRecord;
	}
	if (record.schemaVersion !== WIKIDATA_CACHE_SCHEMA_VERSION) {
		clearCachedEntity(qid);
		return undefined;
	}
	if (record.expiresAt <= Date.now()) {
		clearCachedEntity(qid);
		return undefined;
	}
	const value = record.value as CachedEntityValue;
	const prunedValue = pruneEntityForCache(value);
	writeCachedEntity(qid, prunedValue);
	return prunedValue;
}

function writeCachedEntity(qid: string, entity: CachedEntityValue) {
	if (typeof window === 'undefined') {
		return;
	}
	const record: CachedEntityRecord = {
		expiresAt: Date.now() + WIKIDATA_CACHE_TTL_MS,
		schemaVersion: WIKIDATA_CACHE_SCHEMA_VERSION,
		value: pruneEntityForCache(entity),
	};
	try {
		window.localStorage.setItem(
			cacheKeyForEntity(qid),
			JSON.stringify(record)
		);
	} catch {
		// Ignore quota failures; caching is opportunistic.
	}
}

function claimToQid(claim: unknown) {
	if (
		typeof claim !== 'object' ||
		claim === null ||
		!('mainsnak' in claim) ||
		typeof claim.mainsnak !== 'object' ||
		claim.mainsnak === null ||
		!('datavalue' in claim.mainsnak) ||
		typeof claim.mainsnak.datavalue !== 'object' ||
		claim.mainsnak.datavalue === null ||
		!('value' in claim.mainsnak.datavalue) ||
		typeof claim.mainsnak.datavalue.value !== 'object' ||
		claim.mainsnak.datavalue.value === null ||
		!('id' in claim.mainsnak.datavalue.value)
	) {
		return undefined;
	}
	const id = claim.mainsnak.datavalue.value.id;
	return typeof id === 'string' && /^Q\d+$/.test(id) ? id : undefined;
}

function normaliseRank(label: string) {
	return label.trim().toLowerCase();
}

function emojiIconFromLabel(_label: string): RankIcon {
	return { type: 'emoji', value: FALLBACK_RANK_ICON };
}

function rankIconFromLabels(
	rankLabel?: string,
	branchLabel?: string
): RankIcon | undefined {
	const normalizedRank = rankLabel ? normaliseRank(rankLabel) : undefined;
	const normalizedBranch = branchLabel
		? normaliseRank(branchLabel)
		: undefined;
	for (const rule of RANK_IMAGE_RULES) {
		if (!normalizedRank || !rule.rankMatch.test(normalizedRank)) {
			continue;
		}
		if (
			rule.branchMatch &&
			(!normalizedBranch || !rule.branchMatch.test(normalizedBranch))
		) {
			continue;
		}
		return { type: 'image', src: rule.src };
	}
	if (rankLabel) {
		return emojiIconFromLabel(rankLabel);
	}
	return undefined;
}

function claimToString(claim: unknown) {
	if (
		typeof claim !== 'object' ||
		claim === null ||
		!('mainsnak' in claim) ||
		typeof claim.mainsnak !== 'object' ||
		claim.mainsnak === null ||
		!('datavalue' in claim.mainsnak) ||
		typeof claim.mainsnak.datavalue !== 'object' ||
		claim.mainsnak.datavalue === null ||
		!('value' in claim.mainsnak.datavalue)
	) {
		return undefined;
	}
	const value = claim.mainsnak.datavalue.value;
	return typeof value === 'string' ? value : undefined;
}

function claimToTimeMs(claim: unknown) {
	if (
		typeof claim !== 'object' ||
		claim === null ||
		!('mainsnak' in claim) ||
		typeof claim.mainsnak !== 'object' ||
		claim.mainsnak === null ||
		!('datavalue' in claim.mainsnak) ||
		typeof claim.mainsnak.datavalue !== 'object' ||
		claim.mainsnak.datavalue === null ||
		!('value' in claim.mainsnak.datavalue) ||
		typeof claim.mainsnak.datavalue.value !== 'object' ||
		claim.mainsnak.datavalue.value === null ||
		!('time' in claim.mainsnak.datavalue.value)
	) {
		return undefined;
	}
	const rawTime = claim.mainsnak.datavalue.value.time;
	if (typeof rawTime !== 'string') {
		return undefined;
	}
	const match = /^([+-]\d{4,})-(\d{2})-(\d{2})T/.exec(rawTime);
	if (!match) {
		return undefined;
	}
	const year = Number(match[1]);
	const month = Math.max(1, Number(match[2]));
	const day = Math.max(1, Number(match[3]));
	if (
		!Number.isInteger(year) ||
		!Number.isInteger(month) ||
		!Number.isInteger(day)
	) {
		return undefined;
	}
	if (year < 1 || year > 9999 || month > 12 || day > 31) {
		return undefined;
	}
	return Date.UTC(year, month - 1, day);
}

function firstClaimTimeMs(claims: readonly unknown[] | undefined) {
	if (!claims) {
		return undefined;
	}
	for (const claim of claims) {
		const timeMs = claimToTimeMs(claim);
		if (timeMs !== undefined) {
			return timeMs;
		}
	}
	return undefined;
}

function isLikelyLivingPerson(
	birthClaims: readonly unknown[] | undefined,
	deathClaims: readonly unknown[] | undefined
) {
	if ((deathClaims?.length ?? 0) > 0) {
		return false;
	}
	const birthTimeMs = firstClaimTimeMs(birthClaims);
	if (birthTimeMs === undefined) {
		return false;
	}
	const now = Date.now();
	const cutoff = new Date(now);
	cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 100);
	return birthTimeMs <= now && birthTimeMs >= cutoff.getTime();
}

function fileNameToCommonsUrl(fileName: string) {
	return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
}

type RankMetadata = {
	readonly rankIcon?: RankIcon;
	readonly rankLabel?: string;
	readonly branchLabel?: string;
};

function claimIdsFromClaims(claims: readonly unknown[] | undefined) {
	if (!claims) {
		return [];
	}
	const ids: string[] = [];
	for (const claim of claims) {
		const qid = claimToQid(claim);
		if (qid) {
			ids.push(qid);
		}
	}
	return ids;
}

function hasNormalizedLabel(labels: readonly string[], expected: string) {
	const normalizedExpected = normaliseRank(expected);
	return labels.some(label => normaliseRank(label) === normalizedExpected);
}

async function _resolveEntityLabel(
	qid: string,
	signal: AbortSignal,
	labelCache: Map<string, string | null>,
	onRateLimitChange?: (rateLimited: boolean, retryAt: number | null) => void
) {
	void qid;
	void signal;
	void labelCache;
	void onRateLimitChange;
	let label = labelCache.get(qid);
	if (label === undefined) {
		try {
			const entity = (
				await fetchEntities([qid], signal, onRateLimitChange)
			).get(qid);
			label = entity?.labels?.en?.value ?? null;
		} catch {
			label = null;
		}
		labelCache.set(qid, label);
	}
	return label ?? undefined;
}

async function resolveLabelsFromClaims(
	claims: readonly unknown[] | undefined,
	signal: AbortSignal,
	labelCache: Map<string, string | null>,
	onRateLimitChange?: (rateLimited: boolean, retryAt: number | null) => void
) {
	const qids = claimIdsFromClaims(claims);
	const missingQids = qids.filter(qid => !labelCache.has(qid));
	if (missingQids.length > 0) {
		const entities = await fetchEntities(
			missingQids,
			signal,
			onRateLimitChange
		);
		for (const qid of missingQids) {
			const entity = entities.get(qid);
			labelCache.set(qid, entity?.labels?.en?.value ?? null);
		}
	}
	const labels: string[] = [];
	for (const qid of qids) {
		const label = labelCache.get(qid) ?? null;
		if (label && !labels.includes(label)) {
			labels.push(label);
		}
	}
	return labels;
}

async function isEntityOrSubclassOfLabel(
	qid: string,
	targetLabel: string,
	signal: AbortSignal,
	labelCache: Map<string, string | null>,
	subclassCache: Map<string, boolean>,
	onRateLimitChange?: (rateLimited: boolean, retryAt: number | null) => void,
	visited: Set<string> = new Set()
): Promise<boolean> {
	if (visited.has(qid)) {
		return false;
	}
	if (subclassCache.has(qid)) {
		return subclassCache.get(qid) ?? false;
	}
	visited.add(qid);
	const entity = await fetchEntity(qid, signal, onRateLimitChange);
	const ownLabel = entity?.labels?.en?.value;
	labelCache.set(qid, ownLabel ?? null);
	if (ownLabel && normaliseRank(ownLabel) === normaliseRank(targetLabel)) {
		subclassCache.set(qid, true);
		return true;
	}
	for (const parentId of claimIdsFromClaims(
		entity?.claims?.[SUBCLASS_OF_PROPERTY]
	)) {
		if (
			await isEntityOrSubclassOfLabel(
				parentId,
				targetLabel,
				signal,
				labelCache,
				subclassCache,
				onRateLimitChange,
				visited
			)
		) {
			subclassCache.set(qid, true);
			return true;
		}
	}
	subclassCache.set(qid, false);
	return false;
}

async function resolveRankMetadata(
	rankClaims: readonly unknown[] | undefined,
	branchClaims: readonly unknown[] | undefined,
	signal: AbortSignal,
	labelCache: Map<string, string | null>,
	onRateLimitChange?: (rateLimited: boolean, retryAt: number | null) => void
): Promise<RankMetadata> {
	const [rankLabels, branchLabels] = await Promise.all([
		resolveLabelsFromClaims(
			rankClaims,
			signal,
			labelCache,
			onRateLimitChange
		),
		resolveLabelsFromClaims(
			branchClaims,
			signal,
			labelCache,
			onRateLimitChange
		),
	]);
	const rankLabel = rankLabels[0];
	const branchLabel = branchLabels[0];
	if (!rankLabel && !branchLabel) {
		return {};
	}
	return {
		rankIcon: rankLabel
			? rankIconFromLabels(rankLabel, branchLabel)
			: undefined,
		rankLabel,
		branchLabel,
	};
}

async function buildGraph(
	rootId: string,
	nodeLimit: number,
	signal: AbortSignal,
	onProgress: (state: LoadingState) => void,
	onGraphUpdate?: (graph: GraphData) => void
): Promise<GraphData> {
	const nodes: Record<string, EntityNode> = {};
	const edges: EntityEdge[] = [];
	const labelCache = new Map<string, string | null>();
	const monarchSubclassCache = new Map<string, boolean>();
	const queued = [rootId];
	const seen = new Set<string>();
	let excessiveNodes = false;
	let rateLimited = false;
	let retryAt: number | null = null;

	const publishProgress = () => {
		onProgress({
			loaded: seen.size,
			loading: true,
			queued: queued.length,
			rateLimited,
			retryAt,
		});
	};

	const updateRateLimitState = (
		nextRateLimited: boolean,
		nextRetryAt: number | null
	) => {
		if (rateLimited === nextRateLimited && retryAt === nextRetryAt) {
			return;
		}
		rateLimited = nextRateLimited;
		retryAt = nextRetryAt;
		publishProgress();
	};

	const snapshotGraph = (): GraphData => ({
		edges: [...edges],
		excessiveNodes,
		nodes: { ...nodes },
		rootId,
	});

	const emitGraphUpdate = () => {
		if (!onGraphUpdate) {
			return;
		}
		onGraphUpdate(snapshotGraph());
	};

	while (queued.length > 0) {
		if (signal.aborted) {
			throw new DOMException('aborted', 'AbortError');
		}
		if (seen.size >= nodeLimit) {
			excessiveNodes = true;
			break;
		}

		const batchIds: string[] = [];
		const batchIdSet = new Set<string>();
		while (queued.length > 0 && batchIds.length < WIKIDATA_BATCH_SIZE) {
			const currentId = queued.shift();
			if (
				!currentId ||
				seen.has(currentId) ||
				batchIdSet.has(currentId)
			) {
				continue;
			}
			if (seen.size + batchIds.length >= nodeLimit) {
				excessiveNodes = true;
				break;
			}
			batchIds.push(currentId);
			batchIdSet.add(currentId);
		}
		if (batchIds.length === 0) {
			if (excessiveNodes) {
				break;
			}
			continue;
		}

		const entities = await fetchEntities(
			batchIds,
			signal,
			updateRateLimitState
		);
		for (const currentId of batchIds) {
			seen.add(currentId);
			publishProgress();

			const entity = entities.get(currentId);
			if (!entity) {
				continue;
			}
			const branchClaims: unknown[] = [];
			for (const branchProp of MILITARY_BRANCH_PROPERTIES) {
				branchClaims.push(...(entity.claims?.[branchProp] ?? []));
			}
			const rankMetadata = await resolveRankMetadata(
				entity.claims?.[MILITARY_RANK_PROPERTY],
				branchClaims.length > 0 ? branchClaims : undefined,
				signal,
				labelCache,
				updateRateLimitState
			);
			const firstImageClaim = (entity.claims?.[IMAGE_PROPERTY] ?? [])[0];
			const imageFileName = firstImageClaim
				? claimToString(firstImageClaim)
				: undefined;
			const imageUrl = imageFileName
				? fileNameToCommonsUrl(imageFileName)
				: undefined;
			const occupationLabels = await resolveLabelsFromClaims(
				entity.claims?.[OCCUPATION_PROPERTY],
				signal,
				labelCache,
				updateRateLimitState
			);
			const honorificLabels = await resolveLabelsFromClaims(
				entity.claims?.[HONORIFIC_PREFIX_PROPERTY],
				signal,
				labelCache,
				updateRateLimitState
			);
			const hasHonorificPrefix =
				(entity.claims?.[HONORIFIC_PREFIX_PROPERTY]?.length ?? 0) > 0;
			const nobleTitleClaims = entity.claims?.[NOBLE_TITLE_PROPERTY];
			const nobleTitleIds = claimIdsFromClaims(nobleTitleClaims);
			let monarchNobleTitle = hasNormalizedLabel(
				honorificLabels,
				'Royal Highness'
			);
			const hasMilitaryRank =
				(entity.claims?.[MILITARY_RANK_PROPERTY]?.length ?? 0) > 0;
			const hasMilitaryBranch = branchClaims.length > 0;
			const hasMilitaryConflict =
				(entity.claims?.[PARTICIPATED_IN_CONFLICT_PROPERTY]?.length ??
					0) > 0;
			const isLiving = isLikelyLivingPerson(
				entity.claims?.[DATE_OF_BIRTH_PROPERTY],
				entity.claims?.[DATE_OF_DEATH_PROPERTY]
			);
			for (const titleId of nobleTitleIds) {
				if (
					await isEntityOrSubclassOfLabel(
						titleId,
						'monarch',
						signal,
						labelCache,
						monarchSubclassCache,
						updateRateLimitState
					)
				) {
					monarchNobleTitle = true;
					break;
				}
			}
			const highlightFlags: HighlightFlags = {
				anglicanPriest: hasNormalizedLabel(
					occupationLabels,
					'Anglican priest'
				),
				anyNobleTitle: nobleTitleIds.length > 0 || hasHonorificPrefix,
				living: isLiving,
				politician: hasNormalizedLabel(occupationLabels, 'politician'),
				military:
					hasMilitaryRank || hasMilitaryBranch || hasMilitaryConflict,
				monarchNobleTitle,
				rightHonourable: hasNormalizedLabel(
					honorificLabels,
					'The Right Honourable'
				),
			};

			nodes[currentId] = {
				id: currentId,
				highlightFlags,
				imageUrl,
				rankIcon: rankMetadata.rankIcon,
				rankLabel: rankMetadata.rankLabel,
				branchLabel: rankMetadata.branchLabel,
				label: entity.labels?.en?.value ?? currentId,
				url: `https://www.wikidata.org/wiki/${currentId}`,
			};

			for (const relation of RELATIONS) {
				const claims = entity.claims?.[relation.prop] ?? [];
				for (const claim of claims) {
					const relatedId = claimToQid(claim);
					if (!relatedId) {
						continue;
					}
					if (relation.name === 'child') {
						edges.push({
							color: relation.color,
							from: currentId,
							relation: relation.name,
							to: relatedId,
						});
					} else {
						edges.push({
							color: relation.color,
							from: relatedId,
							relation: relation.name,
							to: currentId,
						});
					}
					if (
						!seen.has(relatedId) &&
						!batchIdSet.has(relatedId) &&
						!queued.includes(relatedId)
					) {
						if (seen.size + queued.length >= nodeLimit) {
							excessiveNodes = true;
							continue;
						}
						queued.push(relatedId);
					}
				}
			}
			emitGraphUpdate();
		}
	}

	onProgress({
		loaded: Object.keys(nodes).length,
		loading: false,
		queued: 0,
		rateLimited: false,
		retryAt: null,
	});
	const finalGraph = snapshotGraph();
	emitGraphUpdate();
	return finalGraph;
}

function useDepths(graph: GraphData | null) {
	return useMemo(() => {
		if (!graph) {
			return new Map<string, number>();
		}
		const depths = new Map<string, number>([[graph.rootId, 0]]);
		const queue = [graph.rootId];

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) {
				continue;
			}
			const currentDepth = depths.get(current) ?? 0;
			for (const edge of graph.edges) {
				if (
					edge.to === current &&
					(edge.relation === 'father' || edge.relation === 'mother')
				) {
					if (!depths.has(edge.from)) {
						depths.set(edge.from, currentDepth - 1);
						queue.push(edge.from);
					}
				}
				if (edge.from === current && edge.relation === 'child') {
					if (!depths.has(edge.to)) {
						depths.set(edge.to, currentDepth + 1);
						queue.push(edge.to);
					}
				}
			}
		}

		for (const id of Object.keys(graph.nodes)) {
			if (!depths.has(id)) {
				depths.set(id, 0);
			}
		}
		return depths;
	}, [graph]);
}

function matchesHighlightFilter(
	node: Pick<EntityNode, 'highlightFlags'>,
	filterId: HighlightFilterId
) {
	switch (filterId) {
		case 'anglicanPriest':
			return node.highlightFlags.anglicanPriest;
		case 'anyNobleTitle':
			return node.highlightFlags.anyNobleTitle;
		case 'living':
			return node.highlightFlags.living;
		case 'politician':
			return node.highlightFlags.politician;
		case 'military':
			return node.highlightFlags.military;
		case 'monarchNobleTitle':
			return node.highlightFlags.monarchNobleTitle;
		case 'rightHonourable':
			return node.highlightFlags.rightHonourable;
		case 'none':
		default:
			return false;
	}
}

function normaliseSearchQuery(value: string) {
	return value.trim().toLowerCase();
}

function matchesSearchQuery(
	node: Pick<EntityNode, 'id' | 'label'>,
	searchQuery: string
) {
	const normalizedQuery = normaliseSearchQuery(searchQuery);
	if (!normalizedQuery) {
		return false;
	}
	return (
		node.label.toLowerCase().includes(normalizedQuery) ||
		node.id.toLowerCase().includes(normalizedQuery)
	);
}

function isNodeHighlighted(
	node: Pick<EntityNode, 'highlightFlags' | 'id' | 'label'>,
	filterId: HighlightFilterId,
	searchQuery: string
) {
	return (
		matchesHighlightFilter(node, filterId) ||
		matchesSearchQuery(node, searchQuery)
	);
}

function extractFamilyName(label: string) {
	const primaryPart = (label.split(',')[0] ?? label)
		.replace(/\([^)]*\)/g, ' ')
		.trim();
	const tokens = primaryPart.match(/[A-Za-z][A-Za-z'’-]*/g);
	if (!tokens || tokens.length < 2) {
		return undefined;
	}
	const candidate = tokens[tokens.length - 1];
	if (!candidate || /^[ivxlcdm]+$/i.test(candidate) || candidate.length < 2) {
		return undefined;
	}
	return candidate;
}

function rectanglesOverlap(
	left: number,
	top: number,
	right: number,
	bottom: number,
	placedRects: readonly {
		left: number;
		top: number;
		right: number;
		bottom: number;
	}[]
) {
	return placedRects.some(
		rect =>
			!(
				right < rect.left ||
				left > rect.right ||
				bottom < rect.top ||
				top > rect.bottom
			)
	);
}

function drawClusterFamilyLabels(
	ctx: CanvasRenderingContext2D,
	nodes: readonly SimNode[],
	transform: ViewportTransform,
	width: number,
	height: number
) {
	if (
		transform.scale > DETAIL_LABEL_SCALE_THRESHOLD ||
		nodes.length < CLUSTER_LABEL_MIN_NODES
	) {
		return;
	}

	const clusterRadius = CLUSTER_LABEL_RADIUS_PX;
	const clusterRadiusSq = clusterRadius * clusterRadius;
	const clusterCellSize = clusterRadius;
	const visibleNodes: {
		readonly cellX: number;
		readonly cellY: number;
		readonly screenX: number;
		readonly screenY: number;
		readonly surname?: string;
	}[] = [];

	for (const node of nodes) {
		const screenX = transform.x + node.x * transform.scale;
		const screenY = transform.y + node.y * transform.scale;
		if (
			screenX < -CLUSTER_LABEL_VIEWPORT_MARGIN ||
			screenX > width + CLUSTER_LABEL_VIEWPORT_MARGIN ||
			screenY < -CLUSTER_LABEL_VIEWPORT_MARGIN ||
			screenY > height + CLUSTER_LABEL_VIEWPORT_MARGIN
		) {
			continue;
		}
		visibleNodes.push({
			cellX: Math.floor(screenX / clusterCellSize),
			cellY: Math.floor(screenY / clusterCellSize),
			screenX,
			screenY,
			surname: extractFamilyName(node.label),
		});
	}

	if (visibleNodes.length < CLUSTER_LABEL_MIN_NODES) {
		return;
	}

	const buckets = new Map<string, number[]>();
	for (let index = 0; index < visibleNodes.length; index++) {
		const node = visibleNodes[index];
		if (!node) {
			continue;
		}
		const key = `${node.cellX}:${node.cellY}`;
		const bucket = buckets.get(key);
		if (bucket) {
			bucket.push(index);
		} else {
			buckets.set(key, [index]);
		}
	}

	const visited = new Uint8Array(visibleNodes.length);
	const candidates: {
		readonly count: number;
		readonly fontSize: number;
		readonly heightHint: number;
		readonly text: string;
		readonly widthHint: number;
		readonly x: number;
		readonly y: number;
	}[] = [];

	for (let startIndex = 0; startIndex < visibleNodes.length; startIndex++) {
		if (visited[startIndex]) {
			continue;
		}
		const queue = [startIndex];
		const clusterIndices: number[] = [];
		visited[startIndex] = 1;

		while (queue.length > 0) {
			const currentIndex = queue.pop();
			if (currentIndex === undefined) {
				continue;
			}
			clusterIndices.push(currentIndex);
			const current = visibleNodes[currentIndex];
			if (!current) {
				continue;
			}
			for (let offsetX = -1; offsetX <= 1; offsetX++) {
				for (let offsetY = -1; offsetY <= 1; offsetY++) {
					const bucket = buckets.get(
						`${current.cellX + offsetX}:${current.cellY + offsetY}`
					);
					if (!bucket) {
						continue;
					}
					for (const neighborIndex of bucket) {
						if (visited[neighborIndex]) {
							continue;
						}
						const neighbor = visibleNodes[neighborIndex];
						if (!neighbor) {
							continue;
						}
						const dx = current.screenX - neighbor.screenX;
						const dy = current.screenY - neighbor.screenY;
						if (dx * dx + dy * dy > clusterRadiusSq) {
							continue;
						}
						visited[neighborIndex] = 1;
						queue.push(neighborIndex);
					}
				}
			}
		}

		if (clusterIndices.length < CLUSTER_LABEL_MIN_NODES) {
			continue;
		}

		const surnameCounts = new Map<string, number>();
		for (const clusterIndex of clusterIndices) {
			const surname = visibleNodes[clusterIndex]?.surname;
			if (!surname) {
				continue;
			}
			surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
		}
		if (surnameCounts.size === 0) {
			continue;
		}

		let dominantSurname = '';
		let dominantCount = 0;
		for (const [surname, count] of surnameCounts) {
			if (count > dominantCount) {
				dominantSurname = surname;
				dominantCount = count;
			}
		}
		if (
			!dominantSurname ||
			dominantCount < 3 ||
			dominantCount <
				Math.ceil(clusterIndices.length * CLUSTER_LABEL_MIN_SHARE)
		) {
			continue;
		}

		const matchingNodes = clusterIndices
			.map(clusterIndex => visibleNodes[clusterIndex])
			.filter(
				(node): node is (typeof visibleNodes)[number] =>
					!!node && node.surname === dominantSurname
			);
		if (matchingNodes.length < 3) {
			continue;
		}

		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		let totalX = 0;
		let totalY = 0;
		for (const node of matchingNodes) {
			minX = Math.min(minX, node.screenX);
			maxX = Math.max(maxX, node.screenX);
			minY = Math.min(minY, node.screenY);
			maxY = Math.max(maxY, node.screenY);
			totalX += node.screenX;
			totalY += node.screenY;
		}
		const widthHint = Math.max(80, maxX - minX + 44);
		const heightHint = Math.max(28, maxY - minY + 32);
		const text = dominantSurname.toUpperCase();
		const fontSize = clamp(
			Math.min(
				62,
				widthHint / Math.max(3, text.length * 0.58),
				heightHint * 0.6
			),
			18,
			62
		);
		if (fontSize < 18) {
			continue;
		}

		candidates.push({
			count: dominantCount,
			fontSize,
			heightHint,
			text,
			widthHint,
			x: totalX / matchingNodes.length,
			y: totalY / matchingNodes.length,
		});
	}

	candidates.sort(
		(left, right) =>
			right.count - left.count || right.fontSize - left.fontSize
	);
	const placedRects: {
		left: number;
		top: number;
		right: number;
		bottom: number;
	}[] = [];

	for (const candidate of candidates) {
		let fontSize = candidate.fontSize;
		let textWidth = 0;
		while (fontSize >= 18) {
			ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
			textWidth = ctx.measureText(candidate.text).width;
			if (textWidth <= candidate.widthHint * 1.08) {
				break;
			}
			fontSize -= 1;
		}
		if (fontSize < 18) {
			continue;
		}

		const left = candidate.x - textWidth / 2 - 12;
		const right = candidate.x + textWidth / 2 + 12;
		const top = candidate.y - fontSize * 0.62;
		const bottom = candidate.y + fontSize * 0.32;
		if (
			left < -32 ||
			right > width + 32 ||
			top < -24 ||
			bottom > height + 24 ||
			rectanglesOverlap(left, top, right, bottom, placedRects)
		) {
			continue;
		}

		placedRects.push({ left, top, right, bottom });
		ctx.save();
		ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		ctx.lineWidth = Math.max(3, fontSize * 0.15);
		ctx.strokeStyle = 'rgba(255, 249, 235, 0.92)';
		ctx.fillStyle = 'rgba(91, 68, 28, 0.24)';
		ctx.strokeText(candidate.text, candidate.x, candidate.y);
		ctx.fillText(candidate.text, candidate.x, candidate.y);
		ctx.restore();
	}
}

function createPlaceholderGraph(rootId: string): GraphData {
	return {
		edges: [],
		excessiveNodes: false,
		nodes: {
			[rootId]: {
				branchLabel: undefined,
				highlightFlags: {
					anglicanPriest: false,
					anyNobleTitle: false,
					living: false,
					politician: false,
					military: false,
					monarchNobleTitle: false,
					rightHonourable: false,
				},
				id: rootId,
				imageUrl: undefined,
				label: rootId,
				rankIcon: undefined,
				rankLabel: undefined,
				url: `https://www.wikidata.org/wiki/${rootId}`,
			},
		},
		rootId,
	};
}

export default function WikiTreePage() {
	const [inputValue, setInputValue] = useState(DEFAULT_QID);
	const [requestedQid, setRequestedQid] = useState<string | null>(null);
	const [selectedNodeLimit, setSelectedNodeLimit] =
		useState<number>(DEFAULT_MAX_NODES);
	const [requestedNodeLimit, setRequestedNodeLimit] =
		useState<number>(DEFAULT_MAX_NODES);
	const [selectedId, setSelectedId] = useState<string>(DEFAULT_QID);
	const [error, setError] = useState<string | null>(null);
	const [graph, setGraph] = useState<GraphData | null>(null);
	const [activeHighlight, setActiveHighlight] =
		useState<HighlightFilterId>('none');
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [loadingState, setLoadingState] = useState<LoadingState>({
		loaded: 0,
		loading: true,
		queued: 0,
		rateLimited: false,
		retryAt: null,
	});
	const [clockNow, setClockNow] = useState(() => Date.now());
	const depths = useDepths(graph);
	const retryCountdownSeconds =
		loadingState.rateLimited && loadingState.retryAt
			? Math.max(0, Math.ceil((loadingState.retryAt - clockNow) / 1000))
			: null;
	const retryCountdownText =
		retryCountdownSeconds === null
			? ''
			: retryCountdownSeconds > 0
				? `Backing off for Wikidata rate limits. Retrying in ${retryCountdownSeconds}s.`
				: 'Backing off for Wikidata rate limits. Retrying now.';
	const highlightCounts = useMemo(() => {
		const counts = new Map<HighlightFilterId, number>([['none', 0]]);
		for (const filter of HIGHLIGHT_FILTERS) {
			if (filter.id !== 'none') {
				counts.set(filter.id, 0);
			}
		}
		if (!graph) {
			return counts;
		}
		for (const node of Object.values(graph.nodes)) {
			for (const filter of HIGHLIGHT_FILTERS) {
				if (filter.id === 'none') {
					continue;
				}
				if (matchesHighlightFilter(node, filter.id)) {
					counts.set(filter.id, (counts.get(filter.id) ?? 0) + 1);
				}
			}
		}
		return counts;
	}, [graph]);
	const searchMatchCount = useMemo(() => {
		if (!graph) {
			return 0;
		}
		return Object.values(graph.nodes).filter(node =>
			matchesSearchQuery(node, searchQuery)
		).length;
	}, [graph, searchQuery]);
	const selectedIdRef = useRef(selectedId);
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const simulationRef = useRef<unknown | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const drawRequestRef = useRef<number>(0);
	const drawRef = useRef<(() => void) | null>(null);
	const transformRef = useRef<ViewportTransform>({
		scale: 1,
		x: 0,
		y: 0,
	});
	const dragStateRef = useRef<DragState | null>(null);
	const nodesRef = useRef<SimNode[]>([]);
	const linksRef = useRef<SimEdge[]>([]);
	const canvasViewportRef = useRef<DOMRect | null>(null);
	const labelContainerRef = useRef<HTMLDivElement | null>(null);
	const labelElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

	selectedIdRef.current = selectedId;

	function scheduleRender() {
		if (drawRequestRef.current) {
			return;
		}
		drawRequestRef.current = window.requestAnimationFrame(() => {
			drawRequestRef.current = 0;
			drawRef.current?.();
		});
	}

	function worldFromViewportPoint(screenX: number, screenY: number) {
		const transform = transformRef.current;
		return {
			x: (screenX - transform.x) / transform.scale,
			y: (screenY - transform.y) / transform.scale,
		};
	}

	function pickNode(screenX: number, screenY: number) {
		if (!canvasRef.current) {
			return undefined;
		}
		const transform = transformRef.current;
		const world = worldFromViewportPoint(screenX, screenY);
		let bestDistance = Infinity;
		let bestNode: SimNode | undefined;
		const radiusScale = Math.max(8, 16 / Math.max(transform.scale, 0.4));

		for (const node of nodesRef.current) {
			const dx = world.x - node.x;
			const dy = world.y - node.y;
			const dist = dx * dx + dy * dy;
			const touchRadius = (node.radius + radiusScale) / transform.scale;
			if (dist <= touchRadius * touchRadius && dist < bestDistance) {
				bestDistance = dist;
				bestNode = node;
			}
		}
		return bestNode;
	}

	useEffect(() => {
		const url = new URL(window.location.href);
		const requestedQid =
			normaliseQid(url.searchParams.get('q') ?? DEFAULT_QID) ||
			DEFAULT_QID;
		const requestedNodeLimit = normalizeMaxNodes(
			url.searchParams.get('max')
		);
		setInputValue(requestedQid);
		setSelectedNodeLimit(requestedNodeLimit);
		setRequestedNodeLimit(requestedNodeLimit);
		setRequestedQid(requestedQid);
		setSelectedId(requestedQid);
	}, []);

	useEffect(() => {
		if (!requestedQid) {
			return;
		}
		const controller = new AbortController();
		setGraph(createPlaceholderGraph(requestedQid));
		setError(null);
		setLoadingState({
			loaded: 0,
			loading: true,
			queued: 0,
			rateLimited: false,
			retryAt: null,
		});

		void buildGraph(
			requestedQid,
			requestedNodeLimit,
			controller.signal,
			setLoadingState,
			partialGraph => setGraph(partialGraph)
		)
			.then(result => {
				setGraph(result);
				setSelectedId(result.rootId);
			})
			.catch((caught: unknown) => {
				if (isAbortError(caught)) {
					return;
				}
				setError(
					caught instanceof Error
						? caught.message
						: 'Failed to load Wikidata graph.'
				);
				setLoadingState({
					loaded: 0,
					loading: false,
					queued: 0,
					rateLimited: false,
					retryAt: null,
				});
			});

		return () => controller.abort();
	}, [requestedQid, requestedNodeLimit]);

	useEffect(() => {
		if (!loadingState.rateLimited || !loadingState.retryAt) {
			return;
		}
		setClockNow(Date.now());
		const interval = window.setInterval(() => {
			setClockNow(Date.now());
		}, 250);
		return () => window.clearInterval(interval);
	}, [loadingState.rateLimited, loadingState.retryAt]);

	useEffect(() => {
		const updateFullscreenState = () => {
			setIsFullscreen(document.fullscreenElement === viewportRef.current);
		};
		updateFullscreenState();
		document.addEventListener('fullscreenchange', updateFullscreenState);
		return () =>
			document.removeEventListener(
				'fullscreenchange',
				updateFullscreenState
			);
	}, []);

	useEffect(() => {
		const labels = labelElementsRef.current;
		for (const el of labels.values()) {
			el.remove();
		}
		labels.clear();
	}, [graph]);

	useEffect(() => {
		if (!graph || !canvasRef.current || !viewportRef.current) {
			return;
		}
		const canvas = canvasRef.current;
		const viewport = viewportRef.current;
		const context = canvas.getContext('2d');
		if (!context) {
			return;
		}
		const orderedNodes = Object.values(graph.nodes).sort((a, b) =>
			a.id.localeCompare(b.id)
		);
		const existingNodePositions = new Map(
			nodesRef.current.map(node => [
				node.id,
				{
					x: node.x,
					y: node.y,
				},
			])
		);
		const viewportBounds = viewport.getBoundingClientRect();
		const boundsWidth = Math.max(1, viewportBounds.width);
		const boundsHeight = Math.max(1, viewportBounds.height);

		const initialNodes: SimNode[] = orderedNodes.map((node, index) => {
			const depth = depths.get(node.id) ?? 0;
			const step =
				orderedNodes.length <= 1 ? 1 : index / orderedNodes.length;
			const angle = step * Math.PI * 2 + depth * 0.18;
			const radius =
				Math.min(boundsWidth, boundsHeight) * 0.28 + (index % 7) * 12;
			const existingPosition = existingNodePositions.get(node.id);
			return {
				depth,
				fx: null,
				fy: null,
				highlightFlags: node.highlightFlags,
				id: node.id,
				imageUrl: node.imageUrl,
				label: node.label,
				rankIcon: node.rankIcon,
				rankLabel: node.rankLabel,
				branchLabel: node.branchLabel,
				radius:
					BASE_NODE_RADIUS +
					(node.id === graph.rootId
						? 2
						: Math.max(0, 3 - Math.abs(depth))),
				url: node.url,
				x:
					existingPosition?.x ??
					boundsWidth / 2 + Math.cos(angle) * radius,
				y:
					existingPosition?.y ??
					boundsHeight / 2 + Math.sin(angle) * radius + depth * 24,
			};
		});
		const nodeIds = new Set(initialNodes.map(node => node.id));
		const initialLinks: SimEdge[] = graph.edges
			.filter(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to))
			.map(edge => ({
				color: edge.color,
				relation: edge.relation,
				source: edge.from,
				target: edge.to,
			}));
		nodesRef.current = initialNodes;
		linksRef.current = initialLinks;

		setCanvasSize(canvas);
		canvasViewportRef.current = viewportBounds;
		if (existingNodePositions.size === 0) {
			transformRef.current = fitNodesToCanvas(
				initialNodes,
				boundsWidth,
				boundsHeight
			);
		}

		const simulation = d3
			.forceSimulation<SimNode>(initialNodes)
			.force(
				'link',
				d3
					.forceLink<SimNode, SimEdge>(initialLinks)
					.id((node: { id: string }) => node.id)
					.distance((link: { relation: RelationName }) =>
						link.relation === 'child' ? 170 : 156
					)
					.strength(0.78)
			)
			.force('charge', d3.forceManyBody().strength(-2200))
			.force('center', d3.forceCenter(boundsWidth / 2, boundsHeight / 2))
			.force(
				'collision',
				d3.forceCollide<SimNode>(node => node.radius + 7).strength(0.78)
			);
		simulationRef.current = simulation;

		const createLabelElement = () => {
			const el = document.createElement('div');
			el.className = 'nodeLabel';
			const portrait = document.createElement('span');
			portrait.className = 'nodeLabelPortrait';
			const portraitImg = document.createElement('img');
			portraitImg.className = 'nodeLabelPortraitImg';
			portraitImg.alt = '';
			portraitImg.draggable = false;
			portrait.appendChild(portraitImg);
			const icon = document.createElement('span');
			icon.className = 'nodeLabelIcon';
			const text = document.createElement('span');
			text.className = 'nodeLabelText';
			el.append(portrait, icon, text);
			return el;
		};

		const updateLabelLayer = (transform: ViewportTransform) => {
			const container = labelContainerRef.current;
			if (!container) {
				return;
			}
			const labels = labelElementsRef.current;
			const visibleIds = new Set<string>();
			for (const node of nodesRef.current) {
				const isSearchMatch = matchesSearchQuery(node, searchQuery);
				const showLabel =
					isSearchMatch ||
					transform.scale > DETAIL_LABEL_SCALE_THRESHOLD ||
					node.id === graph.rootId ||
					node.id === selectedIdRef.current;
				const existing = labels.get(node.id);
				if (!showLabel) {
					if (existing) {
						existing.style.display = 'none';
					}
					continue;
				}
				let el = existing;
				if (!el) {
					el = createLabelElement();
					labels.set(node.id, el);
					container.appendChild(el);
				}
				visibleIds.add(node.id);
				el.style.display = 'flex';
				el.classList.toggle(
					'isHighlighted',
					isNodeHighlighted(node, activeHighlight, searchQuery)
				);
				const portraitHolder = el.children[0] as HTMLSpanElement;
				const iconHolder = el.children[1] as HTMLSpanElement;
				const textSpan = el.children[2] as HTMLSpanElement;
				textSpan.textContent = node.label;
				iconHolder.textContent = '';
				iconHolder.style.display = 'none';
				portraitHolder.style.display = 'none';
				const portraitImg = portraitHolder.querySelector(
					'img'
				) as HTMLImageElement | null;
				if (portraitImg) {
					portraitImg.src = '';
				}
				const tooltipParts: string[] = [];
				if (node.branchLabel) {
					tooltipParts.push(node.branchLabel);
				}
				if (node.rankLabel) {
					tooltipParts.push(node.rankLabel);
				}
				const tooltip = tooltipParts.join(' — ');
				if (tooltip) {
					el.title = tooltip;
				} else {
					el.removeAttribute('title');
				}
				iconHolder.removeAttribute('title');
				const rankIcon = node.rankIcon;
				if (rankIcon?.type === 'emoji') {
					iconHolder.textContent = rankIcon.value;
					iconHolder.style.display = 'inline-flex';
					iconHolder.title = tooltip;
				} else if (rankIcon?.type === 'image') {
					let img = iconHolder.querySelector(
						'img'
					) as HTMLImageElement | null;
					if (!img) {
						img = document.createElement('img');
						img.className = 'nodeLabelIconImg';
						img.alt = '';
						img.draggable = false;
						iconHolder.appendChild(img);
					}
					img.crossOrigin = 'anonymous';
					img.src = rankIcon.src;
					iconHolder.style.display = 'inline-flex';
					iconHolder.title = tooltip;
				}
				if (node.imageUrl && portraitImg) {
					portraitImg.src = node.imageUrl;
					portraitHolder.style.display = 'inline-flex';
					portraitHolder.title = node.label;
				} else {
					portraitHolder.removeAttribute('title');
				}
				const screenX = transform.x + node.x * transform.scale;
				const screenY = transform.y + node.y * transform.scale;
				el.style.left = `${screenX}px`;
				el.style.top = `${screenY - node.radius * transform.scale - 4}px`;
			}
			for (const [id, el] of labels.entries()) {
				if (!visibleIds.has(id)) {
					el.style.display = 'none';
				}
			}
		};

		const draw = () => {
			if (!canvasRef.current || !viewportRef.current) {
				return;
			}
			const latestBounds = viewportRef.current.getBoundingClientRect();
			if (latestBounds.width === 0 || latestBounds.height === 0) {
				return;
			}
			if (
				!canvasViewportRef.current ||
				Math.abs(canvasViewportRef.current.width - latestBounds.width) >
					1 ||
				Math.abs(
					canvasViewportRef.current.height - latestBounds.height
				) > 1
			) {
				setCanvasSize(canvasRef.current);
				canvasViewportRef.current = latestBounds;
			}
			const dpr = window.devicePixelRatio || 1;
			const ctx = context;
			const transform = transformRef.current;
			const selected = selectedIdRef.current;

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, latestBounds.width, latestBounds.height);
			ctx.fillStyle = '#f3ead2';
			ctx.fillRect(0, 0, latestBounds.width, latestBounds.height);
			ctx.strokeStyle = 'rgba(95, 89, 74, 0.08)';
			for (let i = 0; i < latestBounds.width; i += 24) {
				ctx.beginPath();
				ctx.moveTo(i, 0);
				ctx.lineTo(i, latestBounds.height);
				ctx.stroke();
			}
			for (let i = 0; i < latestBounds.height; i += 24) {
				ctx.beginPath();
				ctx.moveTo(0, i);
				ctx.lineTo(latestBounds.width, i);
				ctx.stroke();
			}

			ctx.save();
			ctx.translate(transform.x, transform.y);
			ctx.scale(transform.scale, transform.scale);

			for (const edge of linksRef.current) {
				const source = edge.source as SimNode;
				const target = edge.target as SimNode;
				if (!Number.isFinite(source.x) || !Number.isFinite(target.x)) {
					continue;
				}
				const selectedEdge =
					source.id === selected || target.id === selected;
				const stroke = edge.color;
				const midX = (source.x + target.x) / 2;
				const midY = (source.y + target.y) / 2;
				const dx = target.x - source.x;
				const dy = target.y - source.y;
				const curveOffset = 0.06 * Math.sqrt(dx * dx + dy * dy);
				ctx.beginPath();
				ctx.moveTo(source.x, source.y);
				ctx.quadraticCurveTo(
					midX + dy / 20,
					midY + curveOffset,
					target.x,
					target.y
				);
				ctx.strokeStyle = stroke;
				ctx.globalAlpha = selectedEdge ? 0.82 : 0.35;
				ctx.lineWidth = selectedEdge
					? 2.2 / transform.scale
					: 1.1 / transform.scale;
				ctx.stroke();
				ctx.globalAlpha = 1;
			}

			for (const node of nodesRef.current) {
				const isSelected = node.id === selected;
				const isRoot = node.id === graph.rootId;
				const isHighlighted = isNodeHighlighted(
					node,
					activeHighlight,
					searchQuery
				);
				const radius = isRoot ? node.radius + 2 : node.radius;
				const fill = isSelected
					? '#2b2f4a'
					: isHighlighted
						? '#fff4c9'
						: '#fdfdf8';
				const stroke = isRoot
					? '#4d2be0'
					: isSelected
						? '#a47f1f'
						: isHighlighted
							? '#c28a19'
							: '#5f5844';

				ctx.beginPath();
				ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
				ctx.fillStyle = fill;
				ctx.fill();
				ctx.strokeStyle = stroke;
				ctx.lineWidth = (isHighlighted ? 2.6 : 1.8) / transform.scale;
				ctx.stroke();
			}

			updateLabelLayer(transform);

			ctx.restore();
			drawClusterFamilyLabels(
				ctx,
				nodesRef.current,
				transform,
				latestBounds.width,
				latestBounds.height
			);
		};
		drawRef.current = draw;

		const onTick = () => {
			scheduleRender();
		};
		simulation.on('tick', onTick);
		simulation.on('end', onTick);
		simulation.alpha(1).restart();
		scheduleRender();

		const observer = new ResizeObserver(() => {
			const newBounds = viewport.getBoundingClientRect();
			if (!newBounds.width || !newBounds.height) {
				return;
			}
			setCanvasSize(canvas);
			canvasViewportRef.current = newBounds;
			simulation.force(
				'center',
				d3.forceCenter(newBounds.width / 2, newBounds.height / 2)
			);
			simulation.force(
				'x',
				d3.forceX(newBounds.width / 2).strength(0.02)
			);
			simulation.force(
				'y',
				d3.forceY(newBounds.height / 2).strength(0.02)
			);
			simulation.alpha(0.4).restart();
			scheduleRender();
		});
		observer.observe(viewport);
		resizeObserverRef.current = observer;

		return () => {
			observer.disconnect();
			resizeObserverRef.current = null;
			simulation.on('tick', null);
			simulation.on('end', null);
			simulation.stop();
			drawRef.current = null;
			if (drawRequestRef.current) {
				cancelAnimationFrame(drawRequestRef.current);
				drawRequestRef.current = 0;
			}
		};
	}, [activeHighlight, depths, graph, searchQuery]);

	useEffect(() => {
		scheduleRender();
	}, [selectedId]);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const qid = normaliseQid(inputValue);
		if (!/^Q\d+$/.test(qid)) {
			setError('Enter a Wikidata item id such as Q42.');
			return;
		}

		setError(null);
		const url = new URL(window.location.href);
		url.searchParams.set('q', qid);
		url.searchParams.set('max', String(selectedNodeLimit));
		window.history.replaceState({}, '', url);
		setRequestedQid(qid);
		setRequestedNodeLimit(selectedNodeLimit);
	}

	function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
		if (event.button !== 0 && event.button !== -1) {
			return;
		}
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		event.preventDefault();
		const rect = viewport.getBoundingClientRect();
		const node = pickNode(
			event.clientX - rect.left,
			event.clientY - rect.top
		);
		const nextDragState: DragState = {
			mode: node ? 'node' : 'pan',
			moved: false,
			node,
			pointerId: event.pointerId,
			panX: transformRef.current.x,
			panY: transformRef.current.y,
			startX: event.clientX,
			startY: event.clientY,
		};
		dragStateRef.current = nextDragState;
		if (nextDragState.node) {
			nextDragState.node.fx = nextDragState.node.x;
			nextDragState.node.fy = nextDragState.node.y;
			const simulation = simulationRef.current as {
				alphaTarget: (target: number) => unknown;
				restart: () => unknown;
			} | null;
			simulation?.alphaTarget(0.35);
			simulation?.restart();
		}
		viewport.setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
		const viewport = viewportRef.current;
		const dragState = dragStateRef.current;
		if (
			!viewport ||
			!dragState ||
			dragState.pointerId !== event.pointerId ||
			(!dragState.node && dragState.mode !== 'pan')
		) {
			return;
		}
		const rect = viewport.getBoundingClientRect();
		const world = worldFromViewportPoint(
			event.clientX - rect.left,
			event.clientY - rect.top
		);
		dragState.moved =
			dragState.moved ||
			Math.hypot(
				event.clientX - dragState.startX,
				event.clientY - dragState.startY
			) > 2;
		if (dragState.mode === 'pan') {
			transformRef.current = {
				...transformRef.current,
				x: dragState.panX + (event.clientX - dragState.startX),
				y: dragState.panY + (event.clientY - dragState.startY),
			};
		} else if (dragState.node) {
			dragState.node.fx = world.x;
			dragState.node.fy = world.y;
			if (!simulationRef.current) {
				dragState.node.x = world.x;
				dragState.node.y = world.y;
			}
		}
		scheduleRender();
	}

	function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
		const viewport = viewportRef.current;
		const dragState = dragStateRef.current;
		if (
			!viewport ||
			!dragState ||
			dragState.pointerId !== event.pointerId
		) {
			return;
		}
		viewport.releasePointerCapture(event.pointerId);
		if (dragState.mode === 'node' && dragState.node) {
			dragState.node.fx = null;
			dragState.node.fy = null;
			const simulation = simulationRef.current as {
				alphaTarget: (target: number) => unknown;
			} | null;
			simulation?.alphaTarget(0);
			if (!dragState.moved) {
				setSelectedId(dragState.node.id);
			}
		}
		dragStateRef.current = null;
		scheduleRender();
	}

	function handleWheel(event: WheelEvent<HTMLDivElement>) {
		event.preventDefault();
		event.stopPropagation();
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}
		const rect = viewport.getBoundingClientRect();
		const pointerX = event.clientX - rect.left;
		const pointerY = event.clientY - rect.top;
		const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
		const nextScale = clamp(
			transformRef.current.scale * zoomFactor,
			minZoomScaleForChart(nodesRef.current, rect.width, rect.height),
			MAX_SCALE
		);
		const world = worldFromViewportPoint(pointerX, pointerY);
		transformRef.current = {
			scale: nextScale,
			x: pointerX - world.x * nextScale,
			y: pointerY - world.y * nextScale,
		};
		scheduleRender();
	}

	async function handleToggleFullscreen() {
		const viewport = viewportRef.current;
		if (!viewport || !document.fullscreenEnabled) {
			return;
		}
		try {
			if (document.fullscreenElement === viewport) {
				await document.exitFullscreen();
				return;
			}
			await viewport.requestFullscreen();
		} catch {
			// Ignore rejected fullscreen requests.
		}
	}

	const selectedNode =
		selectedId && graph ? graph.nodes[selectedId] : undefined;
	const activeFilterMeta =
		HIGHLIGHT_FILTERS.find(filter => filter.id === activeHighlight) ??
		HIGHLIGHT_FILTERS[0]!;
	const normalizedSearchQuery = normaliseSearchQuery(searchQuery);

	return (
		<>
			<div className="page">
				<div className="chrome">
					<div className="brand">luke.shadwell.im</div>
					<div className="tool">WikiTree</div>
				</div>

				<main className="container">
					<section className="hero">
						<p className="eyebrow">GeneaWiki recreation</p>
						<h1>Wikidata family tree explorer</h1>
						<p className="lede">
							This is a React rewrite of the old Magnus Manske
							GeneaWiki page. Enter a Wikidata item id and it will
							pull parents and children into a browsable tree.
						</p>
					</section>

					<section className="panel">
						<form className="controls" onSubmit={handleSubmit}>
							<label className="inputGroup">
								<span>Wikidata item</span>
								<input
									onChange={event =>
										setInputValue(event.target.value)
									}
									placeholder="Q42"
									type="text"
									value={inputValue}
								/>
							</label>
							<label className="inputGroup">
								<span>Maximum people</span>
								<select
									onChange={event =>
										setSelectedNodeLimit(
											Number(event.target.value)
										)
									}
									value={selectedNodeLimit}
								>
									{NODE_LIMIT_OPTIONS.map(limit => (
										<option key={limit} value={limit}>
											Up to {limit}
										</option>
									))}
								</select>
							</label>
							<button type="submit">Load tree</button>
							<Link
								className="permalink"
								href={`?q=${encodeURIComponent(normaliseQid(inputValue) || DEFAULT_QID)}&max=${selectedNodeLimit}`}
							>
								Permalink
							</Link>
						</form>

						<div className="statusRow">
							{loadingState.loading ? (
								<p>
									{loadingState.loaded}/{requestedNodeLimit}{' '}
									people loaded.{' '}
									{loadingState.queued > 0
										? `${loadingState.queued} still loading.`
										: 'Loading...'}{' '}
									{loadingState.rateLimited
										? retryCountdownText
										: ''}
								</p>
							) : (
								<p>
									{Object.keys(graph?.nodes ?? {}).length}/
									{requestedNodeLimit} people loaded.
									{graph?.excessiveNodes
										? ' Maximum node limit reached; graph is incomplete.'
										: ''}
								</p>
							)}
							{error ? <p className="error">{error}</p> : null}
						</div>
					</section>

					<section className="panel graphPanel">
						<div className="graphHeader">
							<div>
								<h2>Graph</h2>
								<p>
									Drag to pan, wheel to zoom, drag nodes to
									reorganize.
								</p>
							</div>
							<div className="graphActions">
								{graph ? (
									<button
										className="secondary"
										onClick={() =>
											void handleToggleFullscreen()
										}
										type="button"
									>
										{isFullscreen
											? 'Exit fullscreen'
											: 'Fullscreen'}
									</button>
								) : null}
								{selectedNode ? (
									<Link
										href={selectedNode.url}
										rel="noreferrer"
										target="_blank"
									>
										Open {selectedNode.id}
									</Link>
								) : null}
								{graph?.excessiveNodes && selectedNode ? (
									<button
										className="secondary"
										onClick={() => {
											setInputValue(selectedNode.id);
											const url = new URL(
												window.location.href
											);
											url.searchParams.set(
												'q',
												selectedNode.id
											);
											url.searchParams.set(
												'max',
												String(requestedNodeLimit)
											);
											window.history.replaceState(
												{},
												'',
												url
											);
											setRequestedQid(selectedNode.id);
											setRequestedNodeLimit(
												requestedNodeLimit
											);
										}}
										type="button"
									>
										Recenter on {selectedNode.id}
									</button>
								) : null}
							</div>
						</div>
						<div className="filterPanel">
							<div>
								<h3>Highlight</h3>
								<p>{activeFilterMeta.description}</p>
								<div className="filterSearchGroup">
									<label
										className="filterSearchLabel"
										htmlFor="wikitree-highlight-search"
									>
										Search highlight
									</label>
									<input
										className="filterSearchInput"
										id="wikitree-highlight-search"
										onChange={event =>
											setSearchQuery(event.target.value)
										}
										placeholder="Search people by name or QID"
										type="search"
										value={searchQuery}
									/>
									<p>
										{normalizedSearchQuery
											? `${searchMatchCount} search matches highlighted.`
											: 'Type a name to highlight matching people.'}
									</p>
								</div>
							</div>
							<div
								aria-label="Highlight filters"
								className="filterBar"
								role="toolbar"
							>
								{HIGHLIGHT_FILTERS.map(filter => (
									<button
										className={
											filter.id === activeHighlight
												? 'filterChip active'
												: 'filterChip'
										}
										key={filter.id}
										onClick={() =>
											setActiveHighlight(filter.id)
										}
										type="button"
									>
										{filter.label}
										{filter.id !== 'none'
											? ` (${highlightCounts.get(filter.id) ?? 0})`
											: ''}
									</button>
								))}
							</div>
						</div>
						{!graph ? (
							<div className="empty">Loading graph…</div>
						) : (
							<div
								className="chartViewport"
								onPointerCancel={handlePointerEnd}
								onPointerDownCapture={handlePointerDown}
								onPointerLeave={handlePointerEnd}
								onPointerMove={handlePointerMove}
								onPointerUp={handlePointerEnd}
								onWheelCapture={handleWheel}
								ref={viewportRef}
							>
								<canvas
									aria-label="Wikidata family graph"
									className="chartCanvas"
									ref={canvasRef}
								/>
								<div
									aria-hidden="true"
									className="labelLayer"
									ref={labelContainerRef}
								/>
								{Object.keys(graph.nodes).length === 0 ? (
									<div className="chartOverlay">
										Loading graph…
									</div>
								) : null}
								<div className="chartLegend">
									<span>
										<i className="legendSwatch father" />{' '}
										father
									</span>
									<span>
										<i className="legendSwatch mother" />{' '}
										mother
									</span>
									<span>
										<i className="legendSwatch child" />{' '}
										child
									</span>
									<span className="legendRank">
										{FALLBACK_RANK_ICON} Rank
									</span>
								</div>
							</div>
						)}
					</section>
				</main>
			</div>

			<style>{`
				body {
					margin: 0;
					font-family: Georgia, 'Times New Roman', serif;
					background:
						radial-gradient(circle at top, rgba(93, 132, 196, 0.18), transparent 32rem),
						linear-gradient(180deg, #f4efe2 0%, #efe4cc 100%);
					color: #1f2430;
				}

				* {
					box-sizing: border-box;
				}

				a {
					color: #264f8f;
				}

				.page {
					min-height: 100vh;
				}

				.chrome {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 1rem 1.5rem;
					background: linear-gradient(180deg, #3c3328 0%, #2b241c 100%);
					color: #f7f0df;
					border-bottom: 3px solid #a38446;
				}

				.brand,
				.tool {
					font-size: 0.875rem;
					letter-spacing: 0.12em;
					text-transform: uppercase;
				}

				.container {
					max-width: 1280px;
					margin: 0 auto;
					padding: 1.5rem;
				}

				.hero {
					margin-bottom: 1.5rem;
				}

				.eyebrow {
					margin: 0 0 0.5rem;
					font-size: 0.8rem;
					letter-spacing: 0.14em;
					text-transform: uppercase;
					color: #69552b;
				}

				h1,
				h2,
				h3,
				p {
					margin-top: 0;
				}

				h1 {
					margin-bottom: 0.75rem;
					font-size: clamp(2rem, 4vw, 3.5rem);
					line-height: 0.95;
				}

				.lede {
					max-width: 48rem;
					font-size: 1.05rem;
					line-height: 1.6;
				}

				.panel {
					background: rgba(255, 251, 242, 0.88);
					border: 1px solid rgba(90, 73, 38, 0.24);
					box-shadow: 0 18px 40px rgba(55, 42, 21, 0.08);
					border-radius: 18px;
					padding: 1rem;
				}

				.controls {
					display: flex;
					flex-wrap: wrap;
					gap: 0.75rem;
					align-items: end;
				}

				.inputGroup {
					display: grid;
					gap: 0.3rem;
					min-width: min(100%, 18rem);
					font-size: 0.95rem;
				}

				input,
				select {
					padding: 0.85rem 0.95rem;
					border-radius: 12px;
					border: 1px solid #b9ab87;
					background: #fffdfa;
					font: inherit;
				}

				select {
					appearance: none;
					background-image: linear-gradient(45deg, transparent 50%, #5f4f34 50%),
						linear-gradient(135deg, #5f4f34 50%, transparent 50%),
						linear-gradient(to right, transparent, transparent);
					background-position:
						calc(100% - 16px) calc(1.1em),
						calc(100% - 10px) calc(1.1em),
						100% 0;
					background-size: 6px 6px, 6px 6px, 2.4em 2.4em;
					background-repeat: no-repeat;
					padding-right: 2.25rem;
				}

				button,
				.permalink {
					padding: 0.85rem 1rem;
					border-radius: 12px;
					border: 1px solid #7e6640;
					background: linear-gradient(180deg, #7d6237 0%, #634d2d 100%);
					color: #fffaf0;
					font: inherit;
					text-decoration: none;
					cursor: pointer;
					transition:
						transform 120ms ease,
						box-shadow 120ms ease;
					box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
				}

				button:hover,
				.permalink:hover {
					transform: translateY(-1px);
				}

				.permalink {
					background: #f6f0e1;
					color: #5c4725;
				}

				.secondary {
					width: auto;
					margin-bottom: 0;
					background: #efe2c4;
					color: #463517;
				}

				.statusRow {
					margin-top: 0.8rem;
					font-size: 0.95rem;
				}

				.error {
					color: #a01313;
				}

				.graphHeader {
					display: flex;
					justify-content: space-between;
					align-items: center;
					gap: 1rem;
					margin-bottom: 1rem;
				}

				.graphActions {
					display: flex;
					flex-wrap: wrap;
					gap: 0.75rem;
					align-items: center;
					justify-content: flex-end;
				}

				.graphPanel {
					margin-top: 1rem;
					padding-bottom: 0.5rem;
				}

				.filterPanel {
					display: flex;
					flex-wrap: wrap;
					justify-content: space-between;
					gap: 0.9rem;
					margin-bottom: 1rem;
					padding: 0.9rem 1rem;
					border-radius: 16px;
					background: linear-gradient(180deg, rgba(248, 239, 219, 0.9), rgba(244, 231, 201, 0.82));
					border: 1px solid rgba(137, 108, 45, 0.2);
				}

				.filterPanel h3 {
					margin-bottom: 0.2rem;
					font-size: 1rem;
				}

				.filterPanel p {
					margin-bottom: 0;
					color: #665638;
					font-size: 0.92rem;
				}

				.filterSearchGroup {
					display: grid;
					gap: 0.45rem;
					margin-top: 0.85rem;
					max-width: min(100%, 24rem);
				}

				.filterSearchLabel {
					font-size: 0.85rem;
					font-weight: 600;
					color: #4d3a18;
				}

				.filterSearchInput {
					width: 100%;
				}

				.filterBar {
					display: flex;
					flex-wrap: wrap;
					gap: 0.55rem;
					align-items: center;
					justify-content: flex-end;
				}

				.filterChip {
					padding: 0.65rem 0.85rem;
					border-radius: 999px;
					border: 1px solid rgba(114, 89, 45, 0.28);
					background: rgba(255, 253, 248, 0.9);
					color: #3f3017;
					box-shadow: none;
				}

				.filterChip.active {
					background: linear-gradient(180deg, #87662f 0%, #6f5226 100%);
					color: #fff8ea;
					border-color: #6c4f1e;
					box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
				}

				.chartViewport {
					overflow: hidden;
					position: relative;
					height: min(84vh, 60rem);
					border-radius: 16px;
					overscroll-behavior: contain;
					cursor: grab;
					background:
						linear-gradient(90deg, rgba(122, 102, 60, 0.08) 1px, transparent 1px) 0 0 / 24px 24px,
						linear-gradient(rgba(122, 102, 60, 0.08) 1px, transparent 1px) 0 0 / 24px 24px,
						linear-gradient(180deg, #faf5e8 0%, #f2e8d1 100%);
					border: 1px solid rgba(126, 102, 64, 0.28);
					touch-action: none;
					user-select: none;
				}

				.chartViewport:fullscreen {
					width: 100vw;
					height: 100vh;
					border-radius: 0;
					border: 0;
				}

				.chartViewport:active {
					cursor: grabbing;
				}

				.labelLayer {
					position: absolute;
					inset: 0;
					pointer-events: none;
				}

				.chartOverlay {
					position: absolute;
					inset: 0;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 1rem;
					color: #6f644b;
					pointer-events: none;
					background: linear-gradient(180deg, rgba(250, 245, 232, 0.55), rgba(242, 232, 209, 0.18));
				}

				.nodeLabel {
					position: absolute;
					display: inline-flex;
					align-items: center;
					gap: 0.4rem;
					padding: 0.35rem 0.55rem;
					border-radius: 999px;
					background: rgba(255, 255, 255, 0.88);
					border: 1px solid rgba(76, 62, 38, 0.32);
					font-size: 0.85rem;
					line-height: 1.2;
					color: #2f2b22;
					white-space: nowrap;
					pointer-events: auto;
					transform: translate(-50%, -100%);
					box-shadow: 0 4px 12px rgba(20, 18, 15, 0.15);
				}

				.nodeLabel.isHighlighted {
					background: rgba(255, 245, 207, 0.95);
					border-color: rgba(194, 138, 25, 0.5);
					box-shadow: 0 8px 18px rgba(142, 98, 17, 0.18);
				}

				.nodeLabelPortrait {
					width: 28px;
					height: 28px;
					border-radius: 50%;
					overflow: hidden;
					display: none;
					align-items: center;
					justify-content: center;
					background: #f4ede0;
				}

				.nodeLabelPortraitImg {
					width: 100%;
					height: 100%;
					object-fit: cover;
				}

				.nodeLabelIcon {
					display: inline-flex;
				}

				.nodeLabelIconImg {
					width: 16px;
					height: 16px;
					object-fit: contain;
					display: block;
				}

				.chartLegend {
					position: sticky;
					top: 0.75rem;
					left: 0.75rem;
					z-index: 3;
					display: inline-flex;
					gap: 0.75rem;
					margin: 0.75rem;
					padding: 0.45rem 0.65rem;
					border-radius: 999px;
					background: rgba(255, 250, 241, 0.9);
					border: 1px solid rgba(126, 102, 64, 0.18);
					backdrop-filter: blur(8px);
					font-size: 0.8rem;
				}

				.chartLegend span {
					display: inline-flex;
					align-items: center;
					gap: 0.35rem;
				}

				.legendRank {
					padding-left: 0.2rem;
				}

				.legendSwatch {
					display: inline-block;
					width: 0.7rem;
					height: 0.7rem;
					border-radius: 999px;
				}

				.legendSwatch.father {
					background: #3923d6;
				}

				.legendSwatch.mother {
					background: #ff4848;
				}

				.legendSwatch.child {
					background: #7a7a7a;
				}

				.chartCanvas {
					display: block;
					width: 100%;
					height: 100%;
					border-bottom-left-radius: 16px;
					border-bottom-right-radius: 16px;
				}

				.empty {
					padding: 3rem 1rem;
					text-align: center;
					color: #6f644b;
				}

				@media (max-width: 900px) {
					.graphHeader {
						display: block;
					}

					.filterPanel {
						display: block;
					}

					.filterBar {
						margin-top: 0.75rem;
						justify-content: flex-start;
					}

					.chartViewport {
						height: min(72vh, 42rem);
					}
				}
			`}</style>
		</>
	);
}
