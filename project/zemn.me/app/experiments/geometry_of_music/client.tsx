"use client";

import type { Infer } from "zod";
import { enum as Enum, literal, number, tuple, union} from "zod/mini";

import { Article } from "#root/project/zemn.me/components/Article/article.js";
import { H1 } from "#root/project/zemn.me/components/Article/heading.js";
import { Section } from "#root/project/zemn.me/components/Article/section.js";
import { Strudel } from "#root/ts/react/strudel/strudel.js";

const semitone = 1;
const tone = 2 * semitone;
const octave = 12 * semitone;


const naturals =
	"C D E F G A B".split(" ");
;

const noteName = Enum([
	"C", "D", "E", "F", "G", "A", "B",
]);

type NoteName2 = Infer<typeof noteName>; // i have no idea waht to call

const acccidentalSharp = literal("♯");
const accidentalFlat = literal("♭");
const accidentalNatural = literal("♮");
const accidental = union([acccidentalSharp, accidentalNatural, accidentalFlat]);
const _noteName = tuple([noteName, accidental, number()]);
type NoteName = Infer<typeof _noteName>

const midiToNoteName = (n: number): NoteName[] =>
	n % 2 == 0
		// is natural
		? [
			[naturals[(n%octave)/tone]! as NoteName2, "♮", Math.floor(n/octave)-1] // yes, really
		]

		// is ♭ / ♯
		: [
			// ♯
			[
				naturals[Math.floor((n%octave)/tone)]! as NoteName2, "♯", Math.floor(n/octave)-1,
			],

			// ♭
			[
				naturals[Math.ceil((n%octave)/tone)]! as NoteName2, "♭", Math.floor(n/octave)-1
			],
		];

function NoteNameElement({ note: [name, accidental, octave] }: { readonly note: NoteName }) {
	return <>{name}<sub>{octave}</sub>{accidental}</>
}


function MidiConverterTable() {
	return <table>
		<thead>
			<tr>
			<td>Midi</td>
			<td colSpan={2}>Note Name</td>
			</tr>
		</thead>

		<tbody>
			{
				Array(127).fill(0)
				.map((_, n) => <tr key={n}>
					<td>{n}</td>
					{
						midiToNoteName(n)
						.map(
							(nn, n2, a) => <td colSpan={3-a.length} key={n2}>
								<NoteNameElement note={nn}/>
							</td>
						)
					}
				</tr>)
			}

		</tbody>
	</table>
}

export function GeometryOfMusicPage() {
	return <Article>
		<>
		<H1>A Geometry of Music in Strudel.</H1>
		<Section>
			<p>I know the formatting is fucked i will fix it later...</p>
			<p>The following are notes from my studying the book "A geometry of music" via Strudel.</p>
			<p>Zero midi is C (but like a crazy low c).</p>
			<Strudel code={`$: note("0 c").sound("piano")`}/>
			<p>Midi number increments correspond to one semitone (half a note).</p>
			<p>Therefore, every even midi note is a "whole note" (A, B C).</p>
			<p>And every 2 × 8 = 16 increments is a whole octave.</p>
			<p>» Every multiple of 16 is a C.</p>
			<p>» if note % 12 === 2 then it's a D and so on.</p>
			<MidiConverterTable/>
			<p>little proof that I got my conversions right:</p>
			<Strudel code={`$: note("c4 60") // these are the same note`}/>
			<Strudel code={`$: note("50 52").sound("piano") // D, E`}/>
			<blockquote>Melodies tend to move by short distances from note to note.</blockquote>
			<p>
				Small movements sound melodic:
				<Strudel code={`note("[a b] [c b] [a -]")`}/>
			</p>
		</Section>
		</>
	</Article>
}
