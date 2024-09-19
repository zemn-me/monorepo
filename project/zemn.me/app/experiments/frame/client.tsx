'use client';
import { parseAsString, useQueryState } from 'nuqs';
import { ChangeEvent, useCallback, useId, useMemo } from "react";

import { frameSizes } from "#root/project/zemn.me/app/experiments/frame/frame_sizes.js";
import { Iterable } from "#root/ts/iter/index.js";
import { NewType } from "#root/ts/NewType.js";
import { None, Some } from "#root/ts/option/option.js";
import { ErrorDisplay } from "#root/ts/react/ErrorDisplay/error_display.js";
import { Err, Ok, Result } from "#root/ts/result.js";

const measurementConversions = {
	"in": 0.0254,
	"m": 1,
	"mm": 1 / 1_000,
	"cm": 1 / 100,
};

type Unit = keyof typeof measurementConversions;


type Measurement<S extends number = number, U extends Unit = Unit> = measurement<[ scalar: S, unit: U ]>

function mustUnit(unit: string): Result<Unit, Error> {
	if (!Object.keys(measurementConversions).some(v => v == unit))
		return Err(new Error(`Unknown unit: ${unit}`));

	return Ok(unit as Unit);
}

class measurement<T> extends NewType<T> {
	scalar(this: Measurement) {
		return this.value[0]
	}
	unit(this: Measurement) {
		return this.value[1]
	}
	as_m(this: Measurement): measurement<[number, "m"]> {
		return new measurement([ this.scalar() * measurementConversions[this.unit()], "m" ])
	}

	as(this: Measurement, target: Unit): Measurement {
		return new measurement([
			this.as_m().scalar() / measurementConversions[target], target
])
	}

	plus(this: Measurement, other: Measurement): Measurement<number, "m"> {
		return new measurement([this.as_m().scalar() + other.as_m().scalar(), "m"]);
	}

	multiply(this: Measurement, other: Measurement): Measurement<number, "m"> {
		return new measurement([this.as_m().scalar() * other.as_m().scalar(), "m"]);
	}

	multiply_unitless(this: Measurement<number, "in">, other: number): Measurement<number, "in">
	multiply_unitless(this: Measurement<number, "cm">, other: number): Measurement<number, "cm">
	multiply_unitless(this: Measurement<number, "mm">, other: number): Measurement<number, "mm">
	multiply_unitless(this: Measurement<number, "m">, other: number): Measurement<number, "m">

	multiply_unitless(this: Measurement, other: number): Measurement {
		return new measurement([this.scalar() * other, this.unit()]);
	}

	minus(this: Measurement, other: Measurement) {
		return this.plus(other.multiply(new measurement([ -1, "m" ])))
	}

	divide(this: Measurement, other: Measurement): Measurement<number, "m"> {
		return this.multiply(new measurement([ 1 / other.as_m().scalar(), "m"]))
	}

	divide_unitless(this: Measurement, other: number): Measurement {
		return new measurement([this.scalar() / other, this.unit()]);
	}

	to_string_no_adjustments(this: Measurement): string {
		return `${this.scalar().toFixed(2)}${this.unit()}`
	}

	greater_than(this: Measurement, other: Measurement): boolean {
		return this.as_m().scalar() > other.as_m().scalar()
	}

	less_than(this: Measurement, other: Measurement): boolean {
		return this.as_m().scalar() < other.as_m().scalar()
	}

	equal(this: Measurement, other: Measurement): boolean {
		return this.as_m().scalar() == other.as_m().scalar()
	}

	to_string(this: Measurement): string {
		let v: Measurement = this.as_m();
		if (v.scalar() < 1) v = v.as("cm");
		return `${v.scalar().toFixed(2)}${v.unit()}`
	}

	override toString(this: Measurement): string {
		return this.to_string();
	}

}

function Measurement<T>(v: T): measurement<T> {
	return new measurement(v)
}


