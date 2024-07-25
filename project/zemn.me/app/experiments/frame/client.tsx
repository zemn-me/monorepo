'use client';
import React, { ChangeEvent, useCallback, useId, useState } from "react";


export function FrameClient() {
	const [frameWidth, setFrameWidth] = useState<string>("10");
	const frameWidthInputId = useId();
	const frameWidthChange = useCallback((e: ChangeEvent<HTMLInputElement>) =>
		setFrameWidth(e.target.value)
		, [setFrameWidth]);
	const [frameHeight, setFrameHeight] = useState<string>("5");
	const frameHeightInputId = useId();
	const frameHeightChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setFrameHeight(e.target.value), [setFrameHeight]);

	const [artWidth, setArtWidth] = useState<string>("3");
	const artWidthInputId = useId();
	const artWidthChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setArtWidth(e.target.value), [setArtWidth]);
	const [artHeight, setArtHeight] = useState<string>("3");
	const artHeightInputId = useId();
	const artHeightChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setArtHeight(e.target.value), [setArtHeight]);

	const [overlapAmount, setInsetAmount] = useState<string>(".1");
	const overlapAmountInputId = useId();
	const overlapAmountChange = useCallback((e: ChangeEvent<HTMLInputElement>) => setInsetAmount(e.target.value), [setInsetAmount]);


	const frameSwapClickButtonId = useId();
	const onFrameSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		setFrameHeight(frameWidth);
		setFrameWidth(frameHeight);
	}, [setFrameHeight, setFrameWidth, frameHeight, frameWidth]);

	const artSwapClickButtonId = useId();
	const onArtSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		setArtHeight(artWidth);
		setArtWidth(artHeight);
	}, [setArtHeight, setArtWidth, artHeight, artWidth]);

	const inH = (+frameHeight - +artHeight) / 2
	const inW = (+frameWidth - +artWidth) / 2;
	const insH = inH - +overlapAmount;
	const insW = inW - + overlapAmount;

	return <form>
		<h1>Framing Calculator.</h1>
		<fieldset>
			<legend>Frame</legend>
			<label htmlFor={frameWidthInputId}>
				Width:
				<input id={frameWidthInputId} onChange={frameWidthChange} type="number" value={frameWidth} />
			</label>

			<label htmlFor={frameHeightInputId}>
				Height:
				<input id={frameHeightInputId} onChange={frameHeightChange} type="number" value={frameHeight} />
			</label>
			<button id={frameSwapClickButtonId} onClick={onFrameSwapClick} title="swap width and height">⇄</button>
		</fieldset>

		<fieldset>
			<legend>Art</legend>
			<label htmlFor={artWidthInputId}>
				Width:
				<input id={artWidthInputId} onChange={artWidthChange} type="number" value={artWidth} />
			</label>
			<label htmlFor={artHeightInputId}>
				Height:
				<input id={artHeightInputId} onChange={artHeightChange} type="number" value={artHeight} />
			</label>
			<button id={artSwapClickButtonId} onClick={onArtSwapClick} title="swap width and height">⇄</button>
		</fieldset>

		<fieldset>
			<legend>Overlap</legend>
			<label htmlFor={overlapAmountInputId}>
				<i>Amount of art to cover with matteboard.</i>
				<input id={overlapAmountInputId} onChange={overlapAmountChange} value={overlapAmount} />
			</label>
		</fieldset>

		<output htmlFor={[frameWidthInputId, frameHeightInputId, artWidthInputId, artHeightInputId, overlapAmountInputId, artSwapClickButtonId, frameSwapClickButtonId].join(" ")} name="result" >
			<dl>
				<dt>inset height: {inH}</dt>
				<dd>This is the depth of the line to draw on the foam core from the bottom and top when it is in portrait to accurately place the art in the centre.</dd>
				<dt>inset width: {inW}</dt>
				<dd>This is the depth of the line to draw on the foam core from the bottom and top when it is in <i>landscape</i> to accurately place the art in the centre.</dd>
				<dt>matte inset height: {insH}</dt>
				<dd>This is the depth of the line to draw on the back of the matteboard from the bottom and top when it is in portrait.</dd>
				<dt>matte inset width: {insW}</dt>
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
