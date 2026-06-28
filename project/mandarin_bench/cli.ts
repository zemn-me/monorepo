import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
	criteriaCsv,
	judgeScoresCsv,
	openAIResultsCsv,
	questionsCsv,
	scoreSummaryCsv,
	sourcesCsv,
} from './csv.js';
import {
	type AnswerRecord,
	candidatePromptRecords,
	isJudgeScoreRecord,
	type JudgeScoreRecord,
	judgePromptRecords,
	parseJsonl,
	renderJsonl,
	scoreJudgeRecords,
} from './index.js';
import {
	answerRecordsFromOpenAIResults,
	buildOpenAICombinations,
	DEFAULT_OPENAI_CONCURRENCY,
	DEFAULT_OPENAI_JUDGE_EFFORT,
	DEFAULT_OPENAI_JUDGE_MODEL,
	filterExistingOpenAICombinations,
	filterExistingOpenAIJudgePrompts,
	filterRetryableOpenAIRecords,
	modelIds,
	OpenAIClient,
	parseReasoningEfforts,
	runOpenAICombinations,
	runOpenAIJudgePrompts,
	TRANSIENT_OPENAI_ERROR_MATCHERS,
	writeJsonlRecord,
} from './openai.js';

const RUNS_DIR = 'project/mandarin_bench/runs';
const DEFAULT_OPENAI_RESULTS_PATH = `${RUNS_DIR}/openai_all_models_medium.jsonl`;
const DEFAULT_OPENAI_JUDGEMENTS_PATH = `${RUNS_DIR}/judgements_gpt_5_5_medium.jsonl`;

function flagValue(name: string): string | undefined {
	const prefix = `--${name}=`;
	return process.argv.find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function readJsonlFlag(name: string): unknown[] {
	const path = flagValue(name);
	if (path === undefined) {
		throw new Error(`Missing --${name}=path`);
	}

	return parseJsonl(readFileSync(path, 'utf8'));
}

function readJudgeScoreFlag(name: string): JudgeScoreRecord[] {
	return readJsonlFlag(name).filter(isJudgeScoreRecord);
}

function commaListFlag(name: string): string[] | undefined {
	const raw = flagValue(name);
	if (raw === undefined) return undefined;
	return raw
		.split(',')
		.map(value => value.trim())
		.filter(value => value.length > 0);
}

function numberFlag(name: string): number | undefined {
	const raw = flagValue(name);
	if (raw === undefined) return undefined;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new Error(`--${name} must be a positive integer`);
	}
	return parsed;
}

function hasFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

function openAIApiKey(): string {
	const fromFlag = flagValue('api-key');
	if (fromFlag !== undefined) return fromFlag;

	const keyFile = flagValue('api-key-file');
	if (keyFile !== undefined) return readFileSync(keyFile, 'utf8').trim();

	const fromEnv = process.env.OPENAI_API_KEY;
	if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;

	throw new Error(
		'Missing OpenAI API key. Set OPENAI_API_KEY or pass --api-key-file=path.'
	);
}

function selectedQuestionIds(): string[] | undefined {
	return commaListFlag('question-ids') ?? commaListFlag('questions');
}

function openAIRetryMatchers(): string[] {
	const matchers = commaListFlag('retry-errors') ?? [];
	if (hasFlag('retry-transient')) {
		matchers.push(...TRANSIENT_OPENAI_ERROR_MATCHERS);
	}
	return [...new Set(matchers)];
}

function bazelWorkspacePath(relativePath: string): string {
	const root = process.env.BUILD_WORKSPACE_DIRECTORY;
	if (root === undefined || root.length === 0) {
		throw new Error(
			'BUILD_WORKSPACE_DIRECTORY environment variable is not set. Run this command through Bazel.'
		);
	}
	return join(root, relativePath);
}

function writeTextOutput(text: string): void {
	const out = flagValue('out');
	if (out === undefined) {
		process.stdout.write(text);
		return;
	}
	writeFileSync(out, text);
}

