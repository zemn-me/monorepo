export type AspectId =
	| 'body'
	| 'coin'
	| 'cult'
	| 'dread'
	| 'fascination'
	| 'follower'
	| 'lantern'
	| 'lore'
	| 'passion'
	| 'reason'
	| 'rite'
	| 'secret';

export type CardId =
	| 'acquaintance'
	| 'bequest'
	| 'book_lantern'
	| 'cult_lantern'
	| 'desire_enlightenment_1'
	| 'desire_enlightenment_2'
	| 'desire_enlightenment_3'
	| 'desire_enlightenment_4'
	| 'desire_enlightenment_5'
	| 'dread'
	| 'erudition'
	| 'evidence'
	| 'fascination'
	| 'funds'
	| 'glimmering'
	| 'health'
	| 'influence_lantern'
	| 'lantern_lore_10'
	| 'lantern_lore_2'
	| 'lantern_lore_4'
	| 'lantern_lore_6'
	| 'lantern_lore_8'
	| 'notoriety'
	| 'passion'
	| 'reason'
	| 'rite_watchman'
	| 'stamina'
	| 'student_lantern';

export type VerbId = 'dream' | 'explore' | 'study' | 'talk' | 'work';

export type EndingId =
	| 'death'
	| 'despair'
	| 'enlightenment'
	| 'imprisonment'
	| 'madness';

export interface CardDefinition {
	readonly id: CardId;
	readonly label: string;
	readonly description: string;
	readonly aspects: Readonly<Partial<Record<AspectId, number>>>;
	readonly unique?: boolean;
	readonly tone: 'ability' | 'danger' | 'lore' | 'material' | 'society';
}

export interface VerbDefinition {
	readonly id: VerbId;
	readonly label: string;
	readonly description: string;
}

export interface Requirement {
	readonly card: CardId;
	readonly count?: number;
}

export interface Effect {
	readonly card: CardId;
	readonly count: number;
}

export interface CardQuantity {
	readonly card: CardId;
	readonly count: number;
}

export interface RecipeDefinition {
	readonly id: string;
	readonly verb: VerbId;
	readonly label: string;
	readonly startText: string;
	readonly resultText: string;
	readonly duration: number;
	readonly requirements?: readonly Requirement[];
	readonly costs?: readonly Effect[];
	readonly effects?: readonly Effect[];
	readonly ending?: EndingId;
	readonly unique?: boolean;
}

export interface Operation {
	readonly recipeId: string;
	readonly verb: VerbId;
	readonly startedAt: number;
	readonly remaining: number;
	readonly total: number;
}

export interface LogEntry {
	readonly at: number;
	readonly inputs?: readonly CardQuantity[];
	readonly outputs?: readonly CardQuantity[];
	readonly title: string;
	readonly text: string;
	readonly kind: 'danger' | 'ending' | 'result' | 'season' | 'start';
}

export interface GameState {
	readonly inventory: Readonly<Record<CardId, number>>;
	readonly operations: Readonly<Partial<Record<VerbId, Operation>>>;
	readonly completed: Readonly<Record<string, number>>;
	readonly time: number;
	readonly nextSeasonAt: number;
	readonly log: readonly LogEntry[];
	readonly ending?: EndingId;
}

export interface RequirementStatus extends Requirement {
	readonly have: number;
	readonly missing: number;
}

export interface RecipeStatus {
	readonly recipe: RecipeDefinition;
	readonly requirements: readonly RequirementStatus[];
	readonly available: boolean;
	readonly blockedReason?: string;
}

const allCardIds = [
	'acquaintance',
	'bequest',
	'book_lantern',
	'cult_lantern',
	'desire_enlightenment_1',
	'desire_enlightenment_2',
	'desire_enlightenment_3',
	'desire_enlightenment_4',
	'desire_enlightenment_5',
	'dread',
	'erudition',
	'evidence',
	'fascination',
	'funds',
	'glimmering',
	'health',
	'influence_lantern',
	'lantern_lore_10',
	'lantern_lore_2',
	'lantern_lore_4',
	'lantern_lore_6',
	'lantern_lore_8',
	'notoriety',
	'passion',
	'reason',
	'rite_watchman',
	'stamina',
	'student_lantern',
] as const satisfies readonly CardId[];

