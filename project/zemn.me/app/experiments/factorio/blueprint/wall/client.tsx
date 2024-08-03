'use client';
import { useId, useState } from 'react';

import Link from '#root/project/zemn.me/components/Link/Link.js';
import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { githubRepoUrl } from '#root/ts/constants/constants.js';
import {
	Blueprint,
	blueprintSurroundedByWall,
} from '#root/ts/factorio/blueprint.js';
import { BlueprintString } from '#root/ts/factorio/blueprint_string';
import { DisplayBlueprint } from '#root/ts/factorio/react/blueprint.js';
import { None, Option, Some } from '#root/ts/option/option.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import { Err, Ok, Result } from '#root/ts/result.js';
import { safely } from '#root/ts/safely.js';

const safelyParseBlueprintString = safely((s: string) =>
	BlueprintString.parse(s)
);

class ErrIsNan extends Error {
	constructor(input: string) {
		super(`${input} parses to NaN.`);
	}
}

class ParseIntError<Cause extends Error = Error> extends Error {
	override cause: Cause | undefined;
	constructor(input: string, cause: Cause) {
		super(`could not parse ${input} as number`, { cause });
		this.cause = cause;
	}
}

function ParseInt(i: string): Result<number, ParseIntError<ErrIsNan>> {
	const n = parseInt(i);
	if (isNaN(n)) return Err(new ParseIntError(i, new ErrIsNan(i)));

	return Ok(n);
}

class ErrBlueprintBook extends Error {
	constructor() {
		super('only works on bluerprints -- you gave a blueprint book.');
	}
}

export function Client() {
	const [blueprintString, setBlueprintString] =
		useState< Option<string>>(None);
	const [depth, setDepth] = useState<Option <string>>(Some("3"));
	const depthInputLabel = useId();
	const b64InputLabel = useId();
	const outputLabel = useId();
	const inputsString = [b64InputLabel, depthInputLabel].join(' ');

	const depthInt = depth.and_then(d => Ok(ParseInt(d))).unwrap_or_else( () =>
		Err( new Error("Please specify a depth of wall."))).flatten();

	const wrapper = blueprintString.and_then(v => safelyParseBlueprintString(v)).unwrap_or_else(() => Err(new Error("Please specify blueprint")));

	const surrounded = depthInt.zip(wrapper)
		.and_then(([depth, wrapper]) => {
			if (!('blueprint' in wrapper)) {
				return Err(new ErrBlueprintBook())
			}

			return Ok(blueprintSurroundedByWall(
				wrapper.blueprint as Blueprint,
				depth
			))
		}).flatten()



	return (
		<Prose>
			<h1>Surround a blueprint with walls</h1>
			<p>
				When given a Factorio blueprint, gives one that is the same but
				surrounded by a wall of specified depth.
			</p>
			<p>
				It's a bit bugged because the blueprint data doesn't contain the
				size of the entities in it, only their top-leftmost corner's
				placement.
			</p>
			<p>
				If you have a fix, feel free to{' '}
				<Link
					href={`${githubRepoUrl}/blob/main/project/zemn.me/app/experiments/factorio/blueprint/wall/client.tsx`}
				>
					commit
				</Link>{' '}
				it!
			</p>
			<form>
				<label htmlFor={b64InputLabel}>
					Factorio blueprint (base64):{' '}
					<textarea
						id={b64InputLabel}
						onChange={e =>
							setBlueprintString(Some(e.target.value))
						}
						spellCheck="false"
						value={blueprintString.unwrap_or(undefined)}
					/>
				</label>

				<label htmlFor={depthInputLabel}>
					Depth:{' '}
					<input
						id={depthInputLabel}
						onChange={e => setDepth(Some(e.target.value ))}
						value={depth.unwrap_or(undefined)}
					/>
				</label>

				<output htmlFor={inputsString} id={outputLabel}>
					{surrounded.and_then(output => <DisplayBlueprint blueprint={output} />).unwrap_or_else(e => <ErrorDisplay error={e} />)}
				</output>
			</form>
		</Prose>
	);
}
