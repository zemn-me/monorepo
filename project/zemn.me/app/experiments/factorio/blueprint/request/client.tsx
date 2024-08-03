'use client';
import { useId, useState } from 'react';

import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintString } from '#root/ts/factorio/blueprint_string';
import { DisplayBlueprint } from '#root/ts/factorio/react/blueprint.js';
import { concat, map } from '#root/ts/iter/index.js';
import { None, Option, Some } from '#root/ts/option/option.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import { Err, Ok, Result } from '#root/ts/result.js';
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

function ParseInt(i: string): Result <number, ParseIntError<ErrIsNan>> {
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
		useState<Option <string>>( None);
	const [nChests, setNChests] = useState<Option<string>>(Some("3"));
	const nChestsInputLabel = useId();
	const b64InputLabel = useId();
	const outputLabel = useId();
	const inputsString = [b64InputLabel, nChestsInputLabel].join(' ');

	const blueprint = blueprintString
		.and_then(v => Ok(v)).unwrap_or_else(() => Err(new Error("Please specify blueprint string.")))
		.and_then(v => safelyParseBlueprintString(v)).flatten();

	const intNChests = nChests.and_then(v => Ok(ParseInt(v))).unwrap_or_else(
		() => Err(new Error("Please specify a number of chests."))).flatten();

	const chests = blueprint.zip(intNChests).and_then(([wrapper, nChests]) => {
		if (!('blueprint' in wrapper)) return Err(new ErrBlueprintBook());

		return Ok(blueprintToRequesterChest(wrapper.blueprint as Blueprint, nChests));
	}).flatten();

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
							setBlueprintString(Some( e.target.value ))
						}
						spellCheck="false"
						value={blueprintString.unwrap_or(undefined)}
					/>
				</label>

				<label htmlFor={nChestsInputLabel}>
					Number of chests:{' '}
					<input
						id={nChestsInputLabel}
						onChange={e => setNChests(Some(e.target.value ))}
						value={nChests.unwrap_or(undefined)}
					/>
				</label>


				<output htmlFor={inputsString} id={outputLabel}>
					{chests.and_then(output => <DisplayBlueprint blueprint={output} />).unwrap_or_else(e => <ErrorDisplay error={e} />)}
				</output>

			</form>
		</Prose>
	);
}