export const verbs = {
	work: {
		id: 'work',
		label: 'Work',
		description: 'Earn money, act publicly, or perform the last operation.',
	},
	study: {
		id: 'study',
		label: 'Study',
		description: 'Read, combine lore, and improve the mind.',
	},
	dream: {
		id: 'dream',
		label: 'Dream',
		description: 'Let desire and lore move beneath waking life.',
	},
	explore: {
		id: 'explore',
		label: 'Explore',
		description: 'Search the city for books, people, and rites.',
	},
	talk: {
		id: 'talk',
		label: 'Talk',
		description: 'Recruit allies and build a society.',
	},
} as const satisfies Readonly<Record<VerbId, VerbDefinition>>;

export const cards = {
	health: {
		id: 'health',
		label: 'Health',
		description: 'A body that can still do what is asked of it.',
		aspects: { body: 1 },
		tone: 'ability',
	},
	stamina: {
		id: 'stamina',
		label: 'Vitality',
		description: 'Temporary strength gathered through exertion.',
		aspects: { body: 1 },
		tone: 'ability',
	},
	reason: {
		id: 'reason',
		label: 'Reason',
		description: 'A mind capable of orderly violence against mystery.',
		aspects: { reason: 1 },
		tone: 'ability',
	},
	erudition: {
		id: 'erudition',
		label: 'Erudition',
		description: 'Notes, proofs, and disciplined attention.',
		aspects: { reason: 1 },
		tone: 'ability',
	},
	passion: {
		id: 'passion',
		label: 'Passion',
		description: 'A brightness that survives daylight.',
		aspects: { passion: 1 },
		tone: 'ability',
	},
	glimmering: {
		id: 'glimmering',
		label: 'Glimmering',
		description: 'A useful unsettled mood.',
		aspects: { passion: 1 },
		tone: 'ability',
	},
	funds: {
		id: 'funds',
		label: 'Funds',
		description: 'Rent, ink, tickets, hush money.',
		aspects: { coin: 1 },
		tone: 'material',
	},
	bequest: {
		id: 'bequest',
		label: 'A Bequest',
		description: 'A box of papers from an acquaintance now absent.',
		aspects: { secret: 1 },
		unique: true,
		tone: 'material',
	},
	book_lantern: {
		id: 'book_lantern',
		label: 'The Locksmith Dreamed',
		description: 'A slim, coded book about doors that open in sleep.',
		aspects: { secret: 1 },
		unique: true,
		tone: 'material',
	},
	lantern_lore_2: {
		id: 'lantern_lore_2',
		label: 'A Watchful Principle',
		description: 'Lantern lore of the second intensity.',
		aspects: { lantern: 2, lore: 1 },
		tone: 'lore',
	},
	lantern_lore_4: {
		id: 'lantern_lore_4',
		label: 'A Door in the Eye',
		description: 'Lantern lore of the fourth intensity.',
		aspects: { lantern: 4, lore: 1 },
		tone: 'lore',
	},
	lantern_lore_6: {
		id: 'lantern_lore_6',
		label: 'The White Door',
		description: 'Lantern lore of the sixth intensity.',
		aspects: { lantern: 6, lore: 1 },
		tone: 'lore',
	},
	lantern_lore_8: {
		id: 'lantern_lore_8',
		label: 'The Glory Through Glass',
		description: 'Lantern lore of the eighth intensity.',
		aspects: { lantern: 8, lore: 1 },
		tone: 'lore',
	},
	lantern_lore_10: {
		id: 'lantern_lore_10',
		label: 'The Sun Unsubtle',
		description: 'Lantern lore of the tenth intensity.',
		aspects: { lantern: 10, lore: 1 },
		tone: 'lore',
	},
	influence_lantern: {
		id: 'influence_lantern',
		label: 'A Bright Influence',
		description: 'Borrowed attention from something that sees too much.',
		aspects: { lantern: 6 },
		tone: 'lore',
	},
	desire_enlightenment_1: {
		id: 'desire_enlightenment_1',
		label: 'Temptation: Enlightenment',
		description: 'The thought that understanding could become an appetite.',
		aspects: { lantern: 1, secret: 1 },
		unique: true,
		tone: 'lore',
	},
	desire_enlightenment_2: {
		id: 'desire_enlightenment_2',
		label: 'Dedication: Enlightenment',
		description: 'The first concessions made to the light.',
		aspects: { lantern: 2, secret: 1 },
		unique: true,
		tone: 'lore',
	},
	desire_enlightenment_3: {
		id: 'desire_enlightenment_3',
		label: 'Ascension: Through the Door',
		description: 'The way is no longer a metaphor.',
		aspects: { lantern: 4, secret: 1 },
		unique: true,
		tone: 'lore',
	},
	desire_enlightenment_4: {
		id: 'desire_enlightenment_4',
		label: 'Ascension: Opened Eye',
		description: 'Sleep is thinner now; mirrors hesitate.',
		aspects: { lantern: 6, secret: 1 },
		unique: true,
		tone: 'lore',
	},
	desire_enlightenment_5: {
		id: 'desire_enlightenment_5',
		label: 'Ascension: The Last Brightness',
		description: 'The final rite waits for work, witness, and nerve.',
		aspects: { lantern: 8, secret: 1 },
		unique: true,
		tone: 'lore',
	},
	acquaintance: {
		id: 'acquaintance',
		label: 'An Acquaintance',
		description: 'Someone who will listen after midnight.',
		aspects: { secret: 1 },
		tone: 'society',
	},
	cult_lantern: {
		id: 'cult_lantern',
		label: 'Society of the Open Eye',
		description: 'A small, hungry society arranged around Lantern.',
		aspects: { cult: 1, lantern: 1 },
		unique: true,
		tone: 'society',
	},
	student_lantern: {
		id: 'student_lantern',
		label: 'Lantern Disciple',
		description: 'A student loyal enough to risk the visible world.',
		aspects: { follower: 1, lantern: 3 },
		tone: 'society',
	},
	rite_watchman: {
		id: 'rite_watchman',
		label: 'Rite of the Unblinking Door',
		description: 'A workable rite. It leaves no shadow.',
		aspects: { rite: 1, lantern: 2 },
		unique: true,
		tone: 'society',
	},
	notoriety: {
		id: 'notoriety',
		label: 'Notoriety',
		description: 'People are talking.',
		aspects: { secret: 1 },
		tone: 'danger',
	},
	evidence: {
		id: 'evidence',
		label: 'Evidence',
		description: 'A careful file in official hands.',
		aspects: { secret: 1 },
		tone: 'danger',
	},
	dread: {
		id: 'dread',
		label: 'Dread',
		description: 'An inward darkening.',
		aspects: { dread: 1 },
		tone: 'danger',
	},
	fascination: {
		id: 'fascination',
		label: 'Fascination',
		description: 'The light clings to the inside of the eyes.',
		aspects: { fascination: 1 },
		tone: 'danger',
	},
} as const satisfies Readonly<Record<CardId, CardDefinition>>;

