import { expect, test } from '@jest/globals';

import {
	criteriaCsv,
	judgeScoresCsv,
	openAIResultsCsv,
	questionsCsv,
	scoreSummaryCsv,
	sourcesCsv,
} from '#root/project/mandarin_bench/csv.js';
import {
	candidatePromptRecords,
	judgePromptRecords,
	MANDARIN_BENCH,
	parseJsonl,
	renderJsonl,
	scoreJudgeRecords,
} from '#root/project/mandarin_bench/index.js';
import {
	answerRecordsFromOpenAIResults,
	buildOpenAICombinations,
	DEFAULT_OPENAI_CONCURRENCY,
	DEFAULT_OPENAI_JUDGE_EFFORT,
	DEFAULT_OPENAI_JUDGE_MODEL,
	DEFAULT_OPENAI_TIMEOUT_MS,
	DEFAULT_REASONING_EFFORTS,
	extractOpenAIOutputText,
	filterExistingOpenAICombinations,
	filterExistingOpenAIJudgePrompts,
	filterRetryableOpenAIRecords,
	OpenAIClient,
	openAIResultErrorLabels,
	parseJudgeScoreText,
	parseReasoningEfforts,
	runOpenAICombinations,
	runOpenAIJudgePrompts,
	TRANSIENT_OPENAI_ERROR_MATCHERS,
} from '#root/project/mandarin_bench/openai.js';

test('benchmark has stable unique question ids and source links', () => {
	const ids = MANDARIN_BENCH.questions.map(question => question.id);

	expect(new Set(ids).size).toBe(ids.length);
	expect(MANDARIN_BENCH.questions).toHaveLength(14);
	expect(MANDARIN_BENCH.sources.every(source => source.url.startsWith('https://'))).toBe(
		true
	);
	expect(
		MANDARIN_BENCH.questions.every(question => question.sourceIds.length > 0)
	).toBe(true);
});

test('candidate prompts include original exam text and benchmark metadata', () => {
	const records = candidatePromptRecords();
	const first = records[0];

	expect(records).toHaveLength(MANDARIN_BENCH.questions.length);
	expect(first?.benchmark_id).toBe(MANDARIN_BENCH.id);
	expect(first?.prompt).toContain('MANDARIN BENCH');
	expect(first?.prompt).toContain('Original examination question');
	expect(first?.prompt).toContain(MANDARIN_BENCH.questions[0]?.original);
});

test('judge prompt asks for the complete score schema', () => {
	const [judgePrompt] = judgePromptRecords([
		{
			answer: '臣对：治天下者，当审古今之势而求其实政。',
			control: true,
			question_id: 'metropolitan-history-centralization',
			reasoning_effort: 'xhigh',
		},
	]);

	expect(judgePrompt?.control).toBe(true);
	expect(judgePrompt?.prompt).toContain('historical_grounding');
	expect(judgePrompt?.prompt).toContain('period_discipline');
	expect(judgePrompt?.prompt).toContain('"control":true');
	expect(judgePrompt?.prompt).toContain('"reasoning_effort":"xhigh"');
	expect(judgePrompt?.prompt).toContain('Submitted answer');
});

test('jsonl helpers round trip prompt records', () => {
	const records = candidatePromptRecords().slice(0, 2);
	const parsed = parseJsonl(renderJsonl(records));

	expect(parsed).toEqual(records);
});

test('score aggregation requires full coverage to pass', () => {
	const incomplete = scoreJudgeRecords([
		{
			question_id: 'metropolitan-history-centralization',
			scores: {
				classical_register: 5,
				historical_grounding: 5,
				period_discipline: 5,
				question_responsiveness: 5,
				statecraft_reasoning: 5,
			},
		},
	]);

	expect(incomplete.passed).toBe(false);
	expect(incomplete.band).toBe('incomplete');
	expect(incomplete.missing_question_ids).toContain(
		'metropolitan-history-frontier-policy'
	);
});

test('score aggregation produces a passing rank band', () => {
	const records = MANDARIN_BENCH.questions.map(question => ({
		question_id: question.id,
		scores: {
			classical_register: 4,
			historical_grounding: 4,
			period_discipline: 4,
			question_responsiveness: 4,
			statecraft_reasoning: 4,
		},
	}));

	const score = scoreJudgeRecords(records);

	expect(score.passed).toBe(true);
	expect(score.percent).toBe(80);
	expect(score.band).toBe('jinshi-second-class');
	expect(score.per_question).toHaveLength(MANDARIN_BENCH.questions.length);
});

