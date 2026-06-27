import { writeFileSync } from 'node:fs';

import { BENCHMARK_ID } from './data.js';
import {
	type AnswerRecord,
	type CandidatePromptRecord,
	CRITERIA,
	candidatePromptRecords,
	type JudgePromptRecord,
	type JudgeScoreRecord,
} from './index.js';

export const DEFAULT_REASONING_EFFORTS = [
	'none',
	'minimal',
	'low',
	'medium',
	'high',
	'xhigh',
] as const;

export const DEFAULT_OPENAI_CONCURRENCY = 4;
export const DEFAULT_OPENAI_TIMEOUT_MS = 900_000;
export const DEFAULT_OPENAI_JUDGE_MODEL = 'gpt-5.5';
export const DEFAULT_OPENAI_JUDGE_EFFORT = 'medium' satisfies ReasoningEffort;
export const TRANSIENT_OPENAI_ERROR_MATCHERS = [
	'insufficient_quota',
	'rate_limit_exceeded',
	'fetch failed',
	'OpenAI request timed out',
	"Unexpected token '<'",
] as const;

export type ReasoningEffort = (typeof DEFAULT_REASONING_EFFORTS)[number];

export type FetchLike = (
	input: string | URL,
	init?: RequestInit
) => Promise<Response>;

export type OpenAIModel = {
	created?: number;
	id: string;
	object?: string;
	owned_by?: string;
};

export type OpenAIClientOptions = {
	apiKey: string;
	baseUrl?: string;
	fetch?: FetchLike;
	timeoutMs?: number;
};

export type OpenAICombination = {
	model: string;
	prompt: string;
	question_id: string;
	reasoning_effort: ReasoningEffort;
	title: string;
};

export type OpenAIAnswerResult = AnswerRecord & {
	benchmark_id: string;
	duration_ms: number;
	ok: true;
	reasoning_effort: ReasoningEffort;
	response_id?: string;
	status?: string;
	title: string;
	usage?: unknown;
};

export type OpenAIErrorResult = {
	benchmark_id: string;
	duration_ms: number;
	error: {
		code?: string;
		message: string;
		param?: string;
		status?: number;
		type?: string;
	};
	model: string;
	ok: false;
	question_id: string;
	reasoning_effort: ReasoningEffort;
	title: string;
};

export type OpenAIResult = OpenAIAnswerResult | OpenAIErrorResult;

export type OpenAIResultWithMetadata = OpenAIResult & {
	planned_count: number;
	run_index: number;
};

export type OpenAIRunProgress = {
	combination: OpenAICombination;
	planned_count: number;
	run_index: number;
};

export type OpenAIJudgeOptions = {
	judgeEffort: ReasoningEffort;
	judgeModel: string;
};

export type OpenAIJudgeScoreResult = JudgeScoreRecord & {
	benchmark_id: string;
	duration_ms: number;
	judge_model: string;
	judge_reasoning_effort: ReasoningEffort;
	ok: true;
	raw_judge_response: string;
	response_id?: string;
	status?: string;
	usage?: unknown;
};

export type OpenAIJudgeErrorResult = {
	benchmark_id: string;
	control?: boolean;
	duration_ms: number;
	error: OpenAIErrorResult['error'];
	judge_model: string;
	judge_reasoning_effort: ReasoningEffort;
	model?: string;
	ok: false;
	question_id: string;
	raw_judge_response?: string;
	reasoning_effort?: string;
	response_id?: string;
	status?: string;
	usage?: unknown;
};

export type OpenAIJudgeResult = OpenAIJudgeScoreResult | OpenAIJudgeErrorResult;

export type OpenAIJudgeResultWithMetadata = OpenAIJudgeResult & {
	planned_count: number;
	run_index: number;
};

export type OpenAIJudgeRunProgress = {
	judgeEffort: ReasoningEffort;
	judgeModel: string;
	planned_count: number;
	prompt: JudgePromptRecord;
	run_index: number;
};

type OpenAIListModelsResponse = {
	data?: OpenAIModel[];
};