function writeAnalysisBundle(): void {
	const outDir = flagValue('out-dir') ?? flagValue('dir') ?? 'mandarin_bench_analysis';
	mkdirSync(outDir, { recursive: true });

	const written = [
		writeBundleFile(outDir, 'questions.csv', questionsCsv()),
		writeBundleFile(outDir, 'sources.csv', sourcesCsv()),
		writeBundleFile(outDir, 'criteria.csv', criteriaCsv()),
	];

	const resultsPath = flagValue('results');
	if (resultsPath !== undefined) {
		written.push(
			writeBundleFile(
				outDir,
				'openai_results.csv',
				openAIResultsCsv(parseJsonl(readFileSync(resultsPath, 'utf8')))
			)
		);
	}

	const judgementsPath = flagValue('judgements');
	if (judgementsPath !== undefined) {
		const judgements = parseJsonl(readFileSync(judgementsPath, 'utf8')).filter(
			isJudgeScoreRecord
		);
		written.push(
			writeBundleFile(outDir, 'judge_scores.csv', judgeScoresCsv(judgements)),
			writeBundleFile(outDir, 'score_summary.csv', scoreSummaryCsv(judgements))
		);
	}

	process.stderr.write(`Wrote analysis bundle:\n${written.join('\n')}\n`);
}

function writeBundleFile(outDir: string, filename: string, content: string): string {
	const path = join(outDir, filename);
	writeFileSync(path, content);
	return path;
}

async function listOpenAIModels() {
	const client = new OpenAIClient({
		apiKey: openAIApiKey(),
		baseUrl: flagValue('base-url'),
		timeoutMs: numberFlag('timeout-ms'),
	});
	const models = await client.listModels();
	process.stdout.write(renderJsonl(models));
}

async function runOpenAI() {
	const explicitModels = commaListFlag('models');
	const client =
		explicitModels === undefined || !hasFlag('dry-run')
			? new OpenAIClient({
					apiKey: openAIApiKey(),
					baseUrl: flagValue('base-url'),
					timeoutMs: numberFlag('timeout-ms'),
				})
			: undefined;
	const listedModels =
		explicitModels ??
		modelIds((await client?.listModels()) ?? []).filter(model => {
			const regex = flagValue('model-regex');
			return regex === undefined || new RegExp(regex).test(model);
		});
	const limitModels = numberFlag('limit-models');
	const models =
		limitModels === undefined ? listedModels : listedModels.slice(0, limitModels);
	const limitQuestions = numberFlag('limit-questions');
	const prompts =
		limitQuestions === undefined
			? candidatePromptRecords()
			: candidatePromptRecords().slice(0, limitQuestions);
	const combinations = buildOpenAICombinations({
		efforts: parseReasoningEfforts(flagValue('efforts')),
		models,
		prompts,
		questionIds: selectedQuestionIds(),
	});

	const maxCombinations = numberFlag('max-combinations');
	const out = flagValue('out') ?? flagValue('results');
	let planned =
		maxCombinations === undefined
			? combinations
			: combinations.slice(0, maxCombinations);

	if (hasFlag('resume')) {
		if (out === undefined) {
			throw new Error('--resume requires --out=path or --results=path');
		}
		if (existsSync(out)) {
			const before = planned.length;
			const retryMatchers = openAIRetryMatchers();
			const existingRecords = parseJsonl(readFileSync(out, 'utf8'));
			const resumeRecords = filterRetryableOpenAIRecords(
				existingRecords,
				retryMatchers
			);
			planned = filterExistingOpenAICombinations(
				planned,
				resumeRecords
			);
			const retryableRows = existingRecords.length - resumeRecords.length;
			process.stderr.write(
				`Resume skipped ${before - planned.length} existing result rows from ${out}.\n`
			);
			if (retryableRows > 0) {
				process.stderr.write(
					`Resume will retry ${retryableRows} existing error rows matching ${retryMatchers.join(', ')}.\n`
				);
			}
		}
	}

	if (hasFlag('dry-run')) {
		process.stdout.write(
			renderJsonl(
				planned.map((combination, index) => ({
					...combination,
					planned_count: planned.length,
					run_index: index + 1,
				}))
			)
		);
		return;
	}

	if (out !== undefined && !hasFlag('append') && !hasFlag('resume')) {
		writeFileSync(out, '');
	}

	await runOpenAICombinations(client!, planned, {
		concurrency: numberFlag('concurrency') ?? DEFAULT_OPENAI_CONCURRENCY,
		onResult: result => {
			if (out === undefined) {
				process.stdout.write(`${JSON.stringify(result)}\n`);
			} else {
				writeJsonlRecord(out, result);
			}
		},
		onStart: progress => {
			process.stderr.write(
				`[${progress.run_index}/${progress.planned_count}] ${progress.combination.model} ${progress.combination.reasoning_effort} ${progress.combination.question_id}\n`
			);
		},
	});
}

