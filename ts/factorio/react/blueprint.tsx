'use client';
import { extent } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { z } from 'zod';

import { Blueprint } from '#root/ts/factorio/blueprint.js';
import { BlueprintBook } from '#root/ts/factorio/blueprint_book.js';
import {
	MarshalBlueprintBookString,
	MarshalBlueprintString,
} from '#root/ts/factorio/blueprint_string.js';
import { BlueprintWrapper } from '#root/ts/factorio/blueprint_wrapper.js';
import { Color } from '#root/ts/factorio/color.js';
import { Entity } from '#root/ts/factorio/entity.js';
import { Tile } from '#root/ts/factorio/tile.js';
import { UpgradePlanner } from '#root/ts/factorio/upgrade_planner.js';
import { Some } from '#root/ts/option/option.js';
import { CopyToClipboard } from '#root/ts/react/CopyToClipboard/CopyToClipboard.js';
import { ErrorDisplay } from '#root/ts/react/ErrorDisplay/error_display.js';
import { resultFromZod } from '#root/ts/zod/util.js';

export interface RenderBlueprintProps {
	readonly blueprint: Blueprint;
	readonly width?: number;
	readonly height?: number;
}

export function RenderBlueprint({
	blueprint,
	width = 100,
	height = 100,
}: RenderBlueprintProps) {
	const renderables = blueprint.entities ?? [];
	const scaleX = resultFromZod(z
		.tuple([z.number(), z.number()])
		.safeParse(extent(renderables, v => v.position.x))).and_then(v => scaleLinear(v, [0, width]));

	const scaleY = resultFromZod(
		z
			.tuple([z.number(), z.number()])
			.safeParse(extent(renderables, v => v.position.y)))
		.and_then(v => scaleLinear(v, [0, height]));

	return (
		<svg viewBox={`0 0 ${width} ${height}`} {...{ width, height }}>
			{
				scaleX.zip(scaleY).and_then(
					([scaleX, scaleY]) => <>
{renderables.map(r => (
				<circle
					cx={scaleX(r.position.x)}
					cy={scaleY(r.position.y)}
					key={r.entity_number}
					r="1"
				/>
			))}
					</>
				).unwrap_or_else(e => <ErrorDisplay error={e}/>)
			}

		</svg>
	);
}

function colorToString(color: Color | undefined): string | undefined {
	if (color === undefined) return undefined;
	const { r, g, b, a } = color;
	return `rgba(${[r, g, b, a].join(',')})`;
}

export interface FactorioLabelProps {
	readonly color?: Color;
	readonly label: string;
}

function FactorioLabel(props: FactorioLabelProps) {
	return (
		<span style={{ color: colorToString(props.color) }}>{props.label}</span>
	);
}

export interface DisplayBlueprintWrapperProps {
	readonly wrapper: BlueprintWrapper;
}

export function DisplayBlueprintWrapper({
	wrapper,
}: DisplayBlueprintWrapperProps) {
	if ('blueprint' in wrapper)
		return <DisplayBlueprint blueprint={wrapper.blueprint as Blueprint} />;

	if ('blueprint_book' in wrapper)
		return <DisplayBlueprintBook book={wrapper['blueprint_book']} />;

	return <>Invalid blueprint :(</>;
}

export interface DisplayUpgradePlannerProps {
	readonly planner: UpgradePlanner
}

export function DisplayUpgradePlanner({ planner }: DisplayUpgradePlannerProps) {
	return <figure>
		{Some(planner.label).from().and_then(l => <figcaption>{l}</figcaption>).unwrap_or(null)}
		<ul>
			{planner.settings.mappers.map(v => <li key={v.index}>
				{v.from.name} → {v.to.name}
			</li>)}
		</ul>

	</figure>
}

export interface DisplayBlueprintBookProps {
	readonly book: BlueprintBook;
}

export function DisplayBlueprintBook({ book }: DisplayBlueprintBookProps) {
	return (
		<article>
			<header>
				<b>
					<FactorioLabel
						color={book.label_color}
						label={book.label}
					/>
				</b>
			</header>
			<i>
				Version {book.version} blueprint book
				{book.blueprints.length > 0
					? `, containing ${book.blueprints.length} blueprints:`
					: '.'}
			</i>
			{book.blueprints.length > 0 ? (
				<ol>
					{book.blueprints.map((blueprint, i) => (
						<li key={i}>
							{blueprint.blueprint ? (
								<DisplayBlueprint
									blueprint={blueprint.blueprint}
								/>
							) : null}
							{blueprint.blueprint_book ? (
								<DisplayBlueprintBook
									book={blueprint.blueprint_book}
								/>
							) : null}
							{
								Some(blueprint.upgrade_planner).from()
									.and_then(planner => <DisplayUpgradePlanner planner={planner} />)
								.unwrap_or(null)
							}
						</li>
					))}
				</ol>
			) : null}

			<CopyToClipboard text={() => MarshalBlueprintBookString(book)} />
		</article>
	);
}

export interface DisplayBlueprintProps {
	readonly blueprint: Blueprint;
}

export function DisplayBlueprint({ blueprint }: DisplayBlueprintProps) {
	return (
		<article>
			{blueprint.label ? (
				<header>
					<FactorioLabel
						color={blueprint.label_color}
						label={blueprint.label}
					/>
				</header>
			) : null}
			{blueprint.description ? <p>{blueprint.description}</p> : null}
			<CopyToClipboard text={() => MarshalBlueprintString(blueprint)} />
			<RenderBlueprint blueprint={blueprint} />
		</article>
	);
}

export interface DisplayGamespaceProps {
	readonly objects: (Entity | Tile)[];
}