type OpenAIResponseBody = {
	id?: string;
	output?: unknown;
	output_text?: string;
	status?: string;
	usage?: unknown;
};

type OpenAIErrorBody = {
	error?: {
		code?: string;
		message?: string;
		param?: string;
		type?: string;
	};
};

export class OpenAIAPIError extends Error {
	readonly code?: string;
	readonly param?: string;
	readonly status?: number;
	readonly type?: string;

	constructor(
		message: string,
		options: {
			code?: string;
			param?: string;
			status?: number;
			type?: string;
		} = {}
	) {
		super(message);
		this.name = 'OpenAIAPIError';
		this.code = options.code;
		this.param = options.param;
		this.status = options.status;
		this.type = options.type;
	}
}

export class OpenAIClient {
	private readonly apiKey: string;
	private readonly baseUrl: string;
	private readonly fetchFn: FetchLike;
	private readonly timeoutMs: number;

	constructor(options: OpenAIClientOptions) {
		this.apiKey = options.apiKey;
		this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
		this.fetchFn = options.fetch ?? fetch;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_OPENAI_TIMEOUT_MS;
	}

	async listModels(): Promise<OpenAIModel[]> {
		const response = await this.request<OpenAIListModelsResponse>('/models');
		return [...(response.data ?? [])].sort((a, b) => a.id.localeCompare(b.id));
	}

	async createResponse(combination: OpenAICombination): Promise<OpenAIResponseBody> {
		const body: Record<string, unknown> = {
			input: combination.prompt,
			model: combination.model,
			store: false,
		};
		if (combination.reasoning_effort !== 'none') {
			body.reasoning = {
				effort: combination.reasoning_effort,
			};
		}

		return this.request<OpenAIResponseBody>('/responses', {
			body: JSON.stringify(body),
			method: 'POST',
		});
	}

	private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const controller = new AbortController();
		const timeout =
			this.timeoutMs > 0
				? setTimeout(() => {
						controller.abort(
							new Error(`OpenAI request timed out after ${this.timeoutMs}ms`)
						);
					}, this.timeoutMs)
				: undefined;
		let response: Response;
		try {
			response = await this.fetchFn(`${this.baseUrl}${path}`, {
				...init,
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json',
					...init.headers,
				},
				signal: init.signal ?? controller.signal,
			});
		} finally {
			if (timeout !== undefined) clearTimeout(timeout);
		}
		const text = await response.text();
		const json =
			text.length > 0
				? (JSON.parse(text) as OpenAIErrorBody & T)
				: ({} as OpenAIErrorBody & T);

		if (!response.ok) {
			throw new OpenAIAPIError(
				json.error?.message ?? `OpenAI API returned HTTP ${response.status}`,
				{
					code: json.error?.code,
					param: json.error?.param,
					status: response.status,
					type: json.error?.type,
				}
			);
		}

		return json as T;
	}
}

export function modelIds(models: readonly OpenAIModel[]): string[] {
	return models.map(model => model.id);
}

export function parseReasoningEfforts(raw?: string): ReasoningEffort[] {
	if (raw === undefined || raw === '' || raw === 'all') {
		return [...DEFAULT_REASONING_EFFORTS];
	}

	const allowed = new Set<string>(DEFAULT_REASONING_EFFORTS);
	return raw.split(',').map(value => {
		const effort = value.trim();
		if (!allowed.has(effort)) {
			throw new Error(
				`Unknown reasoning effort ${JSON.stringify(
					effort
				)}. Use one of: ${DEFAULT_REASONING_EFFORTS.join(', ')}`
			);
		}
		return effort as ReasoningEffort;
	});
}

export function buildOpenAICombinations(options: {
	efforts: readonly ReasoningEffort[];
	models: readonly string[];
	prompts?: readonly CandidatePromptRecord[];
	questionIds?: readonly string[];
}): OpenAICombination[] {
	const selectedQuestionIds =
		options.questionIds === undefined ? undefined : new Set(options.questionIds);
	const prompts = (options.prompts ?? candidatePromptRecords()).filter(
		prompt => selectedQuestionIds === undefined || selectedQuestionIds.has(prompt.id)
	);

	return options.models.flatMap(model =>
		options.efforts.flatMap(reasoning_effort =>
			prompts.map(prompt => ({
				model,
				prompt: prompt.prompt,
				question_id: prompt.id,
				reasoning_effort,
				title: prompt.title,
			}))
		)
	);
}

