'use client';

import { useMemo, useState } from 'react';

import {
	resolveText,
	Text,
	TextSelection,
	text,
	useLocale,
} from '#root/ts/react/lang/index.js';
import { LocalizedText } from '#root/ts/react/lang/LocalizedText.js';

import chartData from './chart_data.json';

const questionColours = [
	'#4e79a7',
	'#f28e2b',
	'#e15759',
	'#76b7b2',
	'#59a14f',
	'#edc949',
	'#af7aa1',
	'#ff9da7',
	'#9c755f',
	'#bab0ac',
	'#1f77b4',
	'#ff7f0e',
	'#2ca02c',
	'#d62728',
] as const;

type QuestionResult = {
	readonly answer: string;
	readonly questionId: string;
	readonly scores: Record<string, number>;
	readonly title: string;
	readonly totalScore: number;
};

type ChartRow = {
	readonly answeredQuestions: number;
	readonly band: string;
	readonly judge: string;
	readonly model: string;
	readonly passed: boolean;
	readonly percent: number;
	readonly questions: readonly QuestionResult[];
	readonly rank: number;
	readonly reasoningEffort: string;
	readonly score: number;
};

type ChartData = {
	readonly criteria: readonly { readonly id: string; readonly label: string }[];
	readonly maxScore: number;
	readonly questionCount: number;
	readonly rows: readonly ChartRow[];
};

type ActiveCell = {
	readonly questionIndex: number;
	readonly rowIndex: number;
};

const data = chartData as ChartData;

const chartAlt = TextSelection(
	Text(
		'en-GB',
		'Full Mandarin Bench results chart, with ranked model submissions and stacked question-score bars.'
	),
	Text(
		'zh',
		'華文衡鑑完整結果圖，按名次排列模型答卷，並以堆疊長條顯示各題得分。'
	)
);

const chartCaption = TextSelection(
	Text(
		'en-GB',
		'Hover, focus, click, or tap a score segment to inspect its answer and rubric score.'
	),
	Text(
		'zh',
		'滑過、聚焦、點擊或輕觸得分分段，即可查看該題答案與評分。'
	)
);

function activeCellId(cell: ActiveCell): string {
	return `${cell.rowIndex}:${cell.questionIndex}`;
}

function answerPreview(answer: string): string {
	const compact = answer.replaceAll(/\s+/g, ' ').trim();
	return compact.length <= 800 ? compact : `${compact.slice(0, 800)}...`;
}

