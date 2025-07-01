"use client";
import { createParser, parseAsBoolean, useQueryState } from "nuqs";
import { MouseEvent, useCallback, useId, useMemo } from "react";

import Link from "#root/project/zemn.me/components/Link/index.js";
import { elasticTabstops } from "#root/ts/text/tabwriter/tabwriter.js";

const columnsInStringRow = (s: string) =>
	[...s].map(v => v === '\t' ? 4 : 1)
		.reduce((a, b) => a + b, 0);

const exampleText = `\
 grid:
    " employer employer . start dash end " min-content
    " position position . duration duration duration " min-content
    " . . . . . . " .1em
    " . content content . . . " min-content
    " . . . . . . " 1em
    / 1em 1fr 1em 4.5em 2em 4em;\
`

const rowsColumns = (s: string) => {
	const lines = s.split('\n');
	const rows = lines.length;
	const columns = Math.max(...lines.map(line => columnsInStringRow(line)));
	return [rows, columns]
}

const stringWithNL = createParser({
	parse(queryValue) {
		return decodeURIComponent(queryValue)
	},
	serialize(value) {
		return encodeURIComponent(value)
	}
})

function stretchDots(s: string) {
	// .      |
	// becomes...
	// ...... |

	return s.replace(
		/(?<= |^)\.+ +/g,
		match =>
			match.slice(0, -1).replaceAll(/./g, '.') + ' '
	)
}

/**
 * Replace all runs of spaces with a tab character.
 */
const collapseSpaces = (s: string) => s.replace(/ +/g, '\t');

export default function ElasticTabStopsClient() {
	const [input, setInput] = useQueryState<string>("input", stringWithNL.withDefault(''));
	const [collapseSpacesFlag, setCollapseSpacesFlag] = useQueryState<boolean>("collapseSpaces", parseAsBoolean.withDefault(false));

	const [stretchDot, setStretchDot] = useQueryState<boolean>("stretchDot", parseAsBoolean.withDefault(false));
	const stretchDotId = useId();
	const inputId = useId();
	const collapseSpacesInputId = useId();
	const inputIds = [stretchDotId, collapseSpacesInputId, inputId]

	const [
		output,
		[outputRows, outputColumns],
		[inputRows, inputColumns]
	] = useMemo(() => {
		let v = input;
		if (collapseSpacesFlag) v = collapseSpaces(v);
		let output = elasticTabstops(v);

		if (stretchDot) output = stretchDots(output);

		const inputRowsColumns = rowsColumns(input);
		const outputRowsColumns = rowsColumns(output);

		return [
			output,
			outputRowsColumns,
			inputRowsColumns
		]
	}, [input, collapseSpacesFlag, stretchDot]);

	const handleTab = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key !== "Tab") return;

			e.preventDefault();

			const el = e.currentTarget;
			const { selectionStart: start, selectionEnd: end } = el;

			void setInput(prev => {
				const next = prev.slice(0, start) + "\t" + prev.slice(end);

				// put the caret just after the tab once React has updated the value
				requestAnimationFrame(() => {
					el.selectionStart = el.selectionEnd = start + 1;
				});

				return next;
			});
		},
		[]
	);

	const onExampleButtonClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
		void setInput(exampleText);
		void setStretchDot(true);
		void setCollapseSpacesFlag(true);
		e.preventDefault();
	}, [setInput, setStretchDot, setCollapseSpacesFlag]);


	return (
		<>
			<h1>Elastic Tabstops Online</h1>
			<p>
				This client implements the <Link href="https://nick-gravgaard.com/elastic-tabstops/">Elastic Tabstops algorithm</Link> via a machine transation of the <Link href="https://pkg.go.dev/text/tabwriter">Go implementation (OpenAI o3)</Link> to TypeScript.
			</p>

			<p>
				Click <button onClick={onExampleButtonClick}>here</button> for an example.
			</p>
			<form >
				<label htmlFor={stretchDotId} style={{
					display: 'block',
				}}>
					<input checked={stretchDot} id={stretchDotId} onChange={e => void setStretchDot(e.target.checked)} type="checkbox" />
					make the '.' character stretch up to the end of the column (this is canonical form for CSS grid templates)</label>

				<label htmlFor={collapseSpacesInputId} style={{
					display: 'block',
				}}>
					<input checked={collapseSpacesFlag} id={collapseSpacesInputId} onChange={e => void setCollapseSpacesFlag(e.target.checked)} type="checkbox" />
					Collapse spaces to tabs</label>
				<textarea cols={inputColumns} id={inputId} onChange={e => void setInput(e.target.value)} onKeyDown={handleTab} placeholder="input" rows={inputRows} style={{
					display: 'block',
				}} value={input} />

				<output htmlFor={inputIds.join(' ')}>
					<textarea cols={outputColumns} disabled placeholder="output" rows={outputRows} style={{
						display: 'block',
					}} value={output} />
				</output>
			</form>
		</>
	);
}