export function openAICombinationKey(
	combination: Pick<OpenAICombination, 'model' | 'question_id' | 'reasoning_effort'>
): string {
	return JSON.stringify([
		combination.model,
		combination.reasoning_effort,
		combination.question_id,
	]);
}

export function openAIResultKey(record: unknown): string | undefined {
	if (!isRecord(record)) return undefined;
	if (
		typeof record.model !== 'string' ||
		typeof record.question_id !== 'string' ||
		typeof record.reasoning_effort !== 'string'
	) {
		return undefined;
	}

	return openAICombinationKey({
		model: record.model,
		question_id: record.question_id,
		reasoning_effort: record.reasoning_effort as ReasoningEffort,
	});
}

export function filterExistingOpenAICombinations(
	combinations: readonly OpenAICombination[],
	existingRecords: readonly unknown[]
): OpenAICombination[] {
	const existing = new Set(
		existingRecords
			.map(record => openAIResultKey(record))
			.filter((key): key is string => key !== undefined)
	);

	return combinations.filter(
		combination => !existing.has(openAICombinationKey(combination))
	);
}

export function openAIResultErrorLabels(record: unknown): string[] {
	if (!isRecord(record) || record.ok !== false || !isRecord(record.error)) {
		return [];
	}
	const error = record.error;

	return ['code', 'type', 'message', 'param', 'status']
		.map(key => error[key])
		.filter(
			(value): value is string | number =>
				typeof value === 'string' || typeof value === 'number'
		)
		.map(value => String(value));
}

export function filterRetryableOpenAIRecords(
	records: readonly unknown[],
	matchers: readonly string[]
): unknown[] {
	if (matchers.length === 0) return [...records];
	const normalizedMatchers = matchers.map(matcher => matcher.toLowerCase());

	return records.filter(record => {
		const labels = openAIResultErrorLabels(record).map(label => label.toLowerCase());
		return !labels.some(label =>
			normalizedMatchers.some(matcher => label.includes(matcher))
		);
	});
}

export function openAIJudgeKey(
	record: Pick<JudgePromptRecord, 'model' | 'question_id' | 'reasoning_effort'> &
		Partial<OpenAIJudgeOptions>
): string {
	return JSON.stringify([
		record.model ?? '',
		record.reasoning_effort ?? '',
		record.question_id,
		record.judgeModel ?? '',
		record.judgeEffort ?? '',
	]);
}

export function openAIJudgeResultKey(record: unknown): string | undefined {
	if (!isRecord(record) || typeof record.question_id !== 'string') return undefined;
	return openAIJudgeKey({
		judgeEffort:
			typeof record.judge_reasoning_effort === 'string'
				? (record.judge_reasoning_effort as ReasoningEffort)
				: undefined,
		judgeModel:
			typeof record.judge_model === 'string' ? record.judge_model : undefined,
		model: typeof record.model === 'string' ? record.model : undefined,
		question_id: record.question_id,
		reasoning_effort:
			typeof record.reasoning_effort === 'string'
				? record.reasoning_effort
				: undefined,
	});
}

export function filterExistingOpenAIJudgePrompts(
	prompts: readonly JudgePromptRecord[],
	existingRecords: readonly unknown[],
	options: OpenAIJudgeOptions
): JudgePromptRecord[] {
	const existing = new Set(
		existingRecords
			.map(record => openAIJudgeResultKey(record))
			.filter((key): key is string => key !== undefined)
	);

	return prompts.filter(
		prompt =>
			!existing.has(
				openAIJudgeKey({
					...prompt,
					judgeEffort: options.judgeEffort,
					judgeModel: options.judgeModel,
				})
			)
	);
}

