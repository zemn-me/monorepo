'use client';
import { useId, useState } from 'react';

import { JSONObject } from '#root/ts/do-sync/doSync.js';
import { ParseBlueprintString } from '#root/ts/factorio/blueprint_string.js';
import { Option } from '#root/ts/option.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import { PrettyJSON } from '#root/ts/react/PrettyJSON/pretty_json.js';
import { Err, Ok, ResultSequence } from '#root/ts/result.js';
import { safely } from '#root/ts/safely.js';

const safelyParseBlueprintString = safely(ParseBlueprintString);

export function Client() {
	const [input, setInput] = useState<Option<string>>({ [Err]: undefined });
	const b64InputLabel = useId();
	const outputLabel = useId();
	const errorsLabel = useId();
	const inputsString = [b64InputLabel].join(' ');

	const stringifiedBlueprint = new ResultSequence(input).then(v =>
		safelyParseBlueprintString(v)
	).result;

	return (
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
	);
}