export function MandarinBenchChart() {
	const languages = useLocale();
	const alt = text(resolveText(chartAlt, languages));
	const [active, setActive] = useState<ActiveCell | undefined>();
	const activeQuestion = active
		? data.rows[active.rowIndex]?.questions[active.questionIndex]
		: undefined;
	const activeRow = active ? data.rows[active.rowIndex] : undefined;
	const scoreBreakdown = useMemo(() => {
		if (activeQuestion === undefined) return [];
		return data.criteria.map(criterion => ({
			label: criterion.label,
			score: activeQuestion.scores[criterion.id] ?? 0,
		}));
	}, [activeQuestion]);

	const width = 1500;
	const rowHeight = 24;
	const headerHeight = 136;
	const footer = 28;
	const height = Math.max(240, headerHeight + data.rows.length * rowHeight + footer);
	const barX = 500;
	const barWidth = 330;
	const passX = barX + 0.7 * barWidth;

	return (
		<figure
			style={{
				gridColumn: '1 / -1',
				margin: '2rem 0',
			}}
		>
			<div style={{ overflowX: 'auto' }}>
				<svg
					aria-label={alt}
					role="img"
					viewBox={`0 0 ${width} ${height}`}
					style={{
						display: 'block',
						inlineSize: '100%',
						minInlineSize: '1120px',
					}}
				>
					<rect width={width} height={height} fill="#ffffff" />
					<text
						x="32"
						y="34"
						fill="#111827"
						fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
						fontSize="22"
						fontWeight="700"
					>
						Full Mandarin Bench results
					</text>
					<text
						x="32"
						y="58"
						fill="#4b5563"
						fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
						fontSize="13"
					>
						{data.rows.length} complete submissions; stacked bars split each
						total into Q1-Q{data.questionCount} score contributions.
					</text>
					{questionColours.map((fill, index) => (
						<g
							key={`legend-${index}`}
							transform={`translate(${32 + index * 54}, 76)`}
						>
							<rect width="12" height="12" rx="2" fill={fill} />
							<text
								x="18"
								y="11"
								fill="#374151"
								fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
								fontSize="11"
							>
								Q{index + 1}
							</text>
						</g>
					))}
					{[
						['rank', 32, 'start'],
						['model', 74, 'start'],
						['effort', 410, 'start'],
						['score', 488, 'end'],
						['question score segments', 500, 'start'],
						['%', 850, 'end'],
						['result', 922, 'start'],
						['class', 1010, 'start'],
						['answers', 1238, 'end'],
						['judge', 1300, 'start'],
					].map(([label, x, textAnchor]) => (
						<text
							key={label}
							x={x}
							y="126"
							fill="#374151"
							fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
							fontSize="12"
							fontWeight="700"
							textAnchor={textAnchor}
						>
							{label}
						</text>
					))}
					<line
						x1="24"
						x2="1476"
						y1="136"
						y2="136"
						stroke="#d1d5db"
						strokeWidth="1"
					/>
					<line
						x1={passX}
						x2={passX}
						y1="140"
						y2={height - 20}
						stroke="#111827"
						strokeDasharray="5 5"
						strokeWidth="1"
					/>
					<text
						x={passX + 7}
						y="150"
						fill="#111827"
						fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
						fontSize="10"
					>
						pass line 70%
					</text>
					{data.rows.map((row, rowIndex) => {
						const y = 166 + rowIndex * rowHeight;
						let segmentOffset = 0;

						return (
							<g key={`${row.model}-${row.reasoningEffort}`}>
								<rect
									x="24"
									y={y - 16}
									width="1452"
									height="22"
									fill={rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'}
								/>
								<text x="32" y={y} fill="#111827" fontSize="12">
									{row.rank}
								</text>
								<text
									x="74"
									y={y}
									fill="#111827"
									fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
									fontSize="12"
								>
									{row.model}
								</text>
								<text x="410" y={y} fill="#374151" fontSize="12">
									{row.reasoningEffort}
								</text>
								<text
									x="488"
									y={y}
									fill="#374151"
									fontSize="12"
									textAnchor="end"
								>
									{row.score}/{data.maxScore}
								</text>
								<rect
									x={barX}
									y={y - 11}
									width={barWidth}
									height="10"
									rx="2"
									fill="#f3f4f6"
								/>
								{row.questions.map((question, questionIndex) => {
									const segmentWidth =
										(question.totalScore / data.maxScore) * barWidth;
									const x = barX + segmentOffset;
									segmentOffset += segmentWidth;
									const cell = { questionIndex, rowIndex };
									const selected =
										active !== undefined &&
										activeCellId(active) === activeCellId(cell);

									return (
										<rect
											key={question.questionId}
											aria-label={`${row.model} ${row.reasoningEffort} Q${
												questionIndex + 1
											}: ${question.totalScore}/25`}
											role="button"
											tabIndex={0}
											x={x}
											y={y - 11}
											width={Math.max(segmentWidth, 1)}
											height="10"
											rx={
												questionIndex === 0 ||
												questionIndex === row.questions.length - 1
													? '2'
													: '0'
											}
											fill={questionColours[questionIndex]}
											stroke={selected ? '#111827' : '#ffffff'}
											strokeWidth={selected ? '1.5' : '0.35'}
											style={{ cursor: 'pointer' }}
											onBlur={() => setActive(undefined)}
											onClick={() => setActive(cell)}
											onFocus={() => setActive(cell)}
											onMouseEnter={() => setActive(cell)}
											onMouseLeave={() => setActive(undefined)}
										/>
									);
								})}
								<text
									x="850"
									y={y}
									fill="#374151"
									fontSize="12"
									textAnchor="end"
								>
									{row.percent.toFixed(1)}%
								</text>
								<text
									x="922"
									y={y}
									fill={row.passed ? '#166534' : '#991b1b'}
									fontSize="12"
									fontWeight="700"
								>
									{row.passed ? 'passed' : 'failed'}
								</text>
								<text
									x="1010"
									y={y}
									fill="#374151"
									fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
									fontSize="11"
								>
									{row.band}
								</text>
								<text
									x="1238"
									y={y}
									fill="#374151"
									fontSize="12"
									textAnchor="end"
								>
									{row.answeredQuestions}/{data.questionCount}
								</text>
								<text
									x="1300"
									y={y}
									fill="#374151"
									fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
									fontSize="11"
								>
									{row.judge}
								</text>
							</g>
						);
					})}
				</svg>
			</div>
			<figcaption>
				<LocalizedText>{chartCaption}</LocalizedText>
			</figcaption>
			{activeQuestion && activeRow ? (
				<aside
					aria-live="polite"
					style={{
						border: '1px solid #d1d5db',
						marginBlockStart: '0.75rem',
						padding: '0.75rem',
					}}
				>
					<strong>
						{activeRow.model} {activeRow.reasoningEffort} /{' '}
						{activeQuestion.title}: {activeQuestion.totalScore}/25
					</strong>
					<div style={{ color: '#4b5563', marginBlockStart: '0.35rem' }}>
						{scoreBreakdown
							.map(item => `${item.label}: ${item.score}/5`)
							.join(' · ')}
					</div>
					<p style={{ marginBlockEnd: 0 }}>{answerPreview(activeQuestion.answer)}</p>
				</aside>
			) : null}
		</figure>
	);
}
