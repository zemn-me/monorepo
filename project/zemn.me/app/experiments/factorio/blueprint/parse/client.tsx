'use client';
import { parseAsString, useQueryState } from 'nuqs';
import { ChangeEvent, useCallback, useId } from 'react';

import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { BlueprintString } from '#root/ts/factorio/blueprint_string.js';
import { DisplayBlueprintWrapper } from '#root/ts/factorio/react/blueprint.js';
import { Some } from '#root/ts/option/option.js';
import { CopyToClipboard } from '#root/ts/react/CopyToClipboard/CopyToClipboard.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import { PrettyJSON } from '#root/ts/react/PrettyJSON/pretty_json.js';
import { resultFromZod } from '#root/ts/zod/util.js';

export function Client() {
	const [input, setInput] = useQueryState<string>("blueprint", parseAsString.withDefault(''));
	const b64InputLabel = useId();
	const outputLabel = useId();
	const inputsString = [b64InputLabel].join(' ');

	const onBlueprintChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) =>
		void setInput(e.target.value), [setInput]);

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
								onChange={onBlueprintChange}
								style={{ display: 'block' }}
							/>
						</label>
					</li>


					<output htmlFor={inputsString}>
						{Some(input).and_then(input =>
							resultFromZod(BlueprintString.safeParse(input))
								.and_then(output =>

								<>
									<li>
										<label htmlFor={outputLabel}>
											Blueprint:
											<output
												htmlFor={inputsString}
												id={outputLabel}
											>
												<DisplayBlueprintWrapper
													wrapper={output}
												/>
											</output>
										</label>
									</li>
									<li>
										JSON{' '}
										<CopyToClipboard
											text={() => JSON.stringify(output)}
										/>
										<PrettyJSON value={output} />
									</li>
								</>
							).unwrap_or_else(e => <ErrorDisplay error={e} />)).unwrap_or(<>Please input a blueprint. </>)}
					</output>
				</ul>
			</form>
		</Prose>
	);
}
