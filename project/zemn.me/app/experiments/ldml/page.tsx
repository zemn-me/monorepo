'use client';

import { useMemo, useState } from 'react';

import style from './page.module.css';

import {
	FieldSymbol,
	LDMLFieldToken,
	LDMLLiteralToken,
	LDMLToken,
	LDML_FIELDS,
	LDML_SYMBOLS,
	LDMLSyntaxError,
	compileLDML,
	createFieldToken,
	createLiteralToken,
	parseLDML,
} from '#root/ts/ldml/index.js';
import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';

const DEFAULT_PATTERN = "yyyy-MM-dd'T'HH:mm:ss";

const toAllowedLengths = (symbol: FieldSymbol): readonly number[] => {
	const definition = LDML_FIELDS[symbol];
	if (definition.allowedLengths) {
		return definition.allowedLengths;
	}
	const values: number[] = [];
	for (let length = definition.minLength; length <= definition.maxLength; length += 1) {
		values.push(length);
	}
	return values;
};

const formatLiteralPreview = (token: LDMLLiteralToken): string =>
	token.value === ''
		? '(empty)'
		: token.quoted
			? `'${token.value.replace(/'/g, "''")}'`
			: token.value;

type ParseState =
	| {
			readonly ok: true;
			readonly tokens: readonly LDMLToken[];
	  }
	| {
			readonly ok: false;
			readonly error: LDMLSyntaxError | Error;
	  };

function parsePattern(pattern: string): ParseState {
	try {
		const tokens = parseLDML(pattern);
		return { ok: true, tokens };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof LDMLSyntaxError ? error : new LDMLSyntaxError(String(error)),
		};
	}
}

