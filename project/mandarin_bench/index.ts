import { BENCHMARK_ID, MANDARIN_BENCH, Question } from './data.js';

export {
	BENCHMARK_ID,
	type Benchmark,
	type ExamStage,
	MANDARIN_BENCH,
	QUESTIONS,
	type Question,
	type QuestionKind,
	SOURCES,
	type Source,
} from './data.js';

export const CRITERIA = [
	{
		id: 'historical_grounding',
		label: 'Historical Grounding',
	},
	{
		id: 'question_responsiveness',
		label: 'Question Responsiveness',
	},
	{
		id: 'statecraft_reasoning',
		label: 'Statecraft Reasoning',
	},
	{
		id: 'classical_register',
		label: 'Classical Register',
	},
	{
		id: 'period_discipline',
		label: 'Period Discipline',
	},
] as const;

export type CriterionId = (typeof CRITERIA)[number]['id'];

export type CandidatePromptRecord = {
	benchmark_id: string;
	id: string;
	kind: Question['kind'];
	min_chinese_characters: number;
	prompt: string;
	source_ids: readonly string[];
	stage: Question['stage'];
	title: string;
};

export type AnswerRecord = {
	answer: string;
	control?: boolean;
	model?: string;
	question_id: string;
	reasoning_effort?: string;
};

export type JudgePromptRecord = {
	benchmark_id: string;
	control?: boolean;
	model?: string;
	prompt: string;
	question_id: string;
	reasoning_effort?: string;
};

export type JudgeScoreRecord = {
	control?: boolean;
	model?: string;
	notes?: string;
	question_id: string;
	reasoning_effort?: string;
	scores: Record<CriterionId, number>;
};

export type PerQuestionScore = {
	id: string;
	max: number;
	model?: string;
	percent: number;
	reasoning_effort?: string;
	score: number;
	title: string;
};

export type ScoreBand =
	| 'failed'
	| 'incomplete'
	| 'jinshi-first-class'
	| 'jinshi-second-class'
	| 'jinshi-third-class';

export type BenchmarkScore = {
	band: ScoreBand;
	benchmark_id: string;
	coverage: number;
	max: number;
	missing_question_ids: string[];
	pass_percent: number;
	passed: boolean;
	per_question: PerQuestionScore[];
	percent: number;
	score: number;
};

const SYSTEM_INSTRUCTIONS = [
	'You are sitting the 1904 Guangxu 30 Jiachen Enke imperial examination.',
	'Answer in Classical Chinese or high-register written Chinese.',
	'Do not mention events, institutions, technologies, or hindsight after 1904.',
	'Write an exam essay, not a checklist. You may enumerate only when the argument requires clear policy ordering.',
	'Use historical and classical precedent carefully, then make a direct judgment on the question.',
] as const;

export function questionById(id: string): Question {
	const question = MANDARIN_BENCH.questions.find(candidate => candidate.id === id);
	if (question === undefined) {
		throw new Error(`Unknown Mandarin Bench question: ${id}`);
	}

	return question;
}

export function makeCandidatePrompt(question: Question): string {
	return [
		`${MANDARIN_BENCH.title} / ${MANDARIN_BENCH.id}`,
		`Stage: ${question.stage}`,
		`Question kind: ${question.kind}`,
		'Instructions:',
		...SYSTEM_INSTRUCTIONS.map(instruction => `- ${instruction}`),
		`- Minimum expected Chinese length for this item: ${question.minChineseCharacters} Chinese characters.`,
		'Original examination question:',
		question.original,
	].join('\n');
}

export function candidatePromptRecords(): CandidatePromptRecord[] {
	return MANDARIN_BENCH.questions.map(question => ({
		benchmark_id: BENCHMARK_ID,
		id: question.id,
		kind: question.kind,
		min_chinese_characters: question.minChineseCharacters,
		prompt: makeCandidatePrompt(question),
		source_ids: question.sourceIds,
		stage: question.stage,
		title: question.title,
	}));
}