test('OpenAI reasoning efforts include xhigh juice', () => {
	expect(DEFAULT_OPENAI_CONCURRENCY).toBe(4);
	expect(DEFAULT_OPENAI_TIMEOUT_MS).toBe(900_000);
	expect(DEFAULT_OPENAI_JUDGE_MODEL).toBe('gpt-5.5');
	expect(DEFAULT_OPENAI_JUDGE_EFFORT).toBe('medium');
	expect(DEFAULT_REASONING_EFFORTS).toEqual([
		'none',
		'minimal',
		'low',
		'medium',
		'high',
		'xhigh',
	]);
	expect(parseReasoningEfforts('low,xhigh')).toEqual(['low', 'xhigh']);
});

test('OpenAI runner respects bounded concurrency and adds run indexes', async () => {
	let active = 0;
	let maxActive = 0;
	const results: unknown[] = [];
	const client = new OpenAIClient({
		apiKey: 'test-key',
		fetch: async () => {
			active++;
			maxActive = Math.max(maxActive, active);
			await new Promise(resolve => setTimeout(resolve, 5));
			active--;
			return new Response(
				JSON.stringify({
					output_text: '臣对：',
					status: 'completed',
				})
			);
		},
	});

	await runOpenAICombinations(
		client,
		buildOpenAICombinations({
			efforts: ['low', 'xhigh'],
			models: ['gpt-example-a', 'gpt-example-b'],
			prompts: candidatePromptRecords().slice(0, 1),
		}),
		{
			concurrency: 2,
			onResult: result => results.push(result),
		}
	);

	expect(maxActive).toBe(2);
	expect(results).toHaveLength(4);
	expect(results).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				planned_count: 4,
				run_index: 1,
			}),
			expect.objectContaining({
				planned_count: 4,
				run_index: 4,
			}),
		])
	);
});

test('OpenAI effort none omits the reasoning parameter', async () => {
	const bodies: unknown[] = [];
	const client = new OpenAIClient({
		apiKey: 'test-key',
		fetch: async (_input, init) => {
			bodies.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({ output_text: '臣对：' }));
		},
	});
	const [none, high] = buildOpenAICombinations({
		efforts: ['none', 'high'],
		models: ['gpt-example'],
		prompts: candidatePromptRecords().slice(0, 1),
	});

	await client.createResponse(none!);
	await client.createResponse(high!);

	expect(bodies[0]).not.toHaveProperty('reasoning');
	expect(bodies[1]).toHaveProperty('reasoning.effort', 'high');
});

test('OpenAI client times out slow requests', async () => {
	const client = new OpenAIClient({
		apiKey: 'test-key',
		fetch: async (_input, init) =>
			new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => {
					reject(init.signal?.reason);
				});
			}),
		timeoutMs: 1,
	});

	await expect(client.listModels()).rejects.toThrow(
		'OpenAI request timed out after 1ms'
	);
});

test('OpenAI combination builder sweeps models, efforts, and questions', () => {
	const combinations = buildOpenAICombinations({
		efforts: ['low', 'xhigh'],
		models: ['gpt-example-a', 'gpt-example-b'],
		prompts: candidatePromptRecords().slice(0, 2),
	});

	expect(combinations).toHaveLength(8);
	expect(combinations[0]).toMatchObject({
		model: 'gpt-example-a',
		question_id: 'metropolitan-history-centralization',
		reasoning_effort: 'low',
	});
	expect(combinations.at(-1)).toMatchObject({
		model: 'gpt-example-b',
		question_id: 'metropolitan-history-frontier-policy',
		reasoning_effort: 'xhigh',
	});
});

test('OpenAI resume filtering skips completed model effort questions', () => {
	const combinations = buildOpenAICombinations({
		efforts: ['low', 'medium'],
		models: ['gpt-example-a', 'gpt-example-b'],
		prompts: candidatePromptRecords().slice(0, 1),
	});

	expect(
		filterExistingOpenAICombinations(combinations, [
			{
				model: 'gpt-example-a',
				question_id: 'metropolitan-history-centralization',
				reasoning_effort: 'low',
			},
		])
	).toEqual([
		expect.objectContaining({
			model: 'gpt-example-a',
			reasoning_effort: 'medium',
		}),
		expect.objectContaining({
			model: 'gpt-example-b',
			reasoning_effort: 'low',
		}),
		expect.objectContaining({
			model: 'gpt-example-b',
			reasoning_effort: 'medium',
		}),
	]);
});

