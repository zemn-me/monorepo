import { JSONObject, JSONValue } from '#root/ts/json.js';

export interface Props {
	readonly value: JSONValue;
	readonly depth?: number;
	readonly expandToDepth?: number;
	readonly path?: string[];
}

export const PrettyJSON: React.FC<Props> = function PrettyJSON({
	value,
	depth = 0,
	expandToDepth = 0,
	path = [],
}: Props) {
	if (typeof value == 'string') {
		return <>value</>;
	}

	if (typeof value == 'number') {
		return <>value.toString()</>;
	}

	if (typeof value == 'boolean') {
		return <>value ? 'true' : 'false'</>;
	}

	if (typeof value == 'undefined') {
		return null;
	}

	if (value == null) {
		return <>'null'</>;
	}

	if (value instanceof Array) {
		return (
			<ol>
				{value.map((v, i) => (
					<li
						key={i}
						title={[i.toString(), ...path].reverse().join('.')}
					>
						<PrettyJSON
							depth={depth + 1}
							path={[i.toString(), ...path]}
							value={v}
						/>
					</li>
				))}
			</ol>
		);
	}

	const v: JSONObject = value;

	return (
		<>
			{Object.entries(v).map(([k, v]) => (
				<dl key={k} title={[k, ...path].reverse().join('.')}>
					<details>
						{/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
						<summary {...({ open: depth < expandToDepth } as any)}>
							<dt>
								<PrettyJSON
									depth={depth + 1}
									path={path}
									value={k}
								/>
							</dt>
						</summary>
						<dd>
							<PrettyJSON
								depth={depth + 1}
								path={[k, ...path]}
								value={v}
							/>
						</dd>
					</details>
				</dl>
			))}
		</>
	);
};
