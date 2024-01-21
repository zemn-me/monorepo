'use client';
import { Fragment, useState } from 'react';

import style from '#root/project/zemn.me/app/experiments/emoji/flag/style.module.css.js';
import Link from '#root/project/zemn.me/components/Link.js';
import { Prose } from '#root/project/zemn.me/components/Prose/prose.js';
import { Q } from '#root/project/zemn.me/components/Q.js';

interface CodePointReferenceProps {
	readonly children: string;
}

function CodePointReference({ children: codepoint }: CodePointReferenceProps) {
	return (
		<Link href={`https://www.compart.com/en/unicode/${codepoint}`}>
			{codepoint}
		</Link>
	);
}

interface CodepointNameProps {
	readonly children: string;
}

/**
 * @see https://en.wikipedia.org/wiki/Small_caps#Use_in_Unicode_standards
 */
function CodepointName({ children: name }: CodepointNameProps) {
	return <span className={style.codepointName}>{name}</span>;
}

const REGIONAL_INDICATOR_SYMBOL_LETTER_A = '🇦';
const REGIONAL_INDICATOR_SYMBOL_LETTER_A_CODEPOINT =
	REGIONAL_INDICATOR_SYMBOL_LETTER_A.codePointAt(0)!;
const LATIN_LETTER_A = 'a';
const LATIN_LETTER_A_CODEPOINT = LATIN_LETTER_A.codePointAt(0)!;
const LATIN_LETTER_Z = 'z';
const LATIN_LETTER_Z_CODEPOINT = LATIN_LETTER_Z.codePointAt(0)!;

function codepointDisplayForm(codepoint: number) {
	return `U+${codepoint.toString(16).padStart(4, '0')}`;
}

class ErrNonLatin extends Error {
	get letter() {
		return String.fromCodePoint(this.codepoint);
	}
	render() {
		return (
			<>
				<CodePointReference>
					{codepointDisplayForm(this.codepoint)}
				</CodePointReference>{' '}
				(<Q single>{this.letter}</Q>) is not a latin character.
			</>
		);
	}
	constructor(public readonly codepoint: number) {
		super(`${codepointDisplayForm(codepoint)} is not a latin character`);
	}
}

class ErrNoCodePoint extends Error {
	render() {
		return (
			<>
				<Q single>{this.letter}</Q> does not contain a codepoint.
			</>
		);
	}
	constructor(public readonly letter: string) {
		super(`Can't get a unicode codepoint from ${letter}`);
	}
}

function latinLetterToRegionalIndicatorSymbol(latinLetter: string) {
	const codePoint = latinLetter.toLowerCase().codePointAt(0);
	if (codePoint === undefined) return new ErrNoCodePoint(latinLetter);
	console.log(codePoint, LATIN_LETTER_A_CODEPOINT, LATIN_LETTER_Z_CODEPOINT);
	if (
		codePoint < LATIN_LETTER_A_CODEPOINT ||
		codePoint > LATIN_LETTER_Z_CODEPOINT
	)
		return new ErrNonLatin(codePoint);

	return String.fromCodePoint(
		codePoint -
			LATIN_LETTER_A_CODEPOINT +
			REGIONAL_INDICATOR_SYMBOL_LETTER_A_CODEPOINT
	);
}

function latinTextToRegionalIndicators(text: string) {
	return [...text].map(v => latinLetterToRegionalIndicatorSymbol(v));
}

function FlagGenerator() {
	const [input, setInput] = useState<string>();

	const regionalIndicators = latinTextToRegionalIndicators(input ?? '');
	const errors = regionalIndicators.filter(
		<E extends Error>(v: string | E): v is E => v instanceof Error
	);

	return (
		<>
			<form>
				<label htmlFor="input">
					Country code (latin letters only):{' '}
					<input
						id="input"
						onChange={e => setInput(e.target.value)}
						pattern="[a-z]*"
						type="text"
					/>
				</label>
			</form>

			<figure>
				<figcaption>Regional indicators:</figcaption>
				{regionalIndicators.map((v, i) => {
					if (typeof v === 'string')
						return (
							<Fragment key={i}>
								{v}
								<wbr />
							</Fragment>
						);

					return <s key={i}>{v.letter}</s>;
				})}
			</figure>
			{errors.length == 0 ? (
				<figure>
					<figcaption>Your country flag!</figcaption>
					{(regionalIndicators as string[]).join('')}
				</figure>
			) : null}
			{errors.length ? (
				<figure>
					<figcaption>Errors occurred:</figcaption>
					<ol>
						{errors.map((e, i) => (
							<li key={i}>{e.render()}</li>
						))}
					</ol>
				</figure>
			) : null}
		</>
	);
}

export default function Main() {
	return (
		<>
			<Prose>
				<h1>Custom Country flag emoji generator!</h1>
				<p>
					A cute fact is that the flag emoji (<Q single>🇬🇧</Q>) are
					actually, for international diplomatic reasons, made of
					their own special alphabet.
				</p>
				<p>
					The UK flag for example, <Q single>🇬🇧</Q> is composed of{' '}
					<Q single>🇬</Q> (
					<Q single>
						<CodePointReference>U+1F1EC</CodePointReference>{' '}
						<CodepointName>
							regional indicator symbol letter g
						</CodepointName>
					</Q>
					) and <Q single>🇧</Q> (
					<Q single>
						<CodePointReference>U+1F1E7</CodePointReference>{' '}
						<CodepointName>
							regional indicator symbol letter b
						</CodepointName>
					</Q>
					).
				</p>
				<p>
					These <Q single>regional indicator symbols</Q> are made of
					their own version of the latin alphabet and form country
					codes that on some devices turn into flags.
				</p>
				<p>
					A big part of this is that not all countries recognise the
					sovereignty or existence of all other countries. If Unicode
					had to assign codepoints to every country in the world there
					would be a lot of arguing, and Unicode would need to be put
					in charge of who gets to be a country.
				</p>
				<p>
					With this tool, you can generate flags for both real and
					theoretical countries. Have fun!
				</p>
			</Prose>
			<FlagGenerator />
		</>
	);
}