export const recipes = [
	{
		id: 'work_menial',
		verb: 'work',
		label: 'A day of labour',
		startText: 'The city has uses for a body that arrives on time.',
		resultText: 'Wages, and a body somewhat less willing than before.',
		duration: 45,
		requirements: [{ card: 'health' }],
		effects: [{ card: 'funds', count: 2 }],
	},
	{
		id: 'work_commission',
		verb: 'work',
		label: 'Translate a commission',
		startText: 'A patron needs occult marginalia made respectable.',
		resultText: 'The work pays better than it should.',
		duration: 55,
		requirements: [{ card: 'reason' }, { card: 'lantern_lore_4' }],
		effects: [{ card: 'funds', count: 3 }, { card: 'notoriety', count: 1 }],
	},
	{
		id: 'work_enlightenment_victory',
		verb: 'work',
		label: 'Invoke the Watchman',
		startText: 'The rite begins as labour. It ends elsewhere.',
		resultText:
			'The room opens like an eye. What remains here is only a rumour of you.',
		duration: 90,
		requirements: [
			{ card: 'desire_enlightenment_5' },
			{ card: 'lantern_lore_10' },
			{ card: 'student_lantern' },
			{ card: 'rite_watchman' },
			{ card: 'influence_lantern' },
		],
		costs: [
			{ card: 'desire_enlightenment_5', count: 1 },
			{ card: 'influence_lantern', count: 1 },
		],
		ending: 'enlightenment',
		unique: true,
	},
	{
		id: 'study_bequest',
		verb: 'study',
		label: 'Open the bequest',
		startText: 'The papers smell of dust and fever.',
		resultText: 'Among the papers is a book and the first useful hint.',
		duration: 35,
		requirements: [{ card: 'bequest' }],
		costs: [{ card: 'bequest', count: 1 }],
		effects: [
			{ card: 'book_lantern', count: 1 },
			{ card: 'lantern_lore_2', count: 1 },
		],
		unique: true,
	},
	{
		id: 'study_book_lantern',
		verb: 'study',
		label: 'Read The Locksmith Dreamed',
		startText: 'The text changes if read beside a covered mirror.',
		resultText: 'A second scrap of Lantern lore can now be compared.',
		duration: 55,
		requirements: [{ card: 'book_lantern' }, { card: 'reason' }],
		costs: [{ card: 'book_lantern', count: 1 }],
		effects: [{ card: 'lantern_lore_2', count: 1 }],
		unique: true,
	},
	{
		id: 'study_reason',
		verb: 'study',
		label: 'Discipline reason',
		startText: 'Attention becomes a tool if sharpened often enough.',
		resultText: 'The notes settle into a useful pattern.',
		duration: 30,
		requirements: [{ card: 'reason' }],
		effects: [{ card: 'erudition', count: 1 }],
	},
	{
		id: 'study_passion',
		verb: 'study',
		label: 'Follow a glimmering',
		startText: 'There is an angle in the room that was not there before.',
		resultText: 'The mood leaves a mark that can be used later.',
		duration: 30,
		requirements: [{ card: 'passion' }],
		effects: [{ card: 'glimmering', count: 1 }],
	},
	{
		id: 'study_lantern_4',
		verb: 'study',
		label: 'Compare Watchful Principles',
		startText: 'Two lesser observations can become one stronger doctrine.',
		resultText: 'The doctrine now has teeth.',
		duration: 60,
		requirements: [
			{ card: 'lantern_lore_2', count: 2 },
			{ card: 'erudition' },
		],
		costs: [
			{ card: 'lantern_lore_2', count: 2 },
			{ card: 'erudition', count: 1 },
		],
		effects: [{ card: 'lantern_lore_4', count: 1 }],
	},
	{
		id: 'study_lantern_6',
		verb: 'study',
		label: 'Codify the White Door',
		startText: 'Lantern lore permits no comfortable contradiction.',
		resultText: 'A door in dream has been named.',
		duration: 60,
		requirements: [
			{ card: 'lantern_lore_4' },
			{ card: 'erudition' },
			{ card: 'reason' },
		],
		costs: [
			{ card: 'lantern_lore_4', count: 1 },
			{ card: 'erudition', count: 1 },
		],
		effects: [{ card: 'lantern_lore_6', count: 1 }],
	},
	{
		id: 'study_lantern_8',
		verb: 'study',
		label: 'Map the Glory through glass',
		startText: 'A safer scholar would stop before this point.',
		resultText: 'The map is not safe, but it is accurate.',
		duration: 70,
		requirements: [
			{ card: 'lantern_lore_6' },
			{ card: 'erudition' },
			{ card: 'reason' },
		],
		costs: [
			{ card: 'lantern_lore_6', count: 1 },
			{ card: 'erudition', count: 1 },
		],
		effects: [
			{ card: 'lantern_lore_8', count: 1 },
			{ card: 'fascination', count: 1 },
		],
	},
	{
		id: 'study_lantern_10',
		verb: 'study',
		label: 'Compile The Sun Unsubtle',
		startText: 'The last proof is unpleasantly simple.',
		resultText: 'The highest usable Lantern doctrine is complete.',
		duration: 80,
		requirements: [
			{ card: 'lantern_lore_8' },
			{ card: 'erudition' },
			{ card: 'reason' },
		],
		costs: [
			{ card: 'lantern_lore_8', count: 1 },
			{ card: 'erudition', count: 1 },
		],
		effects: [
			{ card: 'lantern_lore_10', count: 1 },
			{ card: 'fascination', count: 1 },
		],
	},
	{
		id: 'dream_temptation',
		verb: 'dream',
		label: 'Dream of a watchful principle',
		startText: 'The dream begins with a keyhole.',
		resultText: 'Ambition has acquired a name.',
		duration: 40,
		requirements: [{ card: 'lantern_lore_2' }, { card: 'passion' }],
		effects: [{ card: 'desire_enlightenment_1', count: 1 }],
		unique: true,
	},
	{
		id: 'dream_dedication',
		verb: 'dream',
		label: 'Dedicate the desire',
		startText: 'There are things one must stop pretending not to want.',
		resultText: 'The desire is no longer idle.',
		duration: 45,
		requirements: [
			{ card: 'desire_enlightenment_1' },
			{ card: 'lantern_lore_4' },
		],
		costs: [{ card: 'desire_enlightenment_1', count: 1 }],
		effects: [{ card: 'desire_enlightenment_2', count: 1 }],
		unique: true,
	},
	{
		id: 'dream_white_door',
		verb: 'dream',
		label: 'Pass the White Door',
		startText: 'The way opens only when sleep is forced to confess.',
		resultText: 'The dream leaves fingerprints on the waking hand.',
		duration: 60,
		requirements: [
			{ card: 'desire_enlightenment_2' },
			{ card: 'lantern_lore_6' },
		],
		costs: [{ card: 'desire_enlightenment_2', count: 1 }],
		effects: [{ card: 'desire_enlightenment_3', count: 1 }],
		unique: true,
	},
	{
		id: 'dream_bright_influence',
		verb: 'dream',
		label: 'Draw a bright influence',
		startText: 'The doctrine is a hook; sleep is the line.',
		resultText: 'Something bright has noticed the hook.',
		duration: 50,
		requirements: [
			{ card: 'lantern_lore_6' },
			{ card: 'glimmering' },
		],
		costs: [{ card: 'glimmering', count: 1 }],
		effects: [{ card: 'influence_lantern', count: 1 }],
	},
	{
		id: 'dream_opened_eye',
		verb: 'dream',
		label: 'Open the inward eye',
		startText: 'The influence presses against the dream from outside.',
		resultText: 'The eye opens. It does not close completely.',
		duration: 70,
		requirements: [
			{ card: 'desire_enlightenment_3' },
			{ card: 'lantern_lore_8' },
			{ card: 'influence_lantern' },
		],
		costs: [
			{ card: 'desire_enlightenment_3', count: 1 },
			{ card: 'influence_lantern', count: 1 },
		],
		effects: [
			{ card: 'desire_enlightenment_4', count: 1 },
			{ card: 'fascination', count: 1 },
		],
		unique: true,
	},
	{
		id: 'dream_last_brightness',
		verb: 'dream',
		label: 'Prepare the last brightness',
		startText: 'There must be a body, a doctrine, a rite, and a witness.',
		resultText: 'The desire is ready for work.',
		duration: 80,
		requirements: [
			{ card: 'desire_enlightenment_4' },
			{ card: 'lantern_lore_10' },
			{ card: 'rite_watchman' },
			{ card: 'student_lantern' },
		],
		costs: [{ card: 'desire_enlightenment_4', count: 1 }],
		effects: [{ card: 'desire_enlightenment_5', count: 1 }],
		unique: true,
	},
	{
		id: 'dream_rest',
		verb: 'dream',
		label: 'Sleep without ceremony',
		startText: 'The safest dream is not always safe, but it is quieter.',
		resultText: 'The worst inward pressure recedes.',
		duration: 40,
		requirements: [{ card: 'health' }],
		costs: [{ card: 'dread', count: 1 }],
	},
	{
		id: 'explore_bookshop',
		verb: 'explore',
		label: 'Search the bookshops',
		startText: 'There are shops that keep their best shelves covered.',
		resultText: 'A bookseller accepts cash and asks no sensible questions.',
		duration: 45,
		requirements: [{ card: 'funds' }],
		costs: [{ card: 'funds', count: 1 }],
		effects: [{ card: 'book_lantern', count: 1 }],
		unique: true,
	},
	{
		id: 'explore_moonlit_streets',
		verb: 'explore',
		label: 'Walk the moonlit streets',
		startText: 'The right person is easiest to meet by accident.',
		resultText: 'A conversation lingers past dawn.',
		duration: 40,
		requirements: [{ card: 'passion' }],
		effects: [{ card: 'acquaintance', count: 1 }],
	},
	{
		id: 'explore_hidden_room',
		verb: 'explore',
		label: 'Find a room for rites',
		startText: 'Every city has rooms where law forgets to look.',
		resultText: 'The room is bare, private, and fit for an opening door.',
		duration: 60,
		requirements: [{ card: 'cult_lantern' }, { card: 'funds' }],
		costs: [{ card: 'funds', count: 1 }],
		effects: [{ card: 'rite_watchman', count: 1 }],
		unique: true,
	},
	{
		id: 'talk_lore_acquaintance',
		verb: 'talk',
		label: 'Speak of impossible light',
		startText: 'Most listeners leave. One does not.',
		resultText: 'An acquaintance is now implicated.',
		duration: 35,
		requirements: [{ card: 'lantern_lore_2' }],
		effects: [{ card: 'acquaintance', count: 1 }],
	},
	{
		id: 'talk_found_cult',
		verb: 'talk',
		label: 'Found a Lantern society',
		startText: 'Names, vows, and the first careful lie.',
		resultText: 'The society has begun.',
		duration: 55,
		requirements: [
			{ card: 'acquaintance' },
			{ card: 'lantern_lore_4' },
		],
		costs: [{ card: 'acquaintance', count: 1 }],
		effects: [{ card: 'cult_lantern', count: 1 }],
		unique: true,
	},
	{
		id: 'talk_recruit_student',
		verb: 'talk',
		label: 'Recruit a Lantern disciple',
		startText: 'The society needs hands and eyes.',
		resultText: 'The new disciple understands enough to be dangerous.',
		duration: 55,
		requirements: [
			{ card: 'cult_lantern' },
			{ card: 'lantern_lore_6' },
		],
		effects: [
			{ card: 'student_lantern', count: 1 },
			{ card: 'notoriety', count: 1 },
		],
	},
] as const satisfies readonly RecipeDefinition[];