const reParseMeasurement = /(\d+(?:\.\d+)?)\s*(in|cm|mm?)/

class ParseMeasurementError extends Error {
	constructor(cause: Error, input: string, meaning: string) {
		const inputRepresentation =
			input == ""
				? `an empty ${meaning}`
				: `${meaning} "${input}"`;
		super(`trying to interpret ${inputRepresentation}: ${cause}`)
		super.cause = cause;
	}
}

/**
 * Parse a measurement and return it in m.
 */
function parseMeasurement(measurement: string, meaning: string): Result<Measurement, ParseMeasurementError | Error> {
	const parsed = new RegExp(reParseMeasurement).exec(measurement);

	if (parsed == null) return Err(new ParseMeasurementError(new Error("format is incorrect"), measurement, meaning));

	const [, decimal, unit] = parsed;

	if (decimal == undefined) return Err(
		new ParseMeasurementError(
			new Error("missing decimal part"),
			measurement, meaning,
		));

	if (unit == undefined) return Err(
		new ParseMeasurementError(new Error("please specify a unit"), measurement, meaning));

	const scalar = +decimal;
	if (isNaN(scalar)) return Err(new ParseMeasurementError(new Error("please specify a valid number"), measurement, meaning));

	return mustUnit(unit).and_then(
		unit => Measurement([ scalar, unit ])
	)
}

function displayCanonicalUnit(measurement: Result<Measurement, unknown>):string {
	return measurement.and_then(m => m.to_string()).unwrap_or("unknown");
}

const normalisedFrameSizes = frameSizes.map(v => ({
	...v,
	width: parseMeasurement(v.width, `${v.name} width`).unwrap(),
	height: parseMeasurement(v.height, `${v.name} height`).unwrap()
})).map(v => [
	v,
	{
		...v,
		width: v.height,
		height: v.width,
		name: `${v.name} (rotated)`
	}
]).flat(1);

interface VisualiseFramedArtProps {
	readonly frame: [number, number],
	readonly art: [ number, number]
}

function VisualiseFramedArt({
	frame: [framew, frameh],
	art: [artw, arth ],
}: VisualiseFramedArtProps) {

	const cx = framew / 2;
	const cy = frameh / 2;
	const rx = cx - (artw / 2);
	const ry = cy - (arth / 2);

	return <svg style={{ border: "1px solid currentColor"}} viewBox={[0, 0, framew, frameh].join(" ")}>
		<rect height={arth} style={{ fill: "currentColor"}} width={artw} x={rx} y={ry}/>
	</svg>
}

interface MatteboardCutsProps {
	frameHeight: Measurement
	artHeight: Measurement
	frameWidth: Measurement
	artWidth: Measurement
	overlapAmount: Measurement

}

interface MatteBoardCutsOutputs {
	backingInsetHeight: Measurement
	backingInsetWidth: Measurement

	matteboardInsetHeight: Measurement
	matteboardInsetWidth: Measurement

	windowWidth: Measurement
	windowHeight: Measurement

}


function matteboardCuts({ frameHeight, overlapAmount, artHeight, frameWidth, artWidth } : MatteboardCutsProps): MatteBoardCutsOutputs {
	const backingInsetHeight = frameHeight.minus(artHeight).divide_unitless(2);

	const backingInsetWidth = frameWidth.minus(artWidth).divide_unitless(2);

	const matteboardInsetHeight = backingInsetHeight.plus(overlapAmount);

	const matteboardInsetWidth = backingInsetWidth.plus(overlapAmount);

	const windowHeight = frameHeight.minus(matteboardInsetHeight.multiply_unitless(2));

	const windowWidth = frameWidth.minus(matteboardInsetWidth.multiply_unitless(2));

	return {
		backingInsetHeight, backingInsetWidth, matteboardInsetHeight, matteboardInsetWidth, windowHeight, windowWidth
	}


}

