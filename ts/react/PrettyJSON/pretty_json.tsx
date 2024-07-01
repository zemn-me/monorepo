import { JSONObject, JSONValue } from '#root/ts/json';

export interface Props {
	readonly value: JSONValue;
	readonly depth?: number;
	readonly path?: string[];
	readonly visited?: Set<unknown>;
}

export const PrettyJSON: React.FC<Props> = function PrettyJSON({
	value,
	depth = 0,
	path = [],
	visited = new Set(),
}: Props) {
	if (visited.has(value)) {
		return <>↩ cycle</>;
	}

	if (depth > 5) return null;

	visited = new Set([...visited, value]);
	if (typeof value == 'string') {
		return <>{value}</>;
	}

	if (typeof value == 'number') {
		return <>{value.toString()}</>;
	}

	if (typeof value == 'boolean') {
		return <>{value ? 'true' : 'false'}</>;
	}

	if (typeof value == 'undefined') {
		return null;
	}

	if (value == null) {
		return <>null</>;
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
							visited={visited}
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
						{ }
						<summary>
							<dt>
								<PrettyJSON
									depth={depth + 1}
									path={path}
									value={k}
									visited={visited}
								/>
							</dt>
						</summary>
						<dd>
							<PrettyJSON
								depth={depth + 1}
								path={[k, ...path]}
								value={v}
								visited={visited}
							/>
						</dd>
					</details>
				</dl>
			))}
		</>
	);
};
