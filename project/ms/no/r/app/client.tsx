'use client';

import { type CSSProperties, useState } from 'react';

import {
	type CalculationResult,
	colourLabel,
	colourValue,
	DIGIT_BANDS,
	decodeBands,
	encodeResistor,
	formatResistance,
	MULTIPLIER_BANDS,
	parseResistance,
	parseTolerance,
	TOLERANCE_BANDS,
} from '#root/project/ms/no/r/app/resistor.js';

const DEFAULT_RESISTANCE = 100_000;
const DEFAULT_TOLERANCE = 5;

function mustCalculate(result: CalculationResult) {
	if (!result.ok) {
		throw new Error(result.message);
	}

	return result.value;
}

const initialCalculation = mustCalculate(
	encodeResistor(DEFAULT_RESISTANCE, DEFAULT_TOLERANCE)
);

function swatchStyle(colour: string): CSSProperties {
	return {
		backgroundColor: colourValue(colour),
	};
}

function isTransparent(colour: string): boolean {
	return colour === 'transparent';
}

function BandSwatch({ colour }: { readonly colour: string }) {
	return (
		<span
			aria-hidden="true"
			className={[
				'bandSwatch',
				isTransparent(colour) ? 'bandSwatchTransparent' : '',
			].join(' ')}
			style={swatchStyle(colour)}
		/>
	);
}

function bandOptions(index: number, bands: readonly string[]) {
	if (index === bands.length - 1) {
		return TOLERANCE_BANDS;
	}

	if (index === bands.length - 2) {
		return MULTIPLIER_BANDS;
	}

	return DIGIT_BANDS;
}

export function ResistorCalculator() {
	const [resistanceText, setResistanceText] = useState(
		initialCalculation.resistanceText
	);
	const [toleranceText, setToleranceText] = useState(
		String(initialCalculation.tolerance)
	);
	const [bands, setBands] = useState<readonly string[]>(
		initialCalculation.bands
	);
	const [message, setMessage] = useState<string | null>(null);

	const applyCalculation = (result: CalculationResult, syncText = true) => {
		if (!result.ok) {
			setMessage(result.message);
			return;
		}

		setBands(result.value.bands);
		if (syncText) {
			setResistanceText(result.value.resistanceText);
			setToleranceText(String(result.value.tolerance));
		}
		setMessage(null);
	};

	const applyValueText = (nextResistance: string, nextTolerance: string) => {
		const resistance = parseResistance(nextResistance);
		const tolerance = parseTolerance(nextTolerance);

		if (resistance == null || tolerance == null) {
			setMessage('Enter a resistance and tolerance this calculator knows');
			return;
		}

		applyCalculation(encodeResistor(resistance, tolerance), false);
	};

	const setResistance = (nextResistance: string) => {
		setResistanceText(nextResistance);
		applyValueText(nextResistance, toleranceText);
	};

	const setTolerance = (nextTolerance: string) => {
		setToleranceText(nextTolerance);
		applyValueText(resistanceText, nextTolerance);
	};

	const setBand = (index: number, colour: string) => {
		const nextBands = bands.map((band, bandIndex) =>
			bandIndex === index ? colour : band
		);
		setBands(nextBands);

		const decoded = decodeBands(nextBands);
		if (!decoded.ok) {
			setMessage(decoded.message);
			return;
		}

		setResistanceText(formatResistance(decoded.value.resistance));
		setToleranceText(String(decoded.value.tolerance));
		setMessage(null);
	};

	const addDigitBand = () => {
		const multiplierIndex = bands.length - 2;
		const nextBands = [
			...bands.slice(0, multiplierIndex),
			'black',
			...bands.slice(multiplierIndex),
		];

		applyCalculation(decodeBands(nextBands));
	};

	const removeDigitBand = (index: number) => {
		if (bands.length <= 4 || index >= bands.length - 2) {
			return;
		}

		const nextBands = bands.filter((_, bandIndex) => bandIndex !== index);
		applyCalculation(decodeBands(nextBands));
	};

	return (
		<main className="calculatorShell">
			<section className="resistorView" aria-label="Resistor colour bands">
				{bands.map((band, index) => (
					<div
						className={[
							'stripe',
							isTransparent(band) ? 'stripeTransparent' : '',
						].join(' ')}
						key={`${index}-${band}`}
						style={swatchStyle(band)}
					>
						<span>{colourLabel(band)}</span>
					</div>
				))}
			</section>

			<section
				aria-label="Resistor calculator"
				className={['controlPanel', message ? 'controlPanelInvalid' : ''].join(
					' '
				)}
			>
				<div className="brandRow">
					<img alt="" className="brandMark" src="/logo.svg" />
					<div>
						<h1>Resistor Colour Identifier</h1>
						<p>
							<output>{resistanceText}</output>
							<span className="ohm"> ohm</span>
							<span className="toleranceOutput">
								{' '}
								(+/-{toleranceText}%)
							</span>
						</p>
					</div>
				</div>

				<div className="valueGrid">
					<label>
						<span>Resistance</span>
						<input
							inputMode="decimal"
							onChange={event => setResistance(event.target.value)}
							value={resistanceText}
						/>
					</label>
					<label>
						<span>Tolerance</span>
						<select
							onChange={event => setTolerance(event.target.value)}
							value={toleranceText}
						>
							{TOLERANCE_BANDS.map(option => (
								<option key={option.value} value={option.value}>
									{option.value}%
								</option>
							))}
						</select>
					</label>
				</div>

				<div className="bandGrid">
					{bands.map((band, index) => (
						<label className="bandControl" key={`${index}-${band}`}>
							<span>{index < bands.length - 2 ? `Band ${index + 1}` : index === bands.length - 2 ? 'Multiplier' : 'Tolerance'}</span>
							<div className="bandControlRow">
								<BandSwatch colour={band} />
								<select
									onChange={event => setBand(index, event.target.value)}
									value={band}
								>
									{bandOptions(index, bands).map(option => (
										<option key={option.colour} value={option.colour}>
											{option.label}
										</option>
									))}
								</select>
								{index < bands.length - 2 && bands.length > 4 ? (
									<button
										aria-label={`Remove band ${index + 1}`}
										onClick={() => removeDigitBand(index)}
										type="button"
									>
										x
									</button>
								) : null}
							</div>
						</label>
					))}
				</div>

				<div className="actionRow">
					<button onClick={addDigitBand} type="button">
						+ band
					</button>
					<a href="https://github.com/venoms/resistor-colours">source</a>
				</div>

				<p className="status" role="status">
					{message ?? '\u00a0'}
				</p>
			</section>
		</main>
	);
}
