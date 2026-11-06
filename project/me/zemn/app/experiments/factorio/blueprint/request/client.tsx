'use client';
import { useId, useState } from 'react';

import { Prose } from '#root/project/me/zemn/components/Prose/prose.js';
import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintString } from '#root/ts/factorio/blueprint_string';
import { DisplayBlueprint } from '#root/ts/factorio/react/blueprint.js';
import { concat, map } from '#root/ts/iter/index.js';
import * as Option from '#root/ts/option/types.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import * as Result from '#root/ts/result/result.js';
import { safely } from '#root/ts/safely.js';

const safelyParseBlueprintString = safely((s: string) =>
	BlueprintString.parse(s)
);

function countSame<V>(it: Iterable<V>): Map<V, number> {
	const m = new Map<V, number>();

	for (const i of it) m.set(i, (m.get(i) ?? 0) + 1);

	return m;
}

function blueprintToRequesterChest(bp: Blueprint, nChests: number): Blueprint {
	const title = {
		item: 'blueprint',
		label: `Requester chest with all the ingredients for ${bp.label ?? 'some blueprint'}`,
		version: bp.version,
	};

	const needs = countSame(
		map(concat(bp.entities ?? [], bp.tiles ?? []), v => v.name)
	);

	return {
		...title,
		description: `Requester chests (${nChests}) with all the items for ${bp.label ?? 'some blueprint'}.`,
		entities: [...Array(nChests)].map((_, i) => ({
			name: 'logistic-chest-requester',
			entity_number: i + 1,
			position: { x: i, y: 0 },
			request_filters: [...needs].map(([name, count], i) => ({
				name,
				index: i + 1,
				count: Math.ceil(count / nChests),
			})),
		})),
		icons: [...needs.entries()]
			.sort(([, a], [, b]) => b - a)
			.slice(0, 4)
			.map(([item], i) => ({
				index: i + 1,
				signal: { type: 'item', name: item },
			})),
		version: 0,
	};
}

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
	const [nChests, setNChests] = useState<Option.Option<string>>(() =>
		Option.Some('3')
	);
	const nChestsInputLabel = useId();
	const b64InputLabel = useId();
	const outputLabel = useId();
	const inputsString = [b64InputLabel, nChestsInputLabel].join(' ');

	const blueprint = Result.and_then_flatten(
		Option.ok_or_else(
			blueprintString,
			() => new Error('Please specify blueprint string.')
		),
		safelyParseBlueprintString
	);

	const intNChests = Result.and_then_flatten(
		Option.ok_or_else(
			nChests,
			() => new Error('Please specify a number of chests.')
		),
		ParseInt
	);

	const chests = Result.and_then_flatten(
		Result.zipped(
			blueprint,
			intNChests,
			(wrapper, nChests) => [wrapper, nChests] as const
		),
		([wrapper, nChests]) => {
			if (!('blueprint' in wrapper))
				return Result.Err(new ErrBlueprintBook());

			return Result.Ok(
				blueprintToRequesterChest(
					wrapper.blueprint as Blueprint,
					nChests
				)
			);
		}
	);

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
						onChange={e =>
							setBlueprintString(() =>
								Option.Some(e.target.value)
							)
						}
						spellCheck="false"
						value={Option.unwrap_or(blueprintString, undefined)}
					/>
				</label>

				<label htmlFor={nChestsInputLabel}>
					Number of chests:{' '}
					<input
						id={nChestsInputLabel}
						onChange={e =>
							setNChests(() => Option.Some(e.target.value))
						}
						value={Option.unwrap_or(nChests, undefined)}
					/>
				</label>

				<output htmlFor={inputsString} id={outputLabel}>
					{Result.unwrap_or_else(
						Result.and_then(chests, output => (
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