async function runPaidOpenAI() {
	const resultsPath =
		flagValue('results') ?? bazelWorkspacePath(DEFAULT_OPENAI_RESULTS_PATH);
	const judgementsPath =
		flagValue('judgements') ?? bazelWorkspacePath(DEFAULT_OPENAI_JUDGEMENTS_PATH);
	mkdirSync(dirname(resultsPath), { recursive: true });
	mkdirSync(dirname(judgementsPath), { recursive: true });

	const explicitModels = commaListFlag('models');
	const client =
		explicitModels === undefined || !hasFlag('dry-run')
			? new OpenAIClient({
					apiKey: openAIApiKey(),
					baseUrl: flagValue('base-url'),
					timeoutMs: numberFlag('timeout-ms'),
				})
			: undefined;
	const listedModels =
		explicitModels ??
		modelIds((await client?.listModels()) ?? []).filter(model => {
			const regex = flagValue('model-regex');
			return regex === undefined || new RegExp(regex).test(model);
		});
	const limitModels = numberFlag('limit-models');
	const models =
		limitModels === undefined ? listedModels : listedModels.slice(0, limitModels);
	const limitQuestions = numberFlag('limit-questions');
	const prompts =
		limitQuestions === undefined
			? candidatePromptRecords()
			: candidatePromptRecords().slice(0, limitQuestions);
	const combinations = buildOpenAICombinations({
		efforts: parseReasoningEfforts(flagValue('efforts')),
		models,
		prompts,
		questionIds: selectedQuestionIds(),
	});
	const maxCombinations = numberFlag('max-combinations');
	let planned =
		maxCombinations === undefined
			? combinations
			: combinations.slice(0, maxCombinations);
	if (existsSync(resultsPath)) {
		const before = planned.length;
		const existingRecords = parseJsonl(readFileSync(resultsPath, 'utf8'));
		const resumeRecords = filterRetryableOpenAIRecords(
			existingRecords,
			[...TRANSIENT_OPENAI_ERROR_MATCHERS, ...(commaListFlag('retry-errors') ?? [])]
		);
		planned = filterExistingOpenAICombinations(planned, resumeRecords);
		process.stderr.write(
			`Resume skipped ${before - planned.length} existing result rows from ${resultsPath}.\n`
		);
	}

	if (hasFlag('dry-run')) {
		process.stdout.write(
			renderJsonl(
				planned.map((combination, index) => ({
					...combination,
					planned_count: planned.length,
					run_index: index + 1,
				}))
			)
		);
		return;
	}

	await runOpenAICombinations(client!, planned, {
		concurrency: numberFlag('concurrency') ?? DEFAULT_OPENAI_CONCURRENCY,
		onResult: result => writeJsonlRecord(resultsPath, result),
		onStart: progress => {
			process.stderr.write(
				`[${progress.run_index}/${progress.planned_count}] ${progress.combination.model} ${progress.combination.reasoning_effort} ${progress.combination.question_id}\n`
			);
		},
	});

	const judgeModel = flagValue('judge-model') ?? DEFAULT_OPENAI_JUDGE_MODEL;
	const judgeEfforts = parseReasoningEfforts(
		flagValue('judge-effort') ?? DEFAULT_OPENAI_JUDGE_EFFORT
	);
	if (judgeEfforts.length !== 1) {
		throw new Error('--judge-effort must specify exactly one reasoning effort');
	}
	const judgeEffort = judgeEfforts[0]!;
	let judgePrompts = judgePromptRecords(
		answerRecordsFromOpenAIResults(parseJsonl(readFileSync(resultsPath, 'utf8')))
	);
	if (existsSync(judgementsPath)) {
		const before = judgePrompts.length;
		judgePrompts = filterExistingOpenAIJudgePrompts(
			judgePrompts,
			parseJsonl(readFileSync(judgementsPath, 'utf8')),
			{
				judgeEffort,
				judgeModel,
			}
		);
		process.stderr.write(
			`Resume skipped ${before - judgePrompts.length} existing judgement rows from ${judgementsPath}.\n`
		);
	}

	await runOpenAIJudgePrompts(client!, judgePrompts, {
		concurrency: numberFlag('concurrency') ?? DEFAULT_OPENAI_CONCURRENCY,
		judgeEffort,
		judgeModel,
		onResult: result => writeJsonlRecord(judgementsPath, result),
		onStart: progress => {
			process.stderr.write(
				`[${progress.run_index}/${progress.planned_count}] judge ${progress.judgeModel} ${progress.judgeEffort} ${progress.prompt.model ?? ''} ${progress.prompt.reasoning_effort ?? ''} ${progress.prompt.question_id}\n`
			);
		},
	});

	process.stderr.write(
		`Wrote paid OpenAI artifacts:\n${resultsPath}\n${judgementsPath}\n`
	);
}