export const endingLabels = {
	death: 'A bodily ending',
	despair: 'A quiet ending',
	enlightenment: 'Enlightenment',
	imprisonment: 'Imprisonment',
	madness: 'Lost in light',
} as const satisfies Readonly<Record<EndingId, string>>;

const recipeById: ReadonlyMap<string, RecipeDefinition> = new Map(
	recipes.map(definition => [definition.id, definition])
);

export function recipe(id: string): RecipeDefinition {
	const found = recipeById.get(id);
	if (found === undefined) throw new Error(`Unknown recipe: ${id}`);
	return found;
}

export function initialInventory(): Record<CardId, number> {
	const inventory = Object.fromEntries(
		allCardIds.map(id => [id, 0])
	) as Record<CardId, number>;

	inventory.health = 1;
	inventory.reason = 1;
	inventory.passion = 1;
	inventory.funds = 2;
	inventory.bequest = 1;

	return inventory;
}

export function newGame(): GameState {
	return {
		inventory: initialInventory(),
		operations: {},
		completed: {},
		time: 0,
		nextSeasonAt: 180,
		log: [
			{
				at: 0,
				title: 'June the 28th',
				text: 'A chilly city, a little money, and a box of papers.',
				kind: 'result',
			},
		],
	};
}

export function count(state: GameState, card: CardId): number {
	return state.inventory[card];
}

