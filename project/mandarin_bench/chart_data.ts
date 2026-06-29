import { readFileSync, writeFileSync } from 'node:fs';

import {
	CRITERIA,
	isJudgeScoreRecord,
	type JudgeScoreRecord,
	MANDARIN_BENCH,
	parseJsonl,
	scoreJudgeRecords,
} from './index.js';

type AnswerRecordWithMetadata = {
	answer?: string;
	control?: boolean;
	model?: string;
	ok?: boolean;
	question_id?: string;
	reasoning_effort?: string;
	title?: string;
};

type JudgeScoreRecordWithMetadata = JudgeScoreRecord & {
	control?: boolean;
	judge_model?: string;
	judge_reasoning_effort?: string;
};

function flagValues(name: string): string[] {
	const prefix = `--${name}=`;
	return process.argv
		.filter(arg => arg.startsWith(prefix))
		.map(arg => arg.slice(prefix.length))
		.filter(value => value.length > 0);
}

function flagValue(name: string): string | undefined {
	return flagValues(name)[0];
}

function requiredFlag(name: string): string {
	const value = flagValue(name);
	if (value === undefined || value.length === 0) {
		throw new Error(`Missing --${name}=path`);
	}
	return value;
}

function isAnswerRecordWithMetadata(value: unknown): value is AnswerRecordWithMetadata {
	if (typeof value !== 'object' || value === null) return false;
	const record = value as AnswerRecordWithMetadata;
	return (
		record.ok === true &&
		typeof record.answer === 'string' &&
		typeof record.model === 'string' &&
		typeof record.question_id === 'string' &&
		typeof record.reasoning_effort === 'string'
	);
}

function runKey(record: {
	control?: boolean;
	model?: string;
	question_id?: string;
	reasoning_effort?: string;
}): string {
	return JSON.stringify([
		record.model ?? '',
		record.reasoning_effort ?? '',
		record.question_id ?? '',
		record.control === true,
	]);
}

function scoreForQuestion(record: JudgeScoreRecord): number {
	return Object.values(record.scores).reduce((sum, score) => sum + score, 0);
}

function main(): void {
	const answers = flagValues('answers')
		.flatMap(path => parseJsonl(readFileSync(path, 'utf8')))
		.filter(isAnswerRecordWithMetadata);
	const judgements = flagValues('judgements')
		.flatMap(path => parseJsonl(readFileSync(path, 'utf8')))
		.filter(isJudgeScoreRecord) as JudgeScoreRecordWithMetadata[];
	const answersByRun = new Map(answers.map(answer => [runKey(answer), answer]));
	const judgementGroups = new Map<string, JudgeScoreRecordWithMetadata[]>();

	for (const judgement of judgements) {
		const key = JSON.stringify([
			judgement.model ?? '',
			judgement.reasoning_effort ?? '',
			judgement.control === true,
		]);
		judgementGroups.set(key, [...(judgementGroups.get(key) ?? []), judgement]);
	}

	const rows = [...judgementGroups.values()]
		.map(group => {
			const score = scoreJudgeRecords(group);
			const [first] = group;
			if (first === undefined) return undefined;
			const control = first.control === true;
			if (score.coverage !== 1) return undefined;
			const scoreMax = MANDARIN_BENCH.questions.length * CRITERIA.length * 5;
			const judgementsByQuestion = new Map(
				group.map(judgement => [judgement.question_id, judgement] as const)
			);

			return {
				answeredQuestions: group.length,
				band: score.band,
				control,
				judge: `${first.judge_model ?? ''} ${
					first.judge_reasoning_effort ?? ''
				}`.trim(),
				model: first.model ?? '',
				passed: score.passed,
				percent: scoreMax === 0 ? 0 : (score.score / scoreMax) * 100,
				questions: MANDARIN_BENCH.questions.map(question => {
					const judgement = judgementsByQuestion.get(question.id);
					const answer =
						judgement === undefined
							? undefined
							: answersByRun.get(runKey(judgement));

					return {
						answer: answer?.answer ?? '',
						questionId: question.id,
						scores: Object.fromEntries(
							CRITERIA.map(criterion => [
								criterion.id,
								judgement?.scores[criterion.id] ?? 0,
							])
						),
						title: question.title,
						totalScore:
							judgement === undefined ? 0 : scoreForQuestion(judgement),
					};
				}),
				reasoningEffort: first.reasoning_effort ?? '',
				score: score.score,
				scoreMax,
			};
		})
		.filter(row => row !== undefined)
		.sort(
			(a, b) => {
				if (a.control !== b.control) return a.control ? 1 : -1;
				return (
					b.score - a.score ||
					b.percent - a.percent ||
					a.model.localeCompare(b.model) ||
					a.reasoningEffort.localeCompare(b.reasoningEffort)
				);
			}
		)
		.map((row, index) => ({
			...row,
			rank: row.control ? 0 : index + 1,
		}));

	writeFileSync(
		requiredFlag('out'),
		`${JSON.stringify(
			{
				criteria: CRITERIA,
				maxScore: MANDARIN_BENCH.questions.length * 25,
				questionCount: MANDARIN_BENCH.questions.length,
				rows,
			},
			null,
			2
		)}\n`
	);
}

main();
