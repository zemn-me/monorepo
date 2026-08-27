'use client';
import { useId, useState } from 'react';

import Link from '#root/project/me/zemn/components/Link/index.js';
import { Prose } from '#root/project/me/zemn/components/Prose/prose.js';
import { githubRepoUrl } from '#root/ts/constants/constants.js';
import {
	Blueprint,
	blueprintSurroundedByWall,
} from '#root/ts/factorio/blueprint.js';
import { BlueprintString } from '#root/ts/factorio/blueprint_string';
import { DisplayBlueprint } from '#root/ts/factorio/react/blueprint.js';
import * as Option from '#root/ts/option/types.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import * as Result from '#root/ts/result/result.js';
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

function ParseInt(i: string): Result.Result<number, ParseIntError<ErrIsNan>> {
	const n = parseInt(i);
	if (isNaN(n)) return Result.Err(new ParseIntError(i, new ErrIsNan(i)));

	return Result.Ok(n);
}

class ErrBlueprintBook extends Error {
	constructor() {
		super('only works on bluerprints -- you gave a blueprint book.');
	}
}

export function Client() {
	const [blueprintString, setBlueprintString] = useState<
		Option.Option<string>
	>(() => Option.None);
	const [depth, setDepth] = useState<Option.Option<string>>(() =>
		Option.Some('3')
	);
	const depthInputLabel = useId();
	const b64InputLabel = useId();
	const outputLabel = useId();
	const inputsString = [b64InputLabel, depthInputLabel].join(' ');

	const depthInt = Result.and_then_flatten(
		Option.ok_or_else(
			depth,
			() => new Error('Please specify a depth of wall.')
		),
		ParseInt
	);

	const wrapper = Option.unwrap_or_else(
		Option.and_then(blueprintString, safelyParseBlueprintString),
		() => Result.Err(new Error('Please specify blueprint'))
	);

	const surrounded = Result.and_then_flatten(
		Result.zipped(
			depthInt,
			wrapper,
			(depth, wrapper) => [depth, wrapper] as const
		),
		([depth, wrapper]) => {
			if (!('blueprint' in wrapper)) {
				return Result.Err(new ErrBlueprintBook());
			}

			return Result.Ok(
				blueprintSurroundedByWall(wrapper.blueprint as Blueprint, depth)
			);
		}
	);

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
					href={`${githubRepoUrl}/blob/main/project/me/zemn/app/experiments/factorio/blueprint/wall/client.tsx`}
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
							setBlueprintString(() =>
								Option.Some(e.target.value)
							)
						}
						spellCheck="false"
						value={Option.unwrap_or(blueprintString, undefined)}
					/>
				</label>

				<label htmlFor={depthInputLabel}>
					Depth:{' '}
					<input
						id={depthInputLabel}
						onChange={e =>
							setDepth(() => Option.Some(e.target.value))
						}
						value={Option.unwrap_or(depth, undefined)}
					/>
				</label>

				<output htmlFor={inputsString} id={outputLabel}>
					{Result.unwrap_or_else(
						Result.and_then(surrounded, output => (
							<DisplayBlueprint blueprint={output} />
						)),
						error => (
							<ErrorDisplay error={error} />
						)
					)}
				</output>
			</form>
		</Prose>
	);
}