export function visibleInventory(
	state: GameState
): readonly [CardDefinition, number][] {
	return allCardIds
		.filter(id => count(state, id) > 0)
		.map(id => [cards[id], count(state, id)] as const);
}

export function cardAspects(card: CardId): ReadonlyMap<AspectId, number> {
	return new Map(Object.entries(cards[card].aspects) as [AspectId, number][]);
}

export function inventoryAspects(
	state: Pick<GameState, 'inventory'>
): ReadonlyMap<AspectId, number> {
	const aspects = new Map<AspectId, number>();

	for (const id of allCardIds) {
		const n = state.inventory[id];
		if (n <= 0) continue;

		for (const [aspect, value] of Object.entries(cards[id].aspects) as [
			AspectId,
			number,
		][]) {
			aspects.set(aspect, (aspects.get(aspect) ?? 0) + value * n);
		}
	}

	return aspects;
}

export function statusForRecipe(
	state: GameState,
	definition: RecipeDefinition
): RecipeStatus {
	const requirements = (definition.requirements ?? []).map(requirement => {
		const needed = requirement.count ?? 1;
		const have = count(state, requirement.card);
		return {
			...requirement,
			count: needed,
			have,
			missing: Math.max(0, needed - have),
		};
	});
	const missing = requirements.filter(requirement => requirement.missing > 0);
	const verbBusy = state.operations[definition.verb] !== undefined;

	if (state.ending !== undefined) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: 'This history is complete.',
		};
	}

	if (verbBusy) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: `${verbs[definition.verb].label} is already occupied.`,
		};
	}

	if (
		definition.unique === true &&
		(state.completed[definition.id] ?? 0) > 0
	) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: 'Already completed.',
		};
	}

	if (missing.length > 0) {
		return {
			recipe: definition,
			requirements,
			available: false,
			blockedReason: missing
				.map(requirement => {
					const label = cards[requirement.card].label;
					return `${label} ${requirement.have}/${requirement.count}`;
				})
				.join(', '),
		};
	}

	return { recipe: definition, requirements, available: true };
}