test('OpenAI retry filtering drops transient errors before resume matching', () => {
	const rows = [
		{
			model: 'gpt-example-a',
			ok: true,
			question_id: 'metropolitan-history-centralization',
			reasoning_effort: 'low',
		},
		{
			error: {
				code: 'insufficient_quota',
				message: 'You exceeded your current quota.',
			},
			model: 'gpt-example-b',
			ok: false,
			question_id: 'metropolitan-history-centralization',
			reasoning_effort: 'low',
		},
		{
			error: {
				message: 'OpenAI request timed out after 180000ms',
			},
			model: 'gpt-example-c',
			ok: false,
			question_id: 'metropolitan-history-centralization',
			reasoning_effort: 'medium',
		},
	];

	expect(openAIResultErrorLabels(rows[1])).toEqual([
		'insufficient_quota',
		'You exceeded your current quota.',
	]);
	expect(filterRetryableOpenAIRecords(rows, TRANSIENT_OPENAI_ERROR_MATCHERS)).toEqual([
		rows[0],
	]);
});

test('OpenAI judge parser accepts fenced score JSON', () => {
	const judgement = {
		control: true,
		model: 'gpt-example',
		notes: 'solid',
		question_id: 'metropolitan-history-centralization',
		reasoning_effort: 'low',
		scores: {
			classical_register: 5,
			historical_grounding: 4,
			period_discipline: 4,
			question_responsiveness: 3,
			statecraft_reasoning: 4,
		},
	};

	expect(parseJudgeScoreText(`\`\`\`json\n${JSON.stringify(judgement)}\n\`\`\``)).toEqual(
		judgement
	);
});

test('OpenAI judge runner uses the configured medium judge model', async () => {
	const bodies: unknown[] = [];
	const results: unknown[] = [];
	const client = new OpenAIClient({
		apiKey: 'test-key',
		fetch: async (_input, init) => {
			bodies.push(JSON.parse(String(init?.body)));
			return new Response(
				JSON.stringify({
					output_text: JSON.stringify({
						model: 'gpt-example',
						notes: 'pass',
						question_id: 'metropolitan-history-centralization',
						reasoning_effort: 'medium',
						scores: {
							classical_register: 4,
							historical_grounding: 4,
							period_discipline: 4,
							question_responsiveness: 4,
							statecraft_reasoning: 4,
						},
					}),
					status: 'completed',
				})
			);
		},
	});

	await runOpenAIJudgePrompts(
		client,
		judgePromptRecords([
			{
				answer: '臣对：治道贵实。',
				control: true,
				model: 'gpt-example',
				question_id: 'metropolitan-history-centralization',
				reasoning_effort: 'medium',
			},
		]),
		{
			judgeEffort: DEFAULT_OPENAI_JUDGE_EFFORT,
			judgeModel: DEFAULT_OPENAI_JUDGE_MODEL,
			onResult: result => results.push(result),
		}
	);

	expect(bodies[0]).toMatchObject({
		model: 'gpt-5.5',
		reasoning: {
			effort: 'medium',
		},
	});
	expect(results[0]).toMatchObject({
		control: true,
		judge_model: 'gpt-5.5',
		judge_reasoning_effort: 'medium',
		model: 'gpt-example',
		ok: true,
		planned_count: 1,
		reasoning_effort: 'medium',
		run_index: 1,
	});
});