async function judgeOpenAI() {
	const answers = answerRecordsFromOpenAIResults(readJsonlFlag('answers'));
	const judgeModel = flagValue('judge-model') ?? DEFAULT_OPENAI_JUDGE_MODEL;
	const judgeEfforts = parseReasoningEfforts(
		flagValue('judge-effort') ?? DEFAULT_OPENAI_JUDGE_EFFORT
	);
	if (judgeEfforts.length !== 1) {
		throw new Error('--judge-effort must specify exactly one reasoning effort');
	}
	const judgeEffort = judgeEfforts[0]!;
	const client = hasFlag('dry-run')
		? undefined
		: new OpenAIClient({
				apiKey: openAIApiKey(),
				baseUrl: flagValue('base-url'),
				timeoutMs: numberFlag('timeout-ms'),
			});
	const out = flagValue('out') ?? flagValue('judgements');
	let prompts = judgePromptRecords(answers);

	if (hasFlag('resume')) {
		if (out === undefined) {
			throw new Error('--resume requires --out=path or --judgements=path');
		}
		if (existsSync(out)) {
			const before = prompts.length;
			prompts = filterExistingOpenAIJudgePrompts(
				prompts,
				parseJsonl(readFileSync(out, 'utf8')),
				{
					judgeEffort,
					judgeModel,
				}
			);
			process.stderr.write(
				`Resume skipped ${before - prompts.length} existing judgement rows from ${out}.\n`
			);
		}
	}

	if (hasFlag('dry-run')) {
		process.stdout.write(
			renderJsonl(
				prompts.map((prompt, index) => ({
					...prompt,
					judge_model: judgeModel,
					judge_reasoning_effort: judgeEffort,
					planned_count: prompts.length,
					run_index: index + 1,
				}))
			)
		);
		return;
	}

	if (out !== undefined && !hasFlag('append') && !hasFlag('resume')) {
		writeFileSync(out, '');
	}

	await runOpenAIJudgePrompts(client!, prompts, {
		concurrency: numberFlag('concurrency') ?? DEFAULT_OPENAI_CONCURRENCY,
		judgeEffort,
		judgeModel,
		onResult: result => {
			if (out === undefined) {
				process.stdout.write(`${JSON.stringify(result)}\n`);
			} else {
				writeJsonlRecord(out, result);
			}
		},
		onStart: progress => {
			process.stderr.write(
				`[${progress.run_index}/${progress.planned_count}] judge ${progress.judgeModel} ${progress.judgeEffort} ${progress.prompt.model ?? ''} ${progress.prompt.reasoning_effort ?? ''} ${progress.prompt.question_id}\n`
			);
		},
	});
}

