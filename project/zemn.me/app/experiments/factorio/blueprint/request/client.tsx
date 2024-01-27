'use client';
import { useId, useState } from 'react';

import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { ParseBlueprintString } from '#root/ts/factorio/blueprint_string.js';
import { Option } from '#root/ts/option.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import { PrettyJSON } from '#root/ts/react/PrettyJSON/pretty_json.js';
import { Err, Ok, ResultSequence } from '#root/ts/result.js';
import { safely } from '#root/ts/safely.js';

const safelyParseBlueprintString = safely(ParseBlueprintString);

function blueprintToRequesterChest(
	bp: Blueprint,
	minChests: number = 0
): Blueprint {
	const title = {
		item: 'blueprint',
		label: `Requester chest with all the ingredients for ${bp.label}`,
		version: bp.version,
	};

	return {
		...title,
		tiles: [],
		schedules: [],
	};
}

export function Client() {
	const [input, setInput] = useState<Option<string>>({ [Err]: undefined });
	const b64InputLabel = useId();
	const outputLabel = useId();
	const errorsLabel = useId();
	const inputsString = [b64InputLabel].join(' ');

	const inputBlueprint = new ResultSequence(input).then(v =>
		safelyParseBlueprintString(v)
	).result;

	return (
		<Prose>
			<h1>Requester Chest Maker</h1>
			<p>
				For a factorio blueprint, gives a factorio blueprint that has a
				requester chest including everything in that blueprint.
			</p>
			<form>
				<label htmlFor={b64InputLabel}>
					Factorio blueprint (base64):{' '}
					<textarea
						id={b64InputLabel}
						onChange={e => setInput({ [Ok]: e.target.value })}
					/>
				</label>

				{Err in stringifiedBlueprint &&
				stringifiedBlueprint[Err] !== undefined ? (
					<label htmlFor={errorsLabel}>
						Errors occurred:{' '}
						<output htmlFor={inputsString} id={errorsLabel}>
							<ErrorDisplay error={stringifiedBlueprint[Err]} />
						</output>
					</label>
				) : null}

				{Ok in stringifiedBlueprint ? (
					<label htmlFor={outputLabel}>
						Parsed JSON:
						<output htmlFor={inputsString} id={outputLabel}>
							<PrettyJSON value={stringifiedBlueprint[Ok]} />
						</output>
					</label>
				) : null}
			</form>
		</Prose>
	);
}
