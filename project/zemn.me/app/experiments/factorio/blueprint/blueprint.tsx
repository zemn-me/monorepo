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
import { concat } from '#root/ts/iter/index.js';
import { CopyToClipboard } from '#root/ts/react/CopyToClipboard/CopyToClipboard.js';

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
			<CopyToClipboard text={MarshalBlueprintBookString(book)} />
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
						</li>
					))}
				</ol>
			) : null}
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
			<CopyToClipboard text={MarshalBlueprintString(blueprint)} />
			<DisplayGamespace
				objects={[
					...concat(blueprint.tiles ?? [], blueprint.entities ?? []),
				]}
			/>
		</article>
	);
}

export interface DisplayGamespaceProps {
	readonly objects: (Entity | Tile)[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DisplayGamespace(props: DisplayGamespaceProps) {
	return null;
}