export function makeJudgePrompt(answer: AnswerRecord): string {
	const question = questionById(answer.question_id);
	const competencies = question.expectedCompetencies
		.map(competency => `- ${competency}`)
		.join('\n');
	const criteria = CRITERIA.map(
		criterion => `- ${criterion.id}: integer 0-5`
	).join('\n');
	const responseShape = {
		control: answer.control === true ? true : undefined,
		model: answer.model,
		notes: '...',
		question_id: answer.question_id,
		reasoning_effort: answer.reasoning_effort,
		scores: Object.fromEntries(CRITERIA.map(criterion => [criterion.id, 0])),
	};

	return [
		'You are grading MANDARIN BENCH, an LLM essay benchmark based on the 1904 Jiachen Enke imperial examination.',
		'Score only the submitted answer. Do not reward claims that depend on events after 1904.',
		'Use the full 0-5 range for each criterion: 0 absent, 1 very weak, 2 weak, 3 adequate, 4 strong, 5 exceptional.',
		'Expected competencies for this item:',
		competencies,
		'Return only minified JSON with this exact shape:',
		JSON.stringify(responseShape),
		'Criteria:',
		criteria,
		'Original examination question:',
		question.original,
		'Submitted answer:',
		answer.answer,
	].join('\n\n');
}

export function judgePromptRecords(
	answers: readonly AnswerRecord[]
): JudgePromptRecord[] {
	return answers.map(answer => ({
		benchmark_id: BENCHMARK_ID,
		control: answer.control === true ? true : undefined,
		model: answer.model,
		prompt: makeJudgePrompt(answer),
		question_id: answer.question_id,
		reasoning_effort: answer.reasoning_effort,
	}));
}

function normalizeCriterionScore(value: number, criterion: CriterionId): number {
	if (!Number.isFinite(value)) {
		throw new Error(`${criterion} score must be finite`);
	}

	if (value < 0 || value > 5) {
		throw new Error(`${criterion} score must be between 0 and 5`);
	}

	return value;
}

function scoreBand(percent: number, complete: boolean): ScoreBand {
	if (!complete) return 'incomplete';
	if (percent >= 90) return 'jinshi-first-class';
	if (percent >= 80) return 'jinshi-second-class';
	if (percent >= MANDARIN_BENCH.passPercent) return 'jinshi-third-class';
	return 'failed';
}

export function scoreJudgeRecords(
	records: readonly JudgeScoreRecord[]
): BenchmarkScore {
	const seen = new Set<string>();
	const perQuestion = records.map(record => {
		if (seen.has(record.question_id)) {
			throw new Error(`Duplicate judge score for ${record.question_id}`);
		}
		seen.add(record.question_id);

		const question = questionById(record.question_id);
		const score = CRITERIA.reduce(
			(acc, criterion) =>
				acc +
				normalizeCriterionScore(record.scores[criterion.id], criterion.id),
			0
		);
		const max = CRITERIA.length * 5;

		return {
			id: record.question_id,
			max,
			model: record.model,
			percent: (score / max) * 100,
			reasoning_effort: record.reasoning_effort,
			score,
			title: question.title,
		};
	});

	const expectedIds = MANDARIN_BENCH.questions.map(question => question.id);
	const missingQuestionIds = expectedIds.filter(id => !seen.has(id));
	const score = perQuestion.reduce((acc, item) => acc + item.score, 0);
	const max = expectedIds.length * CRITERIA.length * 5;
	const percent = max === 0 ? 0 : (score / max) * 100;
	const complete = missingQuestionIds.length === 0;

	return {
		band: scoreBand(percent, complete),
		benchmark_id: BENCHMARK_ID,
		coverage: expectedIds.length === 0 ? 1 : seen.size / expectedIds.length,
		max,
		missing_question_ids: missingQuestionIds,
		pass_percent: MANDARIN_BENCH.passPercent,
		passed: complete && percent >= MANDARIN_BENCH.passPercent,
		per_question: perQuestion,
		percent,
		score,
	};
}

export function parseJsonl(text: string): unknown[] {
	return text
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(line => line.length > 0)
		.map(line => JSON.parse(line) as unknown);
}

export function renderJsonl(records: readonly unknown[]): string {
	return `${records.map(record => JSON.stringify(record)).join('\n')}\n`;
}

export function isJudgeScoreRecord(value: unknown): value is JudgeScoreRecord {
	if (!isRecord(value) || typeof value.question_id !== 'string') return false;
	if (value.model !== undefined && typeof value.model !== 'string') return false;
	if (
		value.reasoning_effort !== undefined &&
		typeof value.reasoning_effort !== 'string'
	) {
		return false;
	}
	if (value.notes !== undefined && typeof value.notes !== 'string') return false;
	if (!isRecord(value.scores)) return false;
	const scores = value.scores;

	return CRITERIA.every(criterion => {
		const score = scores[criterion.id];
		return (
			typeof score === 'number' &&
			Number.isFinite(score) &&
			score >= 0 &&
			score <= 5
		);
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
