import * as Save from '#root/project/cultist/save.js';
import * as deserialize from '#root/project/cultist/state/deserialize.js';
import * as serialize from '#root/project/cultist/state/serialize.js';
import { maybe } from '#root/ts/util.js';

test('maybe', () => {
	expect(maybe(serialize.number)(10)).toEqual('10');

	expect(maybe(serialize.number)(undefined)).toEqual(undefined);
});

test('elementInstance serialization issue (?)', () => {
	const a = deserialize.elementInstance({ lifetimeRemaining: '10' });
	expect(a.lifetimeRemaining).toEqual(10);
	const b = serialize.elementInstance(a);
	expect(b.lifetimeRemaining).toEqual('10');

	expect(
		roundTrip(
			deserialize.elementInstance,
			serialize.elementInstance
		)({
			lifetimeRemaining: '10',
		})
	).toEqual({ lifetimeRemaining: '10' });
});

const State = {
	serialize,
	deserialize,
} as const;

function roundTrip<I, O>(a: (v: I) => O, b: (v: O) => I): (v: I) => I {
	return (v: I) => b(a(v));
}

test('deserialization', () => {
	const ElementInstanceExample: Save.ElementInstance = {
		lifetimeRemaining: '10',
		lastTablePosX: '10',
		lastTablePosY: '20',
		elementId: 'egg',
		quantity: '10',
	};

	const d = State.deserialize.elementInstance(ElementInstanceExample);

	{
		expect(d.lifetimeRemaining?.toString()).toEqual(
			ElementInstanceExample.lifetimeRemaining
		);
		expect(d.lastTablePosX?.toString()).toEqual(
			ElementInstanceExample.lastTablePosX
		);
	}
});

test('round trip serialization', () => {
	const ElementInstanceExample: Save.ElementInstance = {
		lifetimeRemaining: '10',
		lastTablePosX: '10',
		lastTablePosY: '20',
		elementId: 'egg',
		quantity: '10',
	};

	{
		const d = State.deserialize.elementInstance(ElementInstanceExample);
		expect(d.lifetimeRemaining).toEqual(10);
		expect(d.elementId).toEqual('egg');
		const r = State.serialize.elementInstance(d);
		expect(ElementInstanceExample).toEqual(r);
	}

	const DeckExample: Save.Deck = {
		eliminatedCards: ['card1', 'card2', 'card3'],
		'1': 'big egg',
		'2': 'small egg',
		'3': 'medium egg',
	};

	{
		const d = State.deserialize.deck(DeckExample);
		expect(d.eliminatedCards).toBeDefined();
		expect(d.eliminatedCards).toContain('card1');
		expect(d.cards).toContain('big egg');
		const r = State.serialize.deck(d);
		expect(r).toEqual(DeckExample);
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
		expect(Levers).toEqual(
			roundTrip(State.deserialize.levers, State.serialize.levers)(Levers)
		);
	}

	const CharacterDetails: Save.CharacterDetails = {
		name: 'john',
		profession: 'egg man',

		executions: {
			hatching: '10',
		},

		futureLevers: Levers,
		pastLevers: Levers,

		activeLegacy: 'cult of thr big egg',
	};

	{
		const d = State.deserialize.characterDetails(CharacterDetails);
		expect(d.name).toEqual('john');
		expect(d.futureLevers).toBeDefined();
		expect(
			roundTrip(
				State.deserialize.characterDetails,
				State.serialize.characterDetails
			)(CharacterDetails)
		).toEqual(CharacterDetails);
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
		expect(Situation).toEqual(
			roundTrip(
				State.deserialize.situation,
				State.serialize.situation
			)(Situation)
		);
	}

	const stateExample: Save.State = {
		characterDetails: CharacterDetails,
	};

	{
		expect(stateExample).toEqual(
			roundTrip(
				State.deserialize.state,
				State.serialize.state
			)(stateExample)
		);
	}
});
