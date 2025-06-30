"use client";
import { useCallback, useId, useMemo, useState } from "react";

import Link from "#root/project/zemn.me/components/Link/index.js";
import { elasticTabstops } from "#root/ts/text/tabwriter/tabwriter.js";

const columnsInStringRow = (s: string) =>
	[...s].map(v => v === '\t'? 4: 1)
	.reduce((a, b) => a + b, 0);

const rowsColumns = (s: string) => {
	const lines = s.split('\n');
	const rows = lines.length;
	const columns = Math.max(...lines.map(line => columnsInStringRow(line)));
	return [rows, columns]
}

export default function ElasticTabStopsClient() {
	const [ input, setInput ] = useState<string>('');
	const output = useMemo(() => elasticTabstops(input), [input])
	const id = useId();
	const [inputRows, inputColumns ] = useMemo(() => rowsColumns(input), [input]);
	const [outputRows, outputColumns ] = useMemo(() => rowsColumns(output), [output]);

	const handleTab = useCallback(
	(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key !== "Tab") return;

		e.preventDefault();

		const el = e.currentTarget;
		const { selectionStart: start, selectionEnd: end } = el;

		setInput(prev => {
		const next = prev.slice(0, start) + "\t" + prev.slice(end);

		// put the caret just after the tab once React has updated the value
		requestAnimationFrame(() => {
			el.selectionStart = el.selectionEnd = start + 1;
		});

		return next;
		});
	},
	[] // setInput is stable, so no dependencies needed
	);


	return (
	<>
		<h1>Elastic Tabstops Online</h1>
		<p>
			This client implements the <Link href="https://nick-gravgaard.com/elastic-tabstops/">Elastic Tabstops algorithm</Link> via a machine transation of the <Link href="https://pkg.go.dev/text/tabwriter">Go implementation (OpenAI o3)</Link> to TypeScript.
		</p>
		<form >
				<textarea cols={inputColumns} id={id} onChange={e => setInput(e.target.value)} onKeyDown={handleTab} placeholder="input" rows={inputRows} style={{
				display: 'block',
			}} value={input} />

			<output htmlFor={id}>
					<textarea cols={outputColumns} disabled placeholder="output" rows={outputRows} style={{
					display: 'block',
				}} value={output} />
			</output>
		</form>
	</>
	);
}
