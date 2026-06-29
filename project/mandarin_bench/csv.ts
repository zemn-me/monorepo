import {
	CRITERIA,
	type JudgeScoreRecord,
	MANDARIN_BENCH,
	questionById,
	scoreJudgeRecords,
} from './index.js';

type CsvCell = boolean | number | string | null | undefined;

export function renderCsv(
	headers: readonly string[],
	rows: readonly Record<string, CsvCell>[]
): string {
	return `${[
		headers.join(','),
		...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
		].join('\n')}\n`;
}

export function questionsCsv(): string {
	const headers = [
		'benchmark_id',
		'question_id',
		'order',
		'stage',
		'kind',
		'title',
		'min_chinese_characters',
		'topic_keywords',
		'source_ids',
		'original',
	];

	return renderCsv(
		headers,
		MANDARIN_BENCH.questions.map(question => ({
			benchmark_id: MANDARIN_BENCH.id,
			kind: question.kind,
			min_chinese_characters: question.minChineseCharacters,
			order: question.order,
			original: question.original,
			question_id: question.id,
			source_ids: question.sourceIds.join(' '),
			stage: question.stage,
			title: question.title,
			topic_keywords: question.topicKeywords.join(' '),
		}))
	);
}

export function sourcesCsv(): string {
	return renderCsv(
		['source_id', 'title', 'url', 'note'],
		MANDARIN_BENCH.sources.map(source => ({
			note: source.note,
			source_id: source.id,
			title: source.title,
			url: source.url,
		}))
	);
}

export function criteriaCsv(): string {
	return renderCsv(
		['criterion_id', 'label'],
		CRITERIA.map(criterion => ({
			criterion_id: criterion.id,
			label: criterion.label,
		}))
	);
}

export function openAIResultsCsv(records: readonly unknown[]): string {
	const headers = [
		'benchmark_id',
		'run_index',
		'planned_count',
		'model',
		'reasoning_effort',
		'control',
		'question_id',
		'title',
		'ok',
		'status',
		'response_id',
		'duration_ms',
		'answer_chars',
		'answer_han_chars',
		'input_tokens',
		'output_tokens',
		'total_tokens',
		'reasoning_tokens',
		'error_status',
		'error_code',
		'error_param',
		'error_type',
		'error_message',
	];

	return renderCsv(
		headers,
		records.map(record => {
			const value = asRecord(record);
			const usage = asRecord(value.usage);
			const outputDetails = asRecord(usage.output_tokens_details);
			const error = asRecord(value.error);
			const answer = stringCell(value.answer);

			return {
				answer_chars: answer?.length,
				answer_han_chars: answer === undefined ? undefined : countHan(answer),
				benchmark_id: stringCell(value.benchmark_id),
				control: boolCell(value.control),
				duration_ms: numberCell(value.duration_ms),
				error_code: stringCell(error.code),
				error_message: stringCell(error.message),
				error_param: stringCell(error.param),
				error_status: numberCell(error.status),
				error_type: stringCell(error.type),
				input_tokens: numberCell(usage.input_tokens),
				model: stringCell(value.model),
				ok: boolCell(value.ok),
				output_tokens: numberCell(usage.output_tokens),
				planned_count: numberCell(value.planned_count),
				question_id: stringCell(value.question_id),
				reasoning_effort: stringCell(value.reasoning_effort),
				reasoning_tokens: numberCell(outputDetails.reasoning_tokens),
				response_id: stringCell(value.response_id),
				run_index: numberCell(value.run_index),
				status: stringCell(value.status),
				title: stringCell(value.title),
				total_tokens: numberCell(usage.total_tokens),
			};
		})
	);
}

export function judgeScoresCsv(records: readonly JudgeScoreRecord[]): string {
	const headers = [
		'benchmark_id',
		'model',
		'reasoning_effort',
		'control',
		'judge_model',
		'judge_reasoning_effort',
		'question_id',
		'title',
		...CRITERIA.map(criterion => criterion.id),
		'total_score',
		'max_score',
		'percent',
		'judge_response_id',
		'judge_duration_ms',
		'input_tokens',
		'output_tokens',
		'total_tokens',
		'reasoning_tokens',
		'notes',
	];

	return renderCsv(
		headers,
		records.map(record => {
			const value = asRecord(record);
			const usage = asRecord(value.usage);
			const outputDetails = asRecord(usage.output_tokens_details);
			const question = questionById(record.question_id);
			const totalScore = CRITERIA.reduce(
				(acc, criterion) => acc + record.scores[criterion.id],
				0
			);
			const maxScore = CRITERIA.length * 5;

			return {
				...Object.fromEntries(
					CRITERIA.map(criterion => [
						criterion.id,
						record.scores[criterion.id],
					])
				),
				benchmark_id: MANDARIN_BENCH.id,
				control: boolCell(value.control ?? record.control),
				input_tokens: numberCell(usage.input_tokens),
				judge_duration_ms: numberCell(value.duration_ms),
				judge_model: stringCell(value.judge_model),
				judge_reasoning_effort: stringCell(value.judge_reasoning_effort),
				judge_response_id: stringCell(value.response_id),
				max_score: maxScore,
				model: record.model,
				notes: record.notes,
				output_tokens: numberCell(usage.output_tokens),
				percent: (totalScore / maxScore) * 100,
				question_id: record.question_id,
				reasoning_effort: record.reasoning_effort,
				reasoning_tokens: numberCell(outputDetails.reasoning_tokens),
				title: question.title,
				total_tokens: numberCell(usage.total_tokens),
				total_score: totalScore,
			};
		})
	);
}

export function scoreSummaryCsv(records: readonly JudgeScoreRecord[]): string {
	const headers = [
		'benchmark_id',
		'model',
		'reasoning_effort',
		'control',
		'coverage',
		'score',
		'max_score',
		'percent',
		'passed',
		'band',
		'answered_questions',
		'missing_questions',
	];

	return renderCsv(
		headers,
		[...groupJudgeRecords(records).entries()].map(([key, groupRecords]) => {
			const [model, reasoningEffort, control] = JSON.parse(key) as [
				string,
				string,
				boolean,
			];
			const score = scoreJudgeRecords(groupRecords);

			return {
				answered_questions: groupRecords.length,
				band: score.band,
				benchmark_id: score.benchmark_id,
				control,
				coverage: score.coverage,
				max_score: score.max,
				missing_questions: score.missing_question_ids.join(' '),
				model,
				passed: score.passed,
				percent: score.percent,
				reasoning_effort: reasoningEffort,
				score: score.score,
			};
		})
	);
}

function groupJudgeRecords(
	records: readonly JudgeScoreRecord[]
): Map<string, JudgeScoreRecord[]> {
	const groups = new Map<string, JudgeScoreRecord[]>();
	for (const record of records) {
		const key = JSON.stringify([
			record.model ?? '',
			record.reasoning_effort ?? '',
			record.control === true,
		]);
		groups.set(key, [...(groups.get(key) ?? []), record]);
	}
	return groups;
}

function csvCell(value: CsvCell): string {
	if (value === undefined || value === null) return '';
	const raw = String(value);
	if (!/[",\n\r]/.test(raw)) return raw;
	return `"${raw.replaceAll('"', '""')}"`;
}

function countHan(value: string): number {
	return [...value.matchAll(/\p{Script=Han}/gu)].length;
}

function asRecord(value: unknown): Record<string, unknown> {
	if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
	return {};
}

function boolCell(value: unknown): boolean | undefined {
	return typeof value === 'boolean' ? value : undefined;
}

function numberCell(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringCell(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}