export function extractOpenAIOutputText(response: OpenAIResponseBody): string {
	if (typeof response.output_text === 'string') {
		return response.output_text;
	}

	const parts: string[] = [];
	if (Array.isArray(response.output)) {
		for (const item of response.output) {
			if (!isRecord(item) || !Array.isArray(item.content)) continue;
			for (const content of item.content) {
				if (!isRecord(content)) continue;
				if (typeof content.text === 'string') parts.push(content.text);
				if (typeof content.refusal === 'string') parts.push(content.refusal);
			}
		}
	}

	return parts.join('\n');
}

export async function runOpenAICombination(
	client: OpenAIClient,
	combination: OpenAICombination
): Promise<OpenAIResult> {
	const start = performance.now();
	try {
		const response = await client.createResponse(combination);
		return {
			answer: extractOpenAIOutputText(response),
			benchmark_id: BENCHMARK_ID,
			duration_ms: performance.now() - start,
			model: combination.model,
			ok: true,
			question_id: combination.question_id,
			reasoning_effort: combination.reasoning_effort,
			response_id: response.id,
			status: response.status,
			title: combination.title,
			usage: response.usage,
		};
	} catch (error) {
		return {
			benchmark_id: BENCHMARK_ID,
			duration_ms: performance.now() - start,
			error: errorToRecord(error),
			model: combination.model,
			ok: false,
			question_id: combination.question_id,
			reasoning_effort: combination.reasoning_effort,
			title: combination.title,
		};
	}
}

export function parseJudgeScoreText(text: string): JudgeScoreRecord {
	const parsed = JSON.parse(extractJsonObjectText(text)) as unknown;
	if (!isRecord(parsed)) {
		throw new Error('Judge response was not a JSON object');
	}
	if (typeof parsed.question_id !== 'string') {
		throw new Error('Judge response is missing question_id');
	}
	if (!isRecord(parsed.scores)) {
		throw new Error('Judge response is missing scores');
	}
	const parsedScores = parsed.scores;

	const scores = Object.fromEntries(
		CRITERIA.map(criterion => {
			const score = parsedScores[criterion.id];
			if (
				typeof score !== 'number' ||
				!Number.isFinite(score) ||
				score < 0 ||
				score > 5
			) {
				throw new Error(`Judge score ${criterion.id} must be a number from 0 to 5`);
			}
			return [criterion.id, score];
		})
	) as JudgeScoreRecord['scores'];

	return {
		control: typeof parsed.control === 'boolean' ? parsed.control : undefined,
		model: typeof parsed.model === 'string' ? parsed.model : undefined,
		notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
		question_id: parsed.question_id,
		reasoning_effort:
			typeof parsed.reasoning_effort === 'string'
				? parsed.reasoning_effort
				: undefined,
		scores,
	};
}

export async function runOpenAIJudgePrompt(
	client: OpenAIClient,
	prompt: JudgePromptRecord,
	options: OpenAIJudgeOptions
): Promise<OpenAIJudgeResult> {
	const start = performance.now();
	let rawJudgeResponse: string | undefined;
	let response: OpenAIResponseBody | undefined;
	try {
		response = await client.createResponse({
			model: options.judgeModel,
			prompt: prompt.prompt,
			question_id: prompt.question_id,
			reasoning_effort: options.judgeEffort,
			title: prompt.question_id,
		});
		rawJudgeResponse = extractOpenAIOutputText(response);
		const score = parseJudgeScoreText(rawJudgeResponse);
		return {
			...score,
			benchmark_id: BENCHMARK_ID,
			control: score.control ?? prompt.control,
			duration_ms: performance.now() - start,
			judge_model: options.judgeModel,
			judge_reasoning_effort: options.judgeEffort,
			model: score.model ?? prompt.model,
			ok: true,
			question_id: score.question_id,
			raw_judge_response: rawJudgeResponse,
			reasoning_effort: score.reasoning_effort ?? prompt.reasoning_effort,
			response_id: response.id,
			status: response.status,
			usage: response.usage,
		};
	} catch (error) {
		return {
			benchmark_id: BENCHMARK_ID,
			control: prompt.control,
			duration_ms: performance.now() - start,
			error: errorToRecord(error),
			judge_model: options.judgeModel,
			judge_reasoning_effort: options.judgeEffort,
			model: prompt.model,
			ok: false,
			question_id: prompt.question_id,
			raw_judge_response: rawJudgeResponse,
			reasoning_effort: prompt.reasoning_effort,
			response_id: response?.id,
			status: response?.status,
			usage: response?.usage,
		};
	}
}