export function recipeStatuses(state: GameState): readonly RecipeStatus[] {
	return recipes.map(definition => statusForRecipe(state, definition));
}

export function availableRecipesForVerb(
	state: GameState,
	verb: VerbId
): readonly RecipeStatus[] {
	return recipeStatuses(state).filter(
		status => status.recipe.verb === verb && status.available
	);
}

export function changeInventory(
	inventory: Readonly<Record<CardId, number>>,
	effects: readonly Effect[] = []
): Record<CardId, number> {
	const next = { ...inventory };

	for (const effect of effects) {
		const current = next[effect.card];
		const definition: CardDefinition = cards[effect.card];
		const uniqueLimit = definition.unique === true ? 1 : Infinity;
		next[effect.card] = Math.max(
			0,
			Math.min(uniqueLimit, current + effect.count)
		);
	}

	return next;
}

function appendLog(state: GameState, entry: Omit<LogEntry, 'at'>): GameState {
	return {
		...state,
		log: [...state.log, { ...entry, at: state.time }].slice(-24),
	};
}

function cardQuantities(
	counts: ReadonlyMap<CardId, number>
): readonly CardQuantity[] {
	return allCardIds
		.map(card => ({ card, count: counts.get(card) ?? 0 }))
		.filter(({ count }) => count > 0);
}

