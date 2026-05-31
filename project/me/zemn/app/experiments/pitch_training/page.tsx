import { Metadata } from 'next/types';
import { PitchTrainingDecks } from '#root/project/me/zemn/app/experiments/pitch_training/client.js';
import {
	pianoKeysDeck,
	pitchClassesDeck,
	sqlWasm,
} from '#root/project/me/zemn/app/experiments/pitch_training/decks.js';
import { Article } from '#root/project/me/zemn/components/Article/article.js';
import {
	H1,
	H2,
} from '#root/project/me/zemn/components/Article/heading.js';
import { Section } from '#root/project/me/zemn/components/Article/section.js';

const decks = [
	{
		name: 'Pitch classes',
		href: pitchClassesDeck,
		detail: '12 cards, C4-B4, answers without octaves.',
	},
	{
		name: 'Piano keys',
		href: pianoKeysDeck,
		detail: '88 cards, A0-C8, answers with octaves.',
	},
] as const;

export default function Page() {
	return (
		<Article title="Pitch Training">
			<Section>
				<H1>Pitch Training</H1>
				<p>
					Anki decks for learning to recognize pitches by ear.
					Preview a card here, or download a deck to practice in
					Anki.
				</p>
				<Section>
					<H2>Decks</H2>
					<PitchTrainingDecks decks={decks} sqlWasmUrl={sqlWasm} />
				</Section>
			</Section>
		</Article>
	);
}

export const metadata: Metadata = {
	title: 'Pitch Training',
	description: 'Anki decks for learning to recognize pitches by ear.',
};
