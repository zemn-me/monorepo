'use client';
import { useId, useState } from 'react';

import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { ParseBlueprintString } from '#root/ts/factorio/blueprint_string.js';
import { DisplayBlueprintWrapper } from '#root/ts/factorio/react/blueprint.js';
import { Option } from '#root/ts/option.js';
import { CopyToClipboard } from '#root/ts/react/CopyToClipboard/CopyToClipboard.js';
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

	const bw = ResultSequence(input).then(v =>
		safelyParseBlueprintString(v)
	).result;

	return (
		<Prose>
			<h1>Factorio Blueprint Parser</h1>
			<p>
				This little experiment parses the Factorio blueprint format so
				you can mess around with it.
			</p>
			<p>
				Note that it does not <i>validate</i> Factorio blueprints at
				all.
			</p>
			<form>
				<ul>
					<li>
						<label htmlFor={b64InputLabel}>
							Factorio blueprint (base64):{' '}
							<textarea
								id={b64InputLabel}
								onChange={e =>
									setInput({ [Ok]: e.target.value })
								}
								style={{ display: 'block' }}
							/>
						</label>
					</li>

					{Err in bw && bw[Err] !== undefined ? (
						<li>
							<label htmlFor={errorsLabel}>
								Errors occurred:{' '}
								<output htmlFor={inputsString} id={errorsLabel}>
									<ErrorDisplay error={bw[Err]} />
								</output>
							</label>
						</li>
					) : null}

					{Ok in bw ? (
						<>
							<li>
								<label htmlFor={outputLabel}>
									Blueprint:
									<output
										htmlFor={inputsString}
										id={outputLabel}
									>
										<DisplayBlueprintWrapper
											wrapper={bw[Ok]}
										/>
									</output>
								</label>
							</li>
							<li>
								JSON{' '}
								<CopyToClipboard
									text={JSON.stringify(bw[Ok])}
								/>
								<PrettyJSON value={bw[Ok]} />
							</li>
						</>
					) : null}
				</ul>
			</form>
		</Prose>
	);
}