function recipeInputs(
	definition: RecipeDefinition,
	inventory: Readonly<Record<CardId, number>>
): readonly CardQuantity[] {
	const inputs = new Map<CardId, number>();

	for (const requirement of definition.requirements ?? []) {
		inputs.set(
			requirement.card,
			(inputs.get(requirement.card) ?? 0) + (requirement.count ?? 1)
		);
	}

	for (const cost of definition.costs ?? []) {
		const consumed = Math.min(cost.count, inventory[cost.card]);
		if (consumed <= 0) continue;
		inputs.set(cost.card, Math.max(inputs.get(cost.card) ?? 0, consumed));
	}

	return cardQuantities(inputs);
}

function producedCards(
	before: Readonly<Record<CardId, number>>,
	after: Readonly<Record<CardId, number>>
): readonly CardQuantity[] {
	const produced = new Map<CardId, number>();

	for (const card of allCardIds) {
		const count = after[card] - before[card];
		if (count > 0) produced.set(card, count);
	}

	return cardQuantities(produced);
}

export function startRecipe(state: GameState, recipeId: string): GameState {
	const definition = recipe(recipeId);
	const status = statusForRecipe(state, definition);
	if (!status.available) {
		throw new Error(
			`${definition.label} is not available: ${
				status.blockedReason ?? 'unknown reason'
			}`
		);
	}

	const withCosts = {
		...state,
		inventory: changeInventory(
			state.inventory,
			(definition.costs ?? []).map(cost => ({
				...cost,
				count: -cost.count,
			}))
		),
		operations: {
			...state.operations,
			[definition.verb]: {
				recipeId,
				verb: definition.verb,
				startedAt: state.time,
				remaining: definition.duration,
				total: definition.duration,
			},
		},
	};

	return appendLog(withCosts, {
		inputs: recipeInputs(definition, state.inventory),
		title: definition.label,
		text: definition.startText,
		kind: 'start',
	});
}