export default function LDMLPlayground() {
	const [pattern, setPattern] = useState(DEFAULT_PATTERN);
	const [symbol, setSymbol] = useState<FieldSymbol>('y');
	const [length, setLength] = useState<number>(4);
	const [literalDraft, setLiteralDraft] = useState('');

	const symbolOptions = useMemo<readonly FieldSymbol[]>(
		() => [...LDML_SYMBOLS].sort((a, b) => a.localeCompare(b)) as FieldSymbol[],
		[],
	);

	const parseState = useMemo(() => parsePattern(pattern), [pattern]);

	const definition = LDML_FIELDS[symbol];
	const allowedLengths = useMemo(() => toAllowedLengths(symbol), [symbol]);

	const lengthOptions = allowedLengths.map(value => ({
		value,
		label:
			definition.lengthInfo[value as keyof typeof definition.lengthInfo]?.summary ??
			definition.fallback?.summary ??
			'',
	}));

	const handleSymbolChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const nextSymbol = event.target.value as FieldSymbol;
		setSymbol(nextSymbol);
		const options = toAllowedLengths(nextSymbol);
		setLength(options[0] ?? 1);
	};

	const handleLengthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setLength(Number(event.target.value));
	};

	const appendTokens = (tokens: readonly LDMLToken[]) => {
		const suffix = tokens.map(token => token.raw).join('');
		setPattern(current => `${current}${suffix}`);
	};

	const handleAddField = () => {
		appendTokens([createFieldToken(symbol, length as any)]);
	};

	const handleAddLiteral = () => {
		if (!literalDraft) {
			return;
		}
		const token = createLiteralToken(literalDraft);
		appendTokens([token]);
		setLiteralDraft('');
	};

	const handleRemoveToken = (index: number) => {
		if (!parseState.ok) {
			return;
		}
		const tokens = parseState.tokens.filter((_, idx) => idx !== index);
		setPattern(compileLDML(tokens));
	};

	const handleReset = () => setPattern(DEFAULT_PATTERN);

	const patternValue = pattern;

	return (
		<Prose className={style.root}>
			<h1>LDML pattern workbench</h1>
			<p>
				Load, inspect, and compose Unicode LDML date/time patterns with instant feedback. The parser honours the
				field definitions from <a href="https://unicode.org/reports/tr35" target="_blank" rel="noreferrer">UTS #35</a>{' '}
				and provides rich metadata for each symbol.
			</p>

			<section className={style.section}>
				<h2>Pattern</h2>
				<div className={style.patternInput}>
					<label>
						<span>Your LDML pattern</span>
						<textarea
							value={patternValue}
							onChange={event => setPattern(event.target.value)}
							spellCheck={false}
						/>
					</label>
				</div>
				<div className={style.buttons}>
					<button type="button" onClick={handleReset}>
						Reset to default
					</button>
					<button
						type="button"
						onClick={() => navigator.clipboard?.writeText(patternValue)}
					>
						Copy pattern
					</button>
				</div>
				{!parseState.ok && <p className={style.error}>{parseState.error.message}</p>}
			</section>

			<section className={style.section}>
				<h2>Token builder</h2>
				<div className={style.controls}>
					<label>
						<span>Symbol</span>
						<select value={symbol} onChange={handleSymbolChange}>
							{symbolOptions.map(value => {
								const meta = LDML_FIELDS[value];
								return (
									<option key={value} value={value}>
										{value} — {meta.category}
										{meta.deprecated ? ' (deprecated)' : ''}
										{meta.skeletonOnly ? ' (skeleton)' : ''}
									</option>
								);
							})}
						</select>
					</label>
					<label>
						<span>Length</span>
						<select value={length} onChange={handleLengthChange}>
							{lengthOptions.map(option => (
								<option key={option.value} value={option.value}>
									{option.value}{option.label ? ` — ${option.label}` : ''}
								</option>
							))}
						</select>
					</label>
					<button type="button" onClick={handleAddField}>
						Add field
					</button>
				</div>
				<div className={style.metadata}>
					<div>
						<strong>{symbol}</strong> • {definition.category}
					</div>
					<div>{definition.description}</div>
					{definition.deprecated && <span className={style.pill}>deprecated</span>}
					{definition.skeletonOnly && <span className={style.pill}>skeleton only</span>}
					<div className={style.definitionList}>
						{allowedLengths.map(value => {
							const info =
								definition.lengthInfo[value as keyof typeof definition.lengthInfo] ?? definition.fallback;
							return (
								<span className={style.definitionItem} key={value}>
									<span>{value}</span>
									<span>{info?.summary ?? 'unsupported'}</span>
								</span>
							);
						})}
					</div>
				</div>
				<div className={style.controls}>
					<label>
						<span>Literal</span>
						<input
							value={literalDraft}
							onChange={event => setLiteralDraft(event.target.value)}
							placeholder="Add literal text…"
						/>
					</label>
					<button type="button" onClick={handleAddLiteral} disabled={!literalDraft}>
						Add literal
					</button>
				</div>
			</section>

			<section className={style.section}>
				<h2>Tokens</h2>
				{parseState.ok && parseState.tokens.length > 0 ? (
					<table className={style.tokensTable}>
						<thead>
							<tr>
								<th>#</th>
								<th>Kind</th>
								<th>Raw</th>
								<th>Details</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{parseState.tokens.map((token, index) => {
								if (token.kind === 'field') {
									const fieldToken = token as LDMLFieldToken;
									return (
										<tr key={`${token.raw}-${index}`}>
											<td>{index + 1}</td>
											<td>
												Field{' '}
												<span className={style.pill}>
													{fieldToken.symbol} × {fieldToken.length}
												</span>
											</td>
											<td>{fieldToken.raw}</td>
											<td>
												<div>{fieldToken.definition.category}</div>
												<div>{fieldToken.presentation.summary}</div>
											</td>
											<td>
												<div className={style.tokenActions}>
													<button type="button" onClick={() => handleRemoveToken(index)}>
														Remove
													</button>
												</div>
											</td>
										</tr>
									);
								}
								const literal = token as LDMLLiteralToken;
								return (
									<tr key={`${literal.raw}-${index}`}>
										<td>{index + 1}</td>
										<td>Literal</td>
										<td>{formatLiteralPreview(literal)}</td>
										<td>{literal.quoted ? 'quoted literal' : 'inline literal'}</td>
										<td>
											<div className={style.tokenActions}>
												<button type="button" onClick={() => handleRemoveToken(index)}>
													Remove
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				) : parseState.ok ? (
					<p>No tokens yet—start building a pattern or paste one above.</p>
				) : (
					<p className={style.error}>{parseState.error.message}</p>
				)}
			</section>
		</Prose>
	);
}