export function FrameClient() {
	const [frameWidthInput, setFrameWidthInput] = useQueryState<string>('frame_width', parseAsString.withDefault('17in'));
	const frameWidthInputId = useId();
	const frameWidthChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
		void setFrameWidthInput(e.target.value)
		, [setFrameWidthInput]);
	const frameWidth = useMemo(() => parseMeasurement(frameWidthInput, "frame width"), [frameWidthInput]);

	const [frameHeightInput, setFrameHeightInput] = useQueryState<string>('frame_height', parseAsString.withDefault("24in"));
	const frameHeightInputId = useId();
	const frameHeightChange = useCallback((e: ChangeEvent<HTMLInputElement>) => void setFrameHeightInput(e.target.value), [setFrameHeightInput]);
	const frameHeight = useMemo(() => parseMeasurement(frameHeightInput, "frame height"), [frameHeightInput]);


	const [artWidthInput, setArtWidthInput] = useQueryState<string>('art_width', parseAsString.withDefault("12in"));
	const artWidthInputId = useId();
	const artWidthChange = useCallback((e: ChangeEvent<HTMLInputElement>) => void setArtWidthInput(e.target.value), [setArtWidthInput]);
	const artWidth = useMemo(() => parseMeasurement(artWidthInput, "art width"), [artWidthInput]);

	const [artHeightInput, setArtHeightInput] = useQueryState<string>('art_height', parseAsString.withDefault("23.75in"));
	const artHeightInputId = useId();
	const artHeightChange = useCallback((e: ChangeEvent<HTMLInputElement>) => void setArtHeightInput(e.target.value), [setArtHeightInput]);
	const artHeight = useMemo(() => parseMeasurement(artHeightInput, "art height"), [artHeightInput]);

	const [overlapAmountInput, setOverlapAmountInput] = useQueryState<string>("overlap_amount", parseAsString.withDefault("1cm"));
	const overlapAmountInputId = useId();
	const overlapAmountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => void setOverlapAmountInput(e.target.value), [setOverlapAmountInput]);
	const overlapAmount = useMemo(() => parseMeasurement(overlapAmountInput, "overlap amount"), [overlapAmountInput]);

	const [minimumCutDepthInput, setMinimumCutDepthInput] = useQueryState<string>("minimum_cut_depth", parseAsString.withDefault(""));
	const minimumCutDepthInputId = useId();
	const minimumCutDepthInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => void setMinimumCutDepthInput(e.target.value), [setMinimumCutDepthInput]);
	const minimumCutDepth = useMemo(() => parseMeasurement(minimumCutDepthInput, "minimum cut depth").unwrap_or(
		Measurement<[number, "cm"]>([0, "cm"])
	), [minimumCutDepthInput]);


	const frameSwapClickButtonId = useId();
	const onFrameSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		void setFrameHeightInput(frameWidthInput);
		void setFrameWidthInput(frameHeightInput);
	}, [setFrameHeightInput, setFrameWidthInput, frameHeightInput, frameWidthInput]);

	const artSwapClickButtonId = useId();
	const onArtSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		void setArtHeightInput(artWidthInput);
		void setArtWidthInput(artHeightInput);
	}, [setArtHeightInput, setArtWidthInput, artHeightInput, artWidthInput]);

	const artInfo = artHeight.zip(artWidth);
	const frameInfo = frameHeight.zip(frameWidth);
	const errataInfo = overlapAmount.zip(Ok(minimumCutDepth));
	const frameOptionsInfo = artInfo.zip(errataInfo);

	const frameOptions: JSX.Element =
		frameOptionsInfo.and_then(
			([[artHeight, artWidth], [overlapAmount, minCutDepth]]) =>
				Iterable(normalisedFrameSizes)
					.map(f => ({
						...f,
						δwidth: f.width.minus(artWidth),
						δheight: f.height.minus(artHeight),
					})).map(v => {
						if (v.δheight.scalar() < 0 || v.δwidth.scalar() < 0) return None;
						const mattedHeight = v.δheight.multiply_unitless(2);
						const mattedWidth = v.δwidth.multiply_unitless(2);
						const vn = {
							...v,
							mattedHeight, mattedWidth,
							totalMattedArea: mattedWidth.plus(
								mattedHeight
							),
							...matteboardCuts({
								frameHeight: v.height,
								frameWidth: v.width,
								artHeight: artHeight,
								artWidth: artWidth,
								overlapAmount: overlapAmount
							})
						};

						// can't make cut smaller than minimum
						if (vn.matteboardInsetHeight.less_than(minCutDepth) ||
							vn.matteboardInsetWidth.less_than(minCutDepth)) return None;

						return Some(vn)

					}).filter()
					.sort((a, b) => a.totalMattedArea.minus(b.totalMattedArea).scalar())
					.map(v => <tr key={v.name}>
						<td>{v.name}</td>
						<td>{v.width.to_string_no_adjustments()}</td>
						<td>{v.height.to_string_no_adjustments()}</td>
						<td>{v.mattedWidth.as(v.width.unit()).to_string_no_adjustments()}</td>
						<td>{v.mattedHeight.as(v.height.unit()).to_string_no_adjustments()}</td>
						<td><button aria-label="pick this frame" onClick={e => {
							void setFrameWidthInput(v.width.to_string_no_adjustments());
							void setFrameHeightInput(v.height.to_string_no_adjustments());
							e.preventDefault();
						}}>↑</button></td>
					</tr>)).and_then(v => {

						const arr = [...v.value];
						if (arr.length < 1) return <>No results.</>;

						return <table>
							<thead><tr><td>Name</td><td>Width</td><td>Height</td><td>Matted Width</td><td>Matted Height</td><td>Pick</td></tr></thead>
							<tbody>
								{arr}
							</tbody>
						</table>;

					}
					)
			.unwrap_or_else(e => <ErrorDisplay error={e}/>);

	const cuts = artInfo.zip(frameInfo).and_then(
		([[artHeight, artWidth], [frameHeight, frameWidth]]) =>
			overlapAmount.and_then(overlapAmount =>
				matteboardCuts({ frameHeight, frameWidth, artHeight, artWidth, overlapAmount })
			)
	).flatten();

	return <form>
		<h1>Framing Calculator.</h1>
		<section style={{ top: "0", backgroundColor: "var(--background-color)"}}>
		<fieldset>
			<legend>Frame</legend>
			<label htmlFor={frameWidthInputId}>
				Width:
				<input id={frameWidthInputId} onChange={frameWidthChange} pattern={reParseMeasurement.source} value={frameWidthInput} />
			</label>
			{" "}
			<label htmlFor={frameHeightInputId}>
				Height:
				<input id={frameHeightInputId} onChange={frameHeightChange} pattern={reParseMeasurement.source} value={frameHeightInput}/>
			</label>
			<button id={frameSwapClickButtonId} onClick={onFrameSwapClick} title="swap width and height">⇄</button>
		</fieldset>

		<fieldset>
			<legend>Art</legend>
			<label htmlFor={artWidthInputId}>
				Width:
				<input id={artWidthInputId} onChange={artWidthChange} pattern={reParseMeasurement.source} value={artWidthInput}/>
			</label>
			{" "}
			<label htmlFor={artHeightInputId}>
				Height:
				<input id={artHeightInputId} onChange={artHeightChange} pattern={reParseMeasurement.source} value={artHeightInput}/>
			</label>
			<button id={artSwapClickButtonId} onClick={onArtSwapClick} title="swap width and height">⇄</button>
		</fieldset>

		<fieldset>
			<legend>Matteboard</legend>
			<label htmlFor={overlapAmountInputId}>
				<i>Amount of art to cover with matteboard. </i>
				<input id={overlapAmountInputId} onChange={overlapAmountChange} pattern={reParseMeasurement.source} value={overlapAmountInput}/>
			</label>{" "}
			<label htmlFor={minimumCutDepthInputId}>
				<i>Minimum Cut Depth. </i>
				<input id={minimumCutDepthInputId} onChange={minimumCutDepthInputChange} pattern={reParseMeasurement.source} placeholder="0" value={minimumCutDepthInput}/>
			</label>
		</fieldset>
		</section>



		<output htmlFor={[frameWidthInputId, frameHeightInputId, artWidthInputId, artHeightInputId, overlapAmountInputId, artSwapClickButtonId, frameSwapClickButtonId].join(" ")} name="result" >
		<h2>Visualisation.</h2>
			{
				artInfo.zip(frameInfo).and_then(([[artW, artH], [frameW, frameH]]) => <VisualiseFramedArt
					art={[artW.as_m().scalar(), artH.as_m().scalar()]}
					frame={[frameW.as_m().scalar(), frameH.as_m().scalar()]}
				/>
				).unwrap_or_else(e => <ErrorDisplay error={e}/>)
			}
		<details>
			<summary><h2>Frame Options.</h2></summary>
			<p>
				To help you pick what sized frame to put the art in, this
				is a list of different standard & off the shelf frame sizes
				sorted by least space around the art to most.
			</p>
				{frameOptions}
		</details>
		<h2>Score lengths.</h2>
			<dl>
				<dt>inset height: {displayCanonicalUnit(cuts.and_then(v => v.backingInsetHeight))}</dt>
				<dd>This is the depth of the line to draw on the foam core from the bottom and top when it is in portrait to accurately place the art in the centre.</dd>
				<dt>inset width: {displayCanonicalUnit(cuts.and_then(v => v.backingInsetWidth))}</dt>
				<dd>This is the depth of the line to draw on the foam core from the bottom and top when it is in <i>landscape</i> to accurately place the art in the centre.</dd>
				<dt>matte inset height: {displayCanonicalUnit(cuts.and_then(v => v.matteboardInsetHeight))}</dt>
				<dd>This is the depth of the line to draw on the back of the matteboard from the bottom and top when it is in portrait.</dd>
				<dt>matte inset width: {displayCanonicalUnit(cuts.and_then(v => v.matteboardInsetWidth))}</dt>
				<dd>This is the depth of the line to draw on the back of the matteboard from the bottom and top when it is in <i>landscape</i>.</dd>
			</dl>

			<h2>Using these instructions.</h2>
			<p>
				You will need a matteboard cutter with a regular blade and a bevel blade, as well as acid-free tape, matteboard and foam core.
			</p>
			<ol>
				<li>Cut the matteboard and foam core to the same size as the inner size of your frame.</li>
				<li>Set the cut depth of the matteboard cutter to 'inset height'.</li>
				<li>Place the foam core in the matteboard cutter in portrait and scribe a line against the cutter runner in pencil.</li>
				<li>Rotate the foam core 180°.</li>
				<li>Scribe a line against the cutter runner in pencil.</li>
				<li>Repeat steps 3-5 for the <i>back</i> of the matteboard.</li>
				<li>Set the cut depth of the matteboard cutter to 'inset width'.</li>
				<li>Place the foam core in the matteboard cutter in landscape and scribe a line against the cutter runner in pencil.</li>
				<li>Rotate the foam core 180°.</li>
				<li>Scribe a line against the cutter runner in pencil.</li>
				<li>Repeat the last 3 steps for the back of the matteboard.</li>
				<li>(you now have both the matteboard and the foam core inscribed with a box the size of your art)</li>
				<li>Set the cut depth of the matteboard cutter to 'matte inset height', and repeat the process – except only on the back of the matteboard.</li>
				<li>Do the same for 'matte inset width'.</li>
				<li>(you now have a smaller box indicating the size of the image that will show through the hole in the matteboard)</li>
				<li>I will have to explain the rest some other time...</li>
			</ol>
		</output>

	</form>
}