function usage(): string {
	return [
		'Usage:',
		'  mandarin_bench candidate-prompts',
		'  mandarin_bench judge-prompts --answers=answers.jsonl',
		'  mandarin_bench score --judgements=judgements.jsonl',
		'  mandarin_bench results-csv --results=results.jsonl [--out=results.csv]',
		'  mandarin_bench judgements-csv --judgements=judgements.jsonl [--out=judgements.csv]',
		'  mandarin_bench score-csv --judgements=judgements.jsonl [--out=summary.csv]',
		'  mandarin_bench analysis-bundle --results=results.jsonl --judgements=judgements.jsonl --out-dir=analysis',
		'  mandarin_bench list-openai-models',
		'  mandarin_bench run-paid-openai',
		'  mandarin_bench run-openai --out=results.jsonl',
		'  mandarin_bench judge-openai --answers=results.jsonl --out=judgements.jsonl',
		'',
		'answers.jsonl lines: {"question_id":"...","model":"...","answer":"..."}',
		'judgements.jsonl lines: {"question_id":"...","scores":{"historical_grounding":0,"question_responsiveness":0,"statecraft_reasoning":0,"classical_register":0,"period_discipline":0},"notes":"..."}',
		'OpenAI auth: set OPENAI_API_KEY or pass --api-key-file=path.',
		`run-paid-openai writes ${DEFAULT_OPENAI_RESULTS_PATH} and ${DEFAULT_OPENAI_JUDGEMENTS_PATH}, resuming existing rows by default.`,
		'run-openai options: --models=a,b, --model-regex=regex, --efforts=medium|none,minimal,low,high,xhigh, --question-ids=id,id, --limit-models=N, --limit-questions=N, --max-combinations=N, --concurrency=N, --timeout-ms=N, --resume, --retry-transient, --retry-errors=text,text, --dry-run.',
		`judge-openai options: --judge-model=${DEFAULT_OPENAI_JUDGE_MODEL}, --judge-effort=${DEFAULT_OPENAI_JUDGE_EFFORT}, --concurrency=N, --timeout-ms=N, --resume, --dry-run.`,
	].join('\n');
}

async function main() {
	const command = process.argv[2];

	if (command === 'candidate-prompts') {
		process.stdout.write(renderJsonl(candidatePromptRecords()));
		return;
	}

	if (command === 'judge-prompts') {
		const answers = answerRecordsFromOpenAIResults(
			readJsonlFlag('answers')
		) as AnswerRecord[];
		process.stdout.write(renderJsonl(judgePromptRecords(answers)));
		return;
	}

	if (command === 'score') {
		const judgements = readJudgeScoreFlag('judgements');
		process.stdout.write(`${JSON.stringify(scoreJudgeRecords(judgements), null, 2)}\n`);
		return;
	}

	if (command === 'results-csv') {
		writeTextOutput(openAIResultsCsv(readJsonlFlag('results')));
		return;
	}

	if (command === 'judgements-csv') {
		writeTextOutput(judgeScoresCsv(readJudgeScoreFlag('judgements')));
		return;
	}

	if (command === 'score-csv') {
		writeTextOutput(scoreSummaryCsv(readJudgeScoreFlag('judgements')));
		return;
	}

	if (command === 'analysis-bundle') {
		writeAnalysisBundle();
		return;
	}

	if (command === 'list-openai-models') {
		await listOpenAIModels();
		return;
	}

	if (command === 'run-paid-openai') {
		await runPaidOpenAI();
		return;
	}

	if (command === 'run-openai') {
		await runOpenAI();
		return;
	}

	if (command === 'judge-openai') {
		await judgeOpenAI();
		return;
	}

	process.stderr.write(`${usage()}\n`);
	process.exitCode = 2;
}

main().catch(error => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
