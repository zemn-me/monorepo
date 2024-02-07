'use client';
import { useId, useState } from 'react';

import { DisplayBlueprint } from '#root/project/zemn.me/app/experiments/factorio/blueprint/blueprint.js';
import Link from '#root/project/zemn.me/components/Link/Link.js';
import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { githubRepoUrl } from '#root/ts/constants/constants.js';
import {
	Blueprint,
	blueprintSurroundedByWall,
} from '#root/ts/factorio/blueprint.js';
import { ParseBlueprintString } from '#root/ts/factorio/blueprint_string.js';
import { None, Option, OptionSequence, Some } from '#root/ts/option.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import { Err, Ok, Result, ResultSequence } from '#root/ts/result.js';
import { safely } from '#root/ts/safely.js';

const safelyParseBlueprintString = safely(ParseBlueprintString);

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
	if (isNaN(n)) return { [Err]: new ParseIntError(i, new ErrIsNan(i)) };

	return { [Ok]: n };
}

class ErrBlueprintBook extends Error {
	constructor() {
		super('only works on bluerprints -- you gave a blueprint book.');
	}
}

export function Client() {
	const [blueprintString, setBlueprintString] =
		useState<Option<string>>(None);
	const [depth, setDepth] = useState<Option<string>>({ [Some]: '3' });
	const depthInputLabel = useId();
	const b64InputLabel = useId();
	const outputLabel = useId();
	const errorsLabel = useId();
	const inputsString = [b64InputLabel, depthInputLabel].join(' ');

	const chests = ResultSequence(blueprintString)
		.then(v => safelyParseBlueprintString(v))
		.then(blueprintWrapper => {
			const depthInt = OptionSequence(depth)
				.orError(() => new Error('please specify a depth of wall.'))
				.then(i => ParseInt(i)).result;
			if (Err in depthInt) return depthInt;

			return { [Ok]: { blueprintWrapper, depthInt: depthInt[Ok] } };
		})
		.then(({ blueprintWrapper, depthInt }) => {
			if (
				!(
					'blueprint' in blueprintWrapper &&
					blueprintWrapper.blueprint !== undefined
				)
			)
				return { [Err]: new ErrBlueprintBook() };
			return {
				[Ok]: blueprintSurroundedByWall(
					blueprintWrapper.blueprint as Blueprint,
					depthInt
				),
			};
		}).result;

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
							setBlueprintString({ [Some]: e.target.value })
						}
						spellCheck="false"
						value={ResultSequence(blueprintString).or(undefined)}
					/>
				</label>

				<label htmlFor={depthInputLabel}>
					Depth:{' '}
					<input
						id={depthInputLabel}
						onChange={e => setDepth({ [Some]: e.target.value })}
						value={ResultSequence(depth).or(undefined)}
					/>
				</label>

				{Err in chests && chests[Err] !== undefined ? (
					<label htmlFor={errorsLabel}>
						Errors occurred:{' '}
						<output htmlFor={inputsString} id={errorsLabel}>
							<ErrorDisplay error={chests[Err]} />
						</output>
					</label>
				) : null}

				{Ok in chests && chests[Ok] !== undefined ? (
					<label htmlFor={outputLabel}>
						Blueprint:
						<output htmlFor={inputsString} id={outputLabel}>
							<DisplayBlueprint blueprint={chests[Ok]} />
						</output>
					</label>
				) : null}
			</form>
		</Prose>
	);
}