function completeOperation(state: GameState, operation: Operation): GameState {
	const definition = recipe(operation.recipeId);
	const operations = { ...state.operations };
	delete operations[operation.verb];

	const inventory = changeInventory(state.inventory, definition.effects ?? []);
	let next: GameState = {
		...state,
		inventory,
		operations,
		completed: {
			...state.completed,
			[definition.id]: (state.completed[definition.id] ?? 0) + 1,
		},
	};

	next = appendLog(next, {
		outputs: producedCards(state.inventory, inventory),
		title: definition.label,
		text: definition.resultText,
		kind: definition.ending === undefined ? 'result' : 'ending',
	});

	if (definition.ending !== undefined) {
		next = {
			...next,
			ending: definition.ending,
			operations: {},
		};
	}

	return checkForLoss(next);
}

function resolveSeasons(state: GameState): GameState {
	let next = state;

	while (next.ending === undefined && next.time >= next.nextSeasonAt) {
		let inventory = next.inventory;
		let text: string;
		let kind: LogEntry['kind'] = 'season';

		if (count(next, 'funds') > 0) {
			inventory = changeInventory(inventory, [{ card: 'funds', count: -1 }]);
			text = 'Rent, food, and ordinary obligations consume funds.';
		} else {
			inventory = changeInventory(inventory, [
				{ card: 'health', count: -1 },
				{ card: 'dread', count: 1 },
			]);
			text = 'Poverty bites at health and darkens the mind.';
			kind = 'danger';
		}

		if (inventory.notoriety >= 3) {
			inventory = changeInventory(inventory, [
				{ card: 'notoriety', count: -2 },
				{ card: 'evidence', count: 1 },
			]);
			text += ' Official attention hardens rumour into evidence.';
		}

		next = appendLog(
			{
				...next,
				inventory,
				nextSeasonAt: next.nextSeasonAt + 180,
			},
			{
				title: 'Season',
				text,
				kind,
			}
		);

		next = checkForLoss(next);
	}

	return next;
}

export function advanceTime(state: GameState, seconds: number): GameState {
	if (seconds < 0) throw new Error('Cannot move time backwards.');
	if (state.ending !== undefined || seconds === 0) return state;

	let next: GameState = {
		...state,
		time: state.time + seconds,
		operations: Object.fromEntries(
			Object.entries(state.operations).map(([verb, operation]) => [
				verb,
				{
					...operation,
					remaining: Math.max(0, operation.remaining - seconds),
				},
			])
		) as Partial<Record<VerbId, Operation>>,
	};

	const completed = Object.values(next.operations)
		.filter(operation => operation.remaining <= 0)
		.sort((a, b) => a.startedAt + a.total - (b.startedAt + b.total));

	for (const operation of completed) {
		next = completeOperation(next, operation);
	}

	return resolveSeasons(next);
}

export function nextCompletionIn(state: GameState): number | undefined {
	const remaining = Object.values(state.operations)
		.map(operation => operation.remaining);

	if (remaining.length === 0) return undefined;
	return Math.min(...remaining);
}

export function advanceToNextCompletion(state: GameState): GameState {
	const seconds = nextCompletionIn(state);
	if (seconds === undefined) return state;
	return advanceTime(state, seconds);
}

export function checkForLoss(state: GameState): GameState {
	if (state.ending !== undefined) return state;

	if (count(state, 'health') <= 0) {
		return {
			...appendLog(state, {
				title: endingLabels.death,
				text: 'The body can no longer pay what the work demands.',
				kind: 'ending',
			}),
			ending: 'death',
			operations: {},
		};
	}

	if (count(state, 'dread') >= 3) {
		return {
			...appendLog(state, {
				title: endingLabels.despair,
				text: 'Dread has crowded out every possible future.',
				kind: 'ending',
			}),
			ending: 'despair',
			operations: {},
		};
	}

	if (count(state, 'fascination') >= 4) {
		return {
			...appendLog(state, {
				title: endingLabels.madness,
				text: 'The light is everything. The world is optional.',
				kind: 'ending',
			}),
			ending: 'madness',
			operations: {},
		};
	}

	if (count(state, 'evidence') >= 2) {
		return {
			...appendLog(state, {
				title: endingLabels.imprisonment,
				text: 'The file is complete. The cell is not metaphorical.',
				kind: 'ending',
			}),
			ending: 'imprisonment',
			operations: {},
		};
	}

	return state;
}

export function playRecipeToCompletion(
	state: GameState,
	recipeId: string
): GameState {
	return advanceToNextCompletion(startRecipe(state, recipeId));
}