test('OpenAI judge resume filtering skips completed judgement rows', () => {
	const prompts = judgePromptRecords([
		{
			answer: '臣对：治道贵实。',
			model: 'gpt-example',
			question_id: 'metropolitan-history-centralization',
			reasoning_effort: 'medium',
		},
		{
			answer: '臣对：治道贵实。',
			model: 'gpt-example',
			question_id: 'metropolitan-history-frontier-policy',
			reasoning_effort: 'medium',
		},
	]);

	expect(
		filterExistingOpenAIJudgePrompts(
			prompts,
			[
				{
					judge_model: DEFAULT_OPENAI_JUDGE_MODEL,
					judge_reasoning_effort: DEFAULT_OPENAI_JUDGE_EFFORT,
					model: 'gpt-example',
					question_id: 'metropolitan-history-centralization',
					reasoning_effort: 'medium',
				},
			],
			{
				judgeEffort: DEFAULT_OPENAI_JUDGE_EFFORT,
				judgeModel: DEFAULT_OPENAI_JUDGE_MODEL,
			}
		)
	).toEqual([
		expect.objectContaining({
			question_id: 'metropolitan-history-frontier-policy',
		}),
	]);
});

test('OpenAI output text extraction supports response output arrays', () => {
	expect(
		extractOpenAIOutputText({
			output: [
				{
					content: [
						{
							text: '臣对：',
							type: 'output_text',
						},
						{
							text: '治道贵实。',
							type: 'output_text',
						},
					],
					type: 'message',
				},
			],
		})
	).toBe('臣对：\n治道贵实。');
});

test('OpenAI result filtering keeps successful answers for judging', () => {
	const records = answerRecordsFromOpenAIResults([
		{
			answer: '臣对：',
			control: true,
			model: 'gpt-example',
			ok: true,
			question_id: 'metropolitan-history-centralization',
		},
		{
			error: { message: 'unsupported reasoning effort' },
			model: 'gpt-example',
			ok: false,
			question_id: 'metropolitan-history-centralization',
		},
	]);

	expect(records).toEqual([
		{
			answer: '臣对：',
			control: true,
			model: 'gpt-example',
			ok: true,
			question_id: 'metropolitan-history-centralization',
		},
	]);
});

test('OpenAI results CSV is graph-friendly', () => {
	const csv = openAIResultsCsv([
		{
			answer: '臣对：治道贵实。',
			benchmark_id: MANDARIN_BENCH.id,
			control: true,
			duration_ms: 123.4,
			model: 'gpt-example',
			ok: true,
			planned_count: 2,
			question_id: 'metropolitan-history-centralization',
			reasoning_effort: 'xhigh',
			response_id: 'resp_123',
			run_index: 1,
			status: 'completed',
			title: 'Dynastic Center And Periphery',
			usage: {
				input_tokens: 10,
				output_tokens: 20,
				output_tokens_details: {
					reasoning_tokens: 5,
				},
				total_tokens: 30,
			},
		},
	]);

	expect(csv.split('\n')[0]).toContain('model,reasoning_effort,control,question_id');
	expect(csv).toContain('mandarin-bench-1904-jiachen-enke,1,2,gpt-example,xhigh,true');
	expect(csv).toContain(',123.4,');
	expect(csv).toContain(',8,');
});

test('static metadata CSVs include benchmark analysis context', () => {
	expect(questionsCsv()).toContain(
		'benchmark_id,question_id,order,stage,kind,title'
	);
	expect(questionsCsv()).toContain('palace-policy-final-edict');
	expect(sourcesCsv()).toContain('source_id,title,url,note');
	expect(sourcesCsv()).toContain('npm-1904-title-register');
	expect(criteriaCsv()).toContain('criterion_id,label');
	expect(criteriaCsv()).toContain('statecraft_reasoning,Statecraft Reasoning');
});

test('judge and score CSV include model-effort aggregates', () => {
	const judgements = MANDARIN_BENCH.questions.map(question => ({
		control: true,
		model: 'gpt-example',
		question_id: question.id,
		reasoning_effort: 'xhigh',
		scores: {
			classical_register: 4,
			historical_grounding: 4,
			period_discipline: 4,
			question_responsiveness: 4,
			statecraft_reasoning: 4,
		},
	}));

	const detailCsv = judgeScoresCsv(judgements);
	const summaryCsv = scoreSummaryCsv(judgements);

	expect(detailCsv).toContain(
		'model,reasoning_effort,control,judge_model,judge_reasoning_effort,question_id'
	);
	expect(detailCsv).toContain('gpt-example,xhigh,true');
	expect(summaryCsv).toContain('control,coverage,score,max_score,percent,passed,band');
	expect(summaryCsv).toContain(
		'gpt-example,xhigh,true,1,280,350,80,true,jinshi-second-class'
	);
});