export async function runOpenAIJudgePrompts(
	client: OpenAIClient,
	prompts: readonly JudgePromptRecord[],
	options: OpenAIJudgeOptions & {
		concurrency?: number;
		onResult: (result: OpenAIJudgeResultWithMetadata) => void;
		onStart?: (progress: OpenAIJudgeRunProgress) => void;
	}
): Promise<void> {
	const concurrency = Math.max(
		1,
		Math.trunc(options.concurrency ?? DEFAULT_OPENAI_CONCURRENCY)
	);
	const plannedCount = prompts.length;
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (true) {
			const index = nextIndex;
			nextIndex++;

			const prompt = prompts[index];
			if (prompt === undefined) return;

			options.onStart?.({
				judgeEffort: options.judgeEffort,
				judgeModel: options.judgeModel,
				planned_count: plannedCount,
				prompt,
				run_index: index + 1,
			});

			options.onResult({
				...(await runOpenAIJudgePrompt(client, prompt, options)),
				planned_count: plannedCount,
				run_index: index + 1,
			});
		}
	}

	await Promise.all(
		Array.from(
			{ length: Math.min(concurrency, plannedCount) },
			async () => worker()
		)
	);
}

export async function runOpenAICombinations(
	client: OpenAIClient,
	combinations: readonly OpenAICombination[],
	options: {
		concurrency?: number;
		onResult: (result: OpenAIResultWithMetadata) => void;
		onStart?: (progress: OpenAIRunProgress) => void;
	}
): Promise<void> {
	const concurrency = Math.max(
		1,
		Math.trunc(options.concurrency ?? DEFAULT_OPENAI_CONCURRENCY)
	);
	const plannedCount = combinations.length;
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (true) {
			const index = nextIndex;
			nextIndex++;

			const combination = combinations[index];
			if (combination === undefined) return;

			options.onStart?.({
				combination,
				planned_count: plannedCount,
				run_index: index + 1,
			});

			options.onResult({
				...(await runOpenAICombination(client, combination)),
				planned_count: plannedCount,
				run_index: index + 1,
			});
		}
	}

	await Promise.all(
		Array.from(
			{ length: Math.min(concurrency, plannedCount) },
			async () => worker()
		)
	);
}

export function answerRecordsFromOpenAIResults(
	records: readonly unknown[]
): AnswerRecord[] {
	return records.filter(isAnswerRecord);
}

export function writeJsonlRecord(path: string, record: unknown): void {
	writeFileSync(path, `${JSON.stringify(record)}\n`, { flag: 'a' });
}

function extractJsonObjectText(text: string): string {
	const trimmed = text.trim();
	const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
	if (fenced?.[1] !== undefined) return fenced[1].trim();

	const start = trimmed.indexOf('{');
	const end = trimmed.lastIndexOf('}');
	if (start === -1 || end === -1 || end < start) {
		throw new Error('Judge response did not contain a JSON object');
	}
	return trimmed.slice(start, end + 1);
}

function errorToRecord(error: unknown): OpenAIErrorResult['error'] {
	if (error instanceof OpenAIAPIError) {
		return {
			code: error.code,
			message: error.message,
			param: error.param,
			status: error.status,
			type: error.type,
		};
	}

	if (error instanceof Error) {
		return { message: error.message };
	}

	return { message: String(error) };
}

function isAnswerRecord(value: unknown): value is AnswerRecord {
	return (
		isRecord(value) &&
		typeof value.answer === 'string' &&
		typeof value.question_id === 'string' &&
		(value.control === undefined || typeof value.control === 'boolean') &&
		(value.model === undefined || typeof value.model === 'string') &&
		(value.reasoning_effort === undefined ||
			typeof value.reasoning_effort === 'string')
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
