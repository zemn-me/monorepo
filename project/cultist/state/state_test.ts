import * as Save from '//project/cultist/save';
import * as serialize from '//project/cultist/state/serialize';
import * as deserialize from '//project/cultist/state/deserialize';

const State = {
	serialize,
	deserialize,
} as const;

function roundTrip<I, O>(a: (v: I) => O, b: (v: O) => I): (v: I) => I {
	return (v: I) => b(a(v));
}

test('round trip serialization', () => {
	const ElementInstanceExample: Save.ElementInstance = {
		lifetimeRemaining: '10',
		lastTablePosX: '10',
		lastTablePosY: '20',
		elementId: 'egg',
		quantity: '10',
	};

	{
		const st = State.deserialize.elementInstance(ElementInstanceExample);
		expect(st).toEqual(
			roundTrip(
				State.serialize.elementInstance,
				State.deserialize.elementInstance
			)(st)
		);
	}

	const DeckExample: Save.Deck = {
		eliminatedCards: ['card1', 'card2', 'card3'],
		'1': 'big egg',
		'2': 'small egg',
		'3': 'medium egg',
	};

	{
		const st = State.deserialize.deck(DeckExample);
		expect(st).toEqual(
			roundTrip(State.serialize.deck, State.deserialize.deck)(st)
		);
	}

	const Levers: Save.Levers = {
		lastheadquarters: 'mums house',
		lastfollower: 'john',
		lastpersonkilled: 'the mockingbird',
		lastcharactername: 'john 2',
		lastcult: 'cult of the big egg',
		lasttool: 'a gun',
		lastbook: '33 ways to eat eggs',
		lastdesire: 'omelette',
	};

	{
		const st = State.deserialize.levers(Levers);
		expect(st).toEqual(
			roundTrip(State.serialize.levers, State.deserialize.levers)(st)
		);
	}

	const CharacterDetails: Save.CharacterDetails = {
		name: 'john',
		profession: 'egg man',

		executions: {
			hatching: '10',
		},

		futureLevers: Levers,

		activeLegacy: 'cult of thr big egg',
	};

	{
		const st = State.deserialize.characterDetails(CharacterDetails);
		expect(st).toEqual(
			roundTrip(
				State.serialize.characterDetails,
				State.deserialize.characterDetails
			)(st)
		);
	}

	const Situation: Save.Situation = {
		situationStoredElements: {
			'big egg': {
				elementId: 'big egg',
				lastTablePosX: '10',
				lastTablePosY: '10',
				lifetimeRemaining: '1',
				markedForConsumption: 'False',
				quantity: '10',
			},
			'big 2 egg': {
				elementId: 'big egg',
				lastTablePosX: '10',
				lastTablePosY: '10',
				lifetimeRemaining: '1',
				markedForConsumption: 'False',
				quantity: '10',
			},
		},

		verbId: 'run',

		title: 'Running',

		recipeId: 'running away',

		completioncount: '1',

		state: '??',
	};

	{
		const st = State.deserialize.situation(Situation);

		expect(st).toEqual(
			roundTrip(
				State.serialize.situation,
				State.deserialize.situation
			)(st)
		);
	}
});
