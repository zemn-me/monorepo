'use client';
import React, { ChangeEvent, useCallback, useId, useMemo, useState } from "react";


const parseMeasurement = /(\d+(?:\.\d+)?)(in|cm|mm)/

/**
 * Parse a measurement and return it in m.
 */
function parseAndNormaliseMeasurement(measurement: string) {
	const parsed = new RegExp(parseMeasurement).exec(measurement);

	if (parsed == null) return undefined;

	const [, decimal, unit] = parsed;

	if (decimal == undefined || unit == undefined) return undefined;

	const multiplier = ({
		"in": 0.0254,
		"mm": 1/1_000,
		"cm": 1/100,
	}[unit]);

	if (multiplier == undefined) return undefined;

	return parseInt(decimal, 10) * multiplier;
}

function displayCanonicalUnit(measurement: number | undefined) {
	if (measurement == undefined) return "unknown";

	return `${measurement * 1_000}mm`;
}


export function FrameClient() {
	const [frameWidthInput, setFrameWidthInput] = useState<string>("10mm");
	const frameWidthInputId = useId();
	const frameWidthChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
		setFrameWidthInput(e.target.value)
		, [setFrameWidthInput]);
	const frameWidth = useMemo(() => parseAndNormaliseMeasurement(frameWidthInput), [frameWidthInput]);

	const [frameHeightInput, setFrameHeightInput] = useState<string>("5mm");
	const frameHeightInputId = useId();
	const frameHeightChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setFrameHeightInput(e.target.value), [setFrameHeightInput]);
	const frameHeight = useMemo(() => parseAndNormaliseMeasurement(frameHeightInput), [ frameHeightInput ]);


	const [artWidthInput, setArtWidthInput] = useState<string>("3mm");
	const artWidthInputId = useId();
	const artWidthChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setArtWidthInput(e.target.value), [setArtWidthInput]);
	const artWidth = useMemo(() => parseAndNormaliseMeasurement(artWidthInput), [artWidthInput]);

	const [artHeightInput, setArtHeightInput] = useState<string>("3mm");
	const artHeightInputId = useId();
	const artHeightChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setArtHeightInput(e.target.value), [setArtHeightInput]);
	const artHeight = useMemo(() => parseAndNormaliseMeasurement(artHeightInput), [artHeightInput]);

	const [overlapAmountInput, setOverlapAmountInput] = useState<string>(".1mm");
	const overlapAmountInputId = useId();
	const overlapAmountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setOverlapAmountInput(e.target.value), [setOverlapAmountInput]);
	const overlapAmount = useMemo(() => parseAndNormaliseMeasurement(overlapAmountInput), [overlapAmountInput]);


	const frameSwapClickButtonId = useId();
	const onFrameSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		setFrameHeightInput(frameWidthInput);
		setFrameWidthInput(frameHeightInput);
	}, [setFrameHeightInput, setFrameWidthInput, frameHeightInput, frameWidthInput]);

	const artSwapClickButtonId = useId();
	const onArtSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		setArtHeightInput(artWidthInput);
		setArtWidthInput(artHeightInput);
	}, [setArtHeightInput, setArtWidthInput, artHeightInput, artWidthInput]);

	const inH = frameHeight != undefined && artHeight != undefined ?
		(frameHeight - artHeight)/2 : undefined;

	const inW = frameWidth != undefined && artWidth != undefined ?
		(frameWidth - artWidth) / 2 : undefined;

	const insH = inH != undefined && overlapAmount != undefined ?
		inH - overlapAmount: undefined;

	const insW = inW != undefined && overlapAmount != undefined ?
		inW - overlapAmount: undefined;


	return <form>
		<h1>Framing Calculator.</h1>
		<fieldset>
			<legend>Frame</legend>
			<label htmlFor={frameWidthInputId}>
				Width:
				<input id={frameWidthInputId} onChange={frameWidthChange} pattern={parseMeasurement.toString()} value={frameWidthInput} />
			</label>

			<label htmlFor={frameHeightInputId}>
				Height:
				<input id={frameHeightInputId} onChange={frameHeightChange} pattern={parseMeasurement.toString()} value={frameHeightInput}/>
			</label>
			<button id={frameSwapClickButtonId} onClick={onFrameSwapClick} title="swap width and height">⇄</button>
		</fieldset>

		<fieldset>
			<legend>Art</legend>
			<label htmlFor={artWidthInputId}>
				Width:
				<input id={artWidthInputId} onChange={artWidthChange} pattern={parseMeasurement.toString()} value={artWidthInput}/>
			</label>
			<label htmlFor={artHeightInputId}>
				Height:
				<input id={artHeightInputId} onChange={artHeightChange} pattern={parseMeasurement.toString()} value={artHeightInput}/>
			</label>
			<button id={artSwapClickButtonId} onClick={onArtSwapClick} title="swap width and height">⇄</button>
		</fieldset>

		<fieldset>
			<legend>Overlap</legend>
			<label htmlFor={overlapAmountInputId}>
				<i>Amount of art to cover with matteboard.</i>
				<input id={overlapAmountInputId} onChange={overlapAmountChange} pattern={parseMeasurement.toString()} value={overlapAmountInput}/>
			</label>
		</fieldset>

		<output htmlFor={[frameWidthInputId, frameHeightInputId, artWidthInputId, artHeightInputId, overlapAmountInputId, artSwapClickButtonId, frameSwapClickButtonId].join(" ")} name="result" >
			<dl>
				<dt>inset height: {displayCanonicalUnit(inH)}</dt>
				<dd>This is the depth of the line to draw on the foam core from the bottom and top when it is in portrait to accurately place the art in the centre.</dd>
				<dt>inset width: {displayCanonicalUnit(inW)}</dt>
				<dd>This is the depth of the line to draw on the foam core from the bottom and top when it is in <i>landscape</i> to accurately place the art in the centre.</dd>
				<dt>matte inset height: {displayCanonicalUnit(insH)}</dt>
				<dd>This is the depth of the line to draw on the back of the matteboard from the bottom and top when it is in portrait.</dd>
				<dt>matte inset width: {displayCanonicalUnit(insW)}</dt>
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
