'use client';
import { extent } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { useId, useState } from 'react';

import { Prose } from '#root/project/zemn.me/components/Prose/prose';
import { Blueprint } from '#root/ts/factorio/blueprint';
import { ParseBlueprintString } from '#root/ts/factorio/blueprint_string.js';
import { None, Option, Some } from '#root/ts/option.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display';
import { Err, Ok, ResultSequence } from '#root/ts/result.js';
import { safely } from '#root/ts/safely.js';

const safelyParseBlueprintString = safely(ParseBlueprintString);

export function Client() {
	const [blueprintString, setBlueprintString] =
		useState<Option<string>>(None);

	const b64InputLabel = useId();

	const entities = ResultSequence(blueprintString)
		.then(v => safelyParseBlueprintString(v))
		.then(blueprintWrapper => {
			const blueprint = blueprintWrapper.blueprint as Blueprint;
			const renderables = blueprint.entities ?? [];
			const scaleX = scaleLinear(
				extent(renderables, v => v.position.x) as [number, number],
				[0, 100]
			);
			const scaleY = scaleLinear(
				extent(renderables, v => v.position.y) as [number, number],
				[0, 100]
			);

			return {
				[Ok]: renderables.map(e => (
					<circle
						cx={scaleX(e.position.x)}
						cy={scaleY(e.position.y)}
						key={e.entity_number}
						r="1"
						style={{ fill: 'var(--foreground-color)' }}
					/>
				)),
			};
		}).result;

	return (
		<>
			<Prose>
				<h1>Factorio blueprint renderer</h1>
				<p>
					This is a very poorly put together and experimental factorio
					blueprint renderer.
				</p>
				<p>
					It will display the rough shape of a blueprint. But it will
					be extremely rough, as it does not have data on the size of
					any entities.
				</p>
			</Prose>
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
			</form>

			{Err in entities ? (
				<ErrorDisplay error={entities[Err]} />
			) : (
				<svg viewBox="0 0 100 100">{entities[Ok]}</svg>
			)}
		</>
	);
}
